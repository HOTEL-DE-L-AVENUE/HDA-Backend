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

// Crée ou met à jour la fiche KYC d'un client (upsert 1-1), en une seule transaction.
async function upsertKyc(clientId, data = {}) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT id FROM client_kyc WHERE client_id = ? FOR UPDATE', [clientId]);
    const existing = rows[0];

    const payload = {};
    for (const field of KYC_UPSERT_FIELDS) {
      if (data[field] === undefined) continue;
      payload[field] = KYC_BOOL_FIELDS.includes(field) ? (data[field] ? 1 : 0) : data[field];
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
  findByClientId, search, adjustAccountBalance,
  findKycByClientId, upsertKyc,
};