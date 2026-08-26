// models/clientModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const Clients = createCrudModel({
  table: 'clients',
  pk: 'id',
  fields: [
    'code_client', 'nom', 'prenom', 'telephone', 'email', 'adresse',
    'date_naissance', 'type_piece', 'numero_piece', 'photo_url',
    'is_casino_player', 'statut',
  ],
  sortable: ['id', 'nom', 'prenom', 'code_client', 'statut', 'created_at'],
});

const ClientAccounts = createCrudModel({
  table: 'client_accounts',
  pk: 'id',
  fields: ['client_id', 'solde'],
  sortable: ['id', 'client_id', 'solde'],
});

const LoyaltyPoints = createCrudModel({
  table: 'loyalty_points',
  pk: 'id',
  fields: ['client_id', 'points', 'motif', 'created_at'],
  sortable: ['id', 'client_id', 'created_at'],
});

// Fiche KYC (Know Your Customer) — conformité LBC/FT casino.
// Exposé surtout via findKycByClientId / upsertKyc (relation 1-1 avec un client),
// mais on garde aussi un modèle CRUD générique pour les besoins d'admin/listing.
const ClientKyc = createCrudModel({
  table: 'client_kyc',
  pk: 'id',
  fields: [
    'client_id', 'lieu_naissance', 'nationalite', 'profession',
    'date_delivrance_piece', 'date_expiration_piece', 'autorite_delivrance',
    'source_revenus', 'revenu_mensuel_estime', 'mode_paiement', 'banque',
    'doc_piece_identite', 'doc_justificatif_domicile', 'doc_photo_client', 'doc_autre',
    'niveau_risque', 'commentaires_risque', 'declaration_client',
    'agent_verificateur', 'date_verification',
  ],
  sortable: ['id', 'client_id', 'niveau_risque', 'date_verification', 'created_at'],
});

// Champs modifiables librement sur un client (code_client est géré à part : voir
// createClient / updateClient ci-dessous).
const CLIENT_FIELDS = [
  'nom', 'prenom', 'telephone', 'email', 'adresse',
  'date_naissance', 'type_piece', 'numero_piece', 'photo_url',
  'is_casino_player', 'statut',
];

function pickClientFields(data = {}) {
  const out = {};
  for (const field of CLIENT_FIELDS) {
    if (data[field] !== undefined) out[field] = data[field];
  }
  return out;
}

// Crée un client. `nom` est le seul champ obligatoire (validé côté contrôleur).
// `code_client` : utilisé tel quel s'il est fourni, sinon auto-généré à partir de
// l'id auto-incrémenté une fois la ligne créée (garantit l'unicité sans compteur
// séparé à synchroniser).
async function createClient(data = {}) {
  const fields = pickClientFields(data);
  return withTransaction(async (conn) => {
    const [ins] = await conn.query('INSERT INTO clients SET ?', [fields]);
    const id = ins.insertId;

    const providedCode = data.code_client && String(data.code_client).trim();
    const finalCode = providedCode || `CLI-${String(id).padStart(6, '0')}`;
    await conn.query('UPDATE clients SET code_client = ? WHERE id = ?', [finalCode, id]);

    const [rows] = await conn.query('SELECT * FROM clients WHERE id = ?', [id]);
    return rows[0];
  });
}

// Met à jour un client. Le code_client est immuable une fois attribué : toute
// valeur reçue dans data.code_client est ignorée si le client en a déjà un.
// Retourne null si le client n'existe pas (le contrôleur transforme ça en 404).
async function updateClient(id, data = {}) {
  const [existingRows] = await pool.query('SELECT code_client FROM clients WHERE id = ?', [id]);
  const existing = existingRows[0];
  if (!existing) return null;

  const payload = pickClientFields(data);

  const providedCode = data.code_client && String(data.code_client).trim();
  if (!existing.code_client && providedCode) {
    payload.code_client = providedCode;
  }

  if (Object.keys(payload).length > 0) {
    await pool.query('UPDATE clients SET ? WHERE id = ?', [payload, id]);
  }

  const [rows] = await pool.query('SELECT * FROM clients WHERE id = ?', [id]);
  return rows[0];
}

async function findByClientId(id) {
  const [rows] = await pool.query('SELECT * FROM client_accounts WHERE client_id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Recherche multi-critères (nom, prénom, code_client, téléphone, email)
async function search(term, limit = 20) {
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `SELECT * FROM clients
     WHERE nom LIKE ? OR prenom LIKE ? OR code_client LIKE ? OR telephone LIKE ? OR email LIKE ?
     ORDER BY nom ASC LIMIT ?`,
    [like, like, like, like, like, limit]
  );
  return rows;
}

// Crédite/débite le compte client et journalise le point de fidélité si fourni,
// dans une seule transaction (évite les incohérences en cas d'erreur partielle).
async function adjustAccountBalance(clientId, delta, { points, motif } = {}) {
  return withTransaction(async (conn) => {
    const [accRows] = await conn.query('SELECT * FROM client_accounts WHERE client_id = ? FOR UPDATE', [clientId]);
    let account = accRows[0];
    if (!account) {
      const [ins] = await conn.query('INSERT INTO client_accounts (client_id, solde) VALUES (?, 0)', [clientId]);
      account = { id: ins.insertId, client_id: clientId, solde: 0 };
    }
    const newSolde = Number(account.solde) + Number(delta);
    await conn.query('UPDATE client_accounts SET solde = ? WHERE id = ?', [newSolde, account.id]);

    if (points) {
      await conn.query(
        'INSERT INTO loyalty_points (client_id, points, motif, created_at) VALUES (?, ?, ?, NOW())',
        [clientId, points, motif || null]
      );
    }
    const [updated] = await conn.query('SELECT * FROM client_accounts WHERE id = ?', [account.id]);
    return updated[0];
  });
}

async function findKycByClientId(clientId) {
  const [rows] = await pool.query('SELECT * FROM client_kyc WHERE client_id = ? LIMIT 1', [clientId]);
  return rows[0] || null;
}

// Champs KYC autorisés en upsert (évite qu'un payload arbitraire touche id/client_id/timestamps).
const KYC_UPSERT_FIELDS = [
  'lieu_naissance', 'nationalite', 'profession',
  'date_delivrance_piece', 'date_expiration_piece', 'autorite_delivrance',
  'source_revenus', 'revenu_mensuel_estime', 'mode_paiement', 'banque',
  'doc_piece_identite', 'doc_justificatif_domicile', 'doc_photo_client', 'doc_autre',
  'niveau_risque', 'commentaires_risque', 'declaration_client',
  'agent_verificateur', 'date_verification',
];

const KYC_BOOL_FIELDS = ['doc_piece_identite', 'doc_justificatif_domicile', 'doc_photo_client', 'declaration_client'];
const KYC_DATE_FIELDS = ['date_delivrance_piece', 'date_expiration_piece', 'date_verification'];
const KYC_NUM_FIELDS = ['revenu_mensuel_estime', 'agent_verificateur'];

// Crée ou met à jour la fiche KYC d'un client (upsert 1-1), en une seule transaction.
async function upsertKyc(clientId, data = {}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id FROM client_kyc WHERE client_id = ? FOR UPDATE', [clientId]);
    const existing = rows[0];

    const payload = {};
    for (const field of KYC_UPSERT_FIELDS) {
      if (data[field] === undefined) continue;
      const rawVal = data[field];

      if (KYC_BOOL_FIELDS.includes(field)) {
        payload[field] = rawVal ? 1 : 0;
      } else if (KYC_DATE_FIELDS.includes(field)) {
        payload[field] = (rawVal && String(rawVal).trim()) ? String(rawVal).trim() : null;
      } else if (KYC_NUM_FIELDS.includes(field)) {
        payload[field] = (rawVal !== null && rawVal !== '' && rawVal !== undefined && !isNaN(Number(rawVal))) ? Number(rawVal) : null;
      } else if (field === 'niveau_risque') {
        payload[field] = (rawVal && ['FAIBLE', 'MOYEN', 'ELEVE'].includes(rawVal)) ? rawVal : null;
      } else {
        payload[field] = (rawVal !== null && rawVal !== undefined) ? (String(rawVal).trim() || null) : null;
      }
    }

    if (payload.agent_verificateur) {
      const [u] = await conn.query('SELECT id_admin FROM users WHERE id_admin = ?', [payload.agent_verificateur]);
      if (!u || u.length === 0) {
        payload.agent_verificateur = null;
      }
    }

    if (existing) {
      if (Object.keys(payload).length > 0) {
        await conn.query('UPDATE client_kyc SET ? WHERE id = ?', [payload, existing.id]);
      }
      const [updated] = await conn.query('SELECT * FROM client_kyc WHERE id = ?', [existing.id]);
      return updated[0];
    }

    const [ins] = await conn.query('INSERT INTO client_kyc SET ?', [{ client_id: clientId, ...payload }]);
    const [created] = await conn.query('SELECT * FROM client_kyc WHERE id = ?', [ins.insertId]);
    return created[0];
  });
}

module.exports = {
  Clients, ClientAccounts, LoyaltyPoints, ClientKyc,
  createClient, updateClient,
  findByClientId, search, adjustAccountBalance,
  findKycByClientId, upsertKyc,
};