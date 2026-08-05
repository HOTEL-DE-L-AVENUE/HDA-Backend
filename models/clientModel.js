// controllers/clientController.js
const {
  Clients, ClientAccounts, LoyaltyPoints,
  createClient, updateClient,
  findByClientId, search, adjustAccountBalance,
  findKycByClientId, upsertKyc,
} = require('../models/clientModel');
const { findLatestSignature, findSignatureHistory, createSignature } = require('../models/signatureModel');
const { createCrudController } = require('./controllerFactory');
const { renderClient, renderClientWithKyc, renderKyc } = require('../views/clientView');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

const NIVEAUX_RISQUE = ['FAIBLE', 'MOYEN', 'ELEVE'];

const clientsCrud = createCrudController(Clients, {
  filterable: ['statut', 'is_casino_player'],
  view: renderClient,
});

// POST /api/clients — nom est le seul champ obligatoire ; code_client est
// auto-généré s'il n'est pas fourni (voir clientModel.createClient).
async function createClientHandler(req, res) {
  if (!req.body?.nom || !String(req.body.nom).trim()) {
    throw ApiError.badRequest('Le nom est requis');
  }
  const client = await createClient(req.body);
  return created(res, renderClient(client));
}

// PUT /api/clients/:id — code_client ne peut plus être modifié une fois attribué
// (voir clientModel.updateClient, qui ignore silencieusement toute tentative).
async function updateClientHandler(req, res) {
  if (req.body?.nom !== undefined && !String(req.body.nom).trim()) {
    throw ApiError.badRequest('Le nom est requis');
  }
  const client = await updateClient(req.params.id, req.body);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  return ok(res, renderClient(client));
}

async function getOneWithAccount(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const [account, kyc] = await Promise.all([
    findByClientId(req.params.id),
    findKycByClientId(req.params.id),
  ]);
  return ok(res, renderClientWithKyc(client, account, kyc));
}

async function searchClients(req, res) {
  const term = req.query.q;
  if (!term || term.length < 2) throw ApiError.badRequest('Le paramètre "q" doit contenir au moins 2 caractères');
  const rows = await search(term, Number(req.query.limit) || 20);
  return ok(res, rows.map(renderClient));
}

async function getAccount(req, res) {
  const account = await findByClientId(req.params.id);
  if (!account) throw ApiError.notFound('Aucun compte pour ce client');
  return ok(res, account);
}

async function creditAccount(req, res) {
  const { montant, points, motif } = req.body;
  if (!montant) throw ApiError.badRequest('montant requis');
  const account = await adjustAccountBalance(req.params.id, Math.abs(montant), { points, motif });
  return ok(res, account);
}

async function debitAccount(req, res) {
  const { montant, motif } = req.body;
  if (!montant) throw ApiError.badRequest('montant requis');
  const account = await adjustAccountBalance(req.params.id, -Math.abs(montant), { motif });
  return ok(res, account);
}

async function loyaltyHistory(req, res) {
  const rows = await LoyaltyPoints.findAll({ whereSql: 'WHERE client_id = ?', whereValues: [req.params.id], orderBy: '`created_at` DESC' });
  return ok(res, rows);
}

// GET /api/clients/:id/kyc — fiche KYC (conformité LBC/FT)
async function getKyc(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const kyc = await findKycByClientId(req.params.id);
  return ok(res, renderKyc(kyc));
}

// PUT /api/clients/:id/kyc — crée ou met à jour la fiche KYC (upsert)
async function saveKyc(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);

  if (req.body.niveau_risque && !NIVEAUX_RISQUE.includes(req.body.niveau_risque)) {
    throw ApiError.badRequest(`niveau_risque doit être l'un de : ${NIVEAUX_RISQUE.join(', ')}`);
  }

  // NOTE: adapter `req.user?.id_admin` si le payload JWT expose l'id de l'agent
  // sous un autre nom (ex: req.user?.id).
  const kyc = await upsertKyc(req.params.id, {
    ...req.body,
    agent_verificateur: req.body.agent_verificateur ?? req.user?.id_admin ?? null,
    date_verification: req.body.date_verification || new Date().toISOString().slice(0, 10),
  });
  return ok(res, renderKyc(kyc));
}

// GET /api/clients/:id/kyc/signature — dernière signature électronique liée à la déclaration KYC
async function getKycSignature(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const signature = await findLatestSignature('client_kyc', req.params.id);
  return ok(res, signature);
}

// GET /api/clients/:id/kyc/signature/history — historique complet des signatures KYC de ce client
async function getKycSignatureHistory(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const rows = await findSignatureHistory('client_kyc', req.params.id);
  return ok(res, rows);
}

// POST /api/clients/:id/kyc/signature — enregistre une NOUVELLE signature (jamais un remplacement)
async function saveKycSignature(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const { signature_data } = req.body;
  if (!signature_data) throw ApiError.badRequest('signature_data requis');

  const signature = await createSignature({
    signableType: 'client_kyc',
    signableId: req.params.id,
    clientId: req.params.id,
    signatureData: signature_data,
  });
  return created(res, signature);
}

module.exports = {
  clientsCrud, createClientHandler, updateClientHandler,
  getOneWithAccount, searchClients, getAccount, creditAccount, debitAccount, loyaltyHistory,
  getKyc, saveKyc, getKycSignature, getKycSignatureHistory, saveKycSignature,
  ClientAccountsCrud: createCrudController(ClientAccounts, { filterable: ['client_id'] }),
};    let account = accRows[0];
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
