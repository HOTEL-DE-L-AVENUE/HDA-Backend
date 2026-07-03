// controllers/casinoController.js
const casino = require('../models/casinoModel');
const { createCrudController } = require('./controllerFactory');
const { identity } = require('../views/genericView');
const {
  renderSession, renderCredit, renderVisit, renderChipTransaction, renderDashboard,
} = require('../views/casinoView');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

// --- CRUD standard ---------------------------------------------------------

const roomsCrud = createCrudController(casino.CasinoRooms, { filterable: ['statut', 'type_salle'] });
const cashiersCrud = createCrudController(casino.CasinoCashiers, { filterable: ['room_id', 'statut'] });
const sessionsCrud = createCrudController(casino.CasinoSessions, { filterable: ['cashier_id', 'user_id'], view: renderSession });
const cardsCrud = createCrudController(casino.CasinoCards, { filterable: ['client_id', 'niveau'] });
const creditsCrud = createCrudController(casino.CasinoCredits, { filterable: ['client_id', 'statut'], view: renderCredit });
const scoresCrud = createCrudController(casino.CasinoScores, { filterable: ['client_id', 'categorie'] });
const chipTransactionsCrud = createCrudController(casino.CasinoChipTransactions, {
  filterable: ['client_id', 'transaction_type'], view: renderChipTransaction,
});
const visitsCrud = createCrudController(casino.CasinoVisits, { filterable: ['client_id', 'room_id'], view: renderVisit });
const transactionsCrud = createCrudController(casino.CasinoTransactions, { filterable: ['client_id', 'session_id'] });

// --- Sessions de caisse ------------------------------------------------------

async function openSessionHandler(req, res) {
  const { cashier_id, fond_initial } = req.body;
  if (!cashier_id || fond_initial === undefined) throw ApiError.badRequest('cashier_id et fond_initial sont requis');
  const session = await casino.openSession({ cashierId: cashier_id, userId: req.user?.id_admin, fondInitial: fond_initial });
  return created(res, renderSession(session));
}

async function closeSessionHandler(req, res) {
  const { fond_final } = req.body;
  if (fond_final === undefined) throw ApiError.badRequest('fond_final requis');
  try {
    const session = await casino.closeSession(req.params.id, fond_final);
    return ok(res, renderSession(session));
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function activeSessionsHandler(req, res) {
  const rows = await casino.activeSessions();
  return ok(res, rows.map(renderSession));
}

async function sessionTransactionsHandler(req, res) {
  const rows = await casino.transactionsBySession(req.params.id);
  return ok(res, rows);
}

// --- Cartes de fidélité ------------------------------------------------------

async function cardByClientHandler(req, res) {
  const card = await casino.findCardByClient(req.params.clientId);
  if (!card) throw ApiError.notFound('Aucune carte casino pour ce client');
  return ok(res, card);
}

async function addPointsHandler(req, res) {
  const { points } = req.body;
  if (!points) throw ApiError.badRequest('points requis');
  const card = await casino.addCardPoints(req.params.id, points);
  return ok(res, card);
}

// --- Crédits -----------------------------------------------------------------

async function grantCreditHandler(req, res) {
  const { client_id, montant, echeance } = req.body;
  if (!client_id || !montant) throw ApiError.badRequest('client_id et montant sont requis');
  const credit = await casino.grantCredit({ clientId: client_id, montant, echeance });
  return created(res, renderCredit(credit));
}

async function repayCreditHandler(req, res) {
  const { montant } = req.body;
  if (!montant) throw ApiError.badRequest('montant requis');
  const credit = await casino.adjustCreditEncours(req.params.id, -Math.abs(montant));
  return ok(res, renderCredit(credit));
}

async function drawCreditHandler(req, res) {
  const { montant } = req.body;
  if (!montant) throw ApiError.badRequest('montant requis');
  const credit = await casino.adjustCreditEncours(req.params.id, Math.abs(montant));
  return ok(res, renderCredit(credit));
}

async function activeCreditsByClientHandler(req, res) {
  const rows = await casino.activeCreditsByClient(req.params.clientId);
  return ok(res, rows.map(renderCredit));
}

// --- Scores --------------------------------------------------------------------

async function leaderboardHandler(req, res) {
  const rows = await casino.leaderboard({ categorie: req.query.categorie, limit: Number(req.query.limit) || 10 });
  return ok(res, rows);
}

// --- Jetons ----------------------------------------------------------------------

async function buyChipsHandler(req, res) {
  const { client_id, quantite, valeur_unitaire } = req.body;
  if (!client_id || !quantite || !valeur_unitaire) throw ApiError.badRequest('client_id, quantite et valeur_unitaire sont requis');
  const tx = await casino.recordChipTransaction({ clientId: client_id, type: 'ACHAT', quantite, valeurUnitaire: valeur_unitaire });
  return created(res, renderChipTransaction(tx));
}

async function sellChipsHandler(req, res) {
  const { client_id, quantite, valeur_unitaire } = req.body;
  if (!client_id || !quantite || !valeur_unitaire) throw ApiError.badRequest('client_id, quantite et valeur_unitaire sont requis');
  const tx = await casino.recordChipTransaction({ clientId: client_id, type: 'REPRISE', quantite, valeurUnitaire: valeur_unitaire });
  return created(res, renderChipTransaction(tx));
}

async function chipHistoryByClientHandler(req, res) {
  const rows = await casino.chipTransactionsByClient(req.params.clientId, Number(req.query.limit) || 50);
  return ok(res, rows.map(renderChipTransaction));
}

// --- Visites ---------------------------------------------------------------------

async function checkInHandler(req, res) {
  const { client_id, room_id } = req.body;
  if (!client_id || !room_id) throw ApiError.badRequest('client_id et room_id sont requis');
  const visit = await casino.checkIn({ clientId: client_id, roomId: room_id });
  return created(res, renderVisit(visit));
}

async function checkOutHandler(req, res) {
  const visit = await casino.checkOut(req.params.id);
  return ok(res, renderVisit(visit));
}

async function currentlyInRoomHandler(req, res) {
  const rows = await casino.currentlyInRoom(req.params.roomId);
  return ok(res, rows.map(renderVisit));
}

// --- Transactions financières ------------------------------------------------------

async function recordTransactionHandler(req, res) {
  const { client_id, session_id, type_transaction, montant, moyen_paiement } = req.body;
  if (!session_id || !montant) throw ApiError.badRequest('session_id et montant sont requis');
  const tx = await casino.recordTransaction({
    clientId: client_id, sessionId: session_id, type: type_transaction, montant, moyenPaiement: moyen_paiement,
  });
  return created(res, tx);
}

// --- Dashboard --------------------------------------------------------------------

async function dashboardHandler(req, res) {
  const summary = await casino.dashboardSummary();
  return ok(res, renderDashboard(summary));
}

module.exports = {
  roomsCrud, cashiersCrud, sessionsCrud, cardsCrud, creditsCrud, scoresCrud,
  chipTransactionsCrud, visitsCrud, transactionsCrud,
  openSessionHandler, closeSessionHandler, activeSessionsHandler, sessionTransactionsHandler,
  cardByClientHandler, addPointsHandler,
  grantCreditHandler, repayCreditHandler, drawCreditHandler, activeCreditsByClientHandler,
  leaderboardHandler,
  buyChipsHandler, sellChipsHandler, chipHistoryByClientHandler,
  checkInHandler, checkOutHandler, currentlyInRoomHandler,
  recordTransactionHandler,
  dashboardHandler,
};
