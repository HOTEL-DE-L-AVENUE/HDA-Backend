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
};async function getAccount(req, res) {
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
  clientsCrud, getOneWithAccount, searchClients, getAccount, creditAccount, debitAccount, loyaltyHistory,
  getKyc, saveKyc, getKycSignature, getKycSignatureHistory, saveKycSignature,
  ClientAccountsCrud: createCrudController(ClientAccounts, { filterable: ['client_id'] }),
};
