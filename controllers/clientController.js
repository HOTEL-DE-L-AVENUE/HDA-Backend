// controllers/clientController.js
const { Clients, ClientAccounts, LoyaltyPoints, findByClientId, search, adjustAccountBalance } = require('../models/clientModel');
const { createCrudController } = require('./controllerFactory');
const { renderClient, renderClientWithAccount } = require('../views/clientView');
const ApiError = require('../utils/ApiError');
const { ok } = require('../utils/apiResponse');

const clientsCrud = createCrudController(Clients, {
  filterable: ['statut', 'is_casino_player'],
  view: renderClient,
});

async function getOneWithAccount(req, res) {
  const client = await Clients.findById(req.params.id);
  if (!client) throw ApiError.notFound(`Client #${req.params.id} introuvable`);
  const account = await findByClientId(req.params.id);
  return ok(res, renderClientWithAccount(client, account));
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

module.exports = {
  clientsCrud, getOneWithAccount, searchClients, getAccount, creditAccount, debitAccount, loyaltyHistory,
  ClientAccountsCrud: createCrudController(ClientAccounts, { filterable: ['client_id'] }),
};
