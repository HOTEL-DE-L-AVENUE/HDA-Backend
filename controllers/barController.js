const { BarTables, tablesStats } = require('../models/barTables.model');
const { BarCashiers, openCashierSession, closeCashierSession, getCurrentSession } = require('../models/barCashier.model');
const { BarSessions, sessionStats } = require('../models/barSession.model');
const barProductModel = require('../models/barProduct.model');
const { addTransaction } = require('../models/barTransaction.model');
const { listBarOrders, createBarOrder, deleteBarOrder, updateBarOrderStatus } = require('../models/barOrder.model');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

const tablesCrud = createCrudController(BarTables, { filterable: ['statut'] });
const cashiersCrud = createCrudController(BarCashiers, { filterable: ['statut'] });
const sessionsCrud = createCrudController(BarSessions, { filterable: ['cashier_id', 'user_id'] });

// On garde le CRUD générique pour update/delete/get, mais on va surcharger la création
const productsCrud = {
  ...createCrudController(barProductModel.barProducts, { filterable: ['categorie', 'alcool'] }),
  create: async (req, res) => {
    // Utilise la fonction dédiée qui enregistre à la fois dans bar_products ET bar_stock
    const product = await barProductModel.addBarProductWithStock(req.body);
    return created(res, product);
  },
  update: async (req, res) => {
    const { id } = req.params;
    const product = await barProductModel.updateBarProductWithStock(id, req.body);
    return ok(res, product);
  },
  delete: async (req, res) => {
    const { id } = req.params;
    await barProductModel.deleteBarProductWithStock(id);
    return ok(res, { message: 'Supprimé' });
  }
};

async function tablesStatsHandler(req, res) {
  const stats = await tablesStats();
  return ok(res, stats);
}

async function openCashierHandler(req, res) {
  const { cashier_id, user_id, fond_initial } = req.body;
  if (cashier_id === undefined || user_id === undefined || fond_initial === undefined) {
    throw ApiError.badRequest('cashier_id, user_id et fond_initial sont requis');
  }
  const sessionId = await openCashierSession({ cashier_id, user_id, fond_initial });
  const session = await BarSessions.findById(sessionId);
  return created(res, { session_id: sessionId, session });
}

async function closeCashierHandler(req, res) {
  const { session_id, fond_final } = req.body;
  if (session_id === undefined || fond_final === undefined) {
    throw ApiError.badRequest('session_id et fond_final sont requis');
  }
  const closed = await closeCashierSession(session_id, fond_final);
  if (!closed) throw ApiError.notFound('Session non trouvée ou déjà fermée');
  return ok(res, { message: 'Session fermée' });
}

async function cashierStatusHandler(req, res) {
  const cashiers = await BarCashiers.findAll();
  for (const cashier of cashiers) {
    cashier.current_session = await getCurrentSession(cashier.id);
  }
  return ok(res, cashiers);
}

async function openSessionsHandler(req, res) {
  const { cashier_id } = req.query;
  let sessions;
  if (cashier_id) {
    sessions = await BarSessions.findAll({ whereSql: 'WHERE cashier_id = ? AND fermeture_at IS NULL', whereValues: [cashier_id] });
  } else {
    const allSessions = await BarSessions.findAll({ whereSql: 'WHERE fermeture_at IS NULL' });
    sessions = allSessions;
  }
  return ok(res, sessions);
}

async function sessionStatsHandler(req, res) {
  const stats = await sessionStats();
  return ok(res, stats);
}

async function currentSessionHandler(req, res) {
  const session = await BarSessions.findById(req.params.id);
  if (!session) throw ApiError.notFound(`Session #${req.params.id} introuvable`);
  return ok(res, session);
}

async function getBarStockHandler(req, res) {
  const stock = await barProductModel.getBarProductsWithStock();
  return ok(res, stock);
}

async function addBarStockHandler(req, res) {
  const product = await barProductModel.addBarProductWithStock(req.body);
  return created(res, product);
}

async function updateBarStockHandler(req, res) {
  const { id } = req.params;
  const product = await barProductModel.updateBarProductWithStock(id, req.body);
  return ok(res, product);
}

async function deleteBarStockHandler(req, res) {
  const { id } = req.params;
  await barProductModel.deleteBarProductWithStock(id);
  return ok(res, { message: 'Supprimé' });
}

async function addTransactionHandler(req, res) {
  const { session_id, product_id, quantite, prix_unitaire } = req.body;
  if (product_id === undefined || quantite === undefined || prix_unitaire === undefined) {
    throw ApiError.badRequest('product_id, quantite et prix_unitaire sont requis');
  }
  const transaction = await addTransaction({ session_id, product_id, quantite, prix_unitaire });
  return created(res, transaction);
}

async function latestTransactionsByProductHandler(req, res) {
  const { product_id } = req.query;
  const { pool } = require('../config/db');
  const [rows] = await pool.query(
    `SELECT t.*, bp.nom, bp.prix FROM bar_transactions t
     JOIN bar_products bp ON bp.id = t.product_id
     WHERE t.product_id = ?
     ORDER BY t.created_at DESC LIMIT 1`,
    [product_id]
  );
  return ok(res, rows[0] || null);
}

async function listTransactionsHandler(req, res) {
  const { pool } = require('../config/db');
  const [rows] = await pool.query(
    `SELECT t.*, bp.nom, bp.prix, bp.categorie FROM bar_transactions t
     JOIN bar_products bp ON bp.id = t.product_id
     ORDER BY t.created_at DESC LIMIT 50`
  );
  return ok(res, rows);
}

async function listBarOrdersHandler(req, res) {
  const orders = await listBarOrders();
  return ok(res, orders);
}

async function createBarOrderHandler(req, res) {
  const { client, table, nombre_personnes, moyen_paiement, items } = req.body || {};
  if (table === undefined || !Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('table et items sont requis');
  }

  const guestCount = Number(nombre_personnes || 1);
  if (!Number.isInteger(guestCount) || guestCount < 1) {
    throw ApiError.badRequest('nombre_personnes doit être un entier positif');
  }
  const allowedPayments = ['ESPECES', 'CARTE', 'TPE', 'CREDIT', 'EURO', 'ORANGE_MONEY', 'MVOLA', 'DOLLAR', 'VIREMENT', 'CHEQUE'];
  if (moyen_paiement && !allowedPayments.includes(moyen_paiement)) {
    throw ApiError.badRequest('Mode de paiement invalide');
  }
  const order = await createBarOrder({ clientName: client || 'Client anonyme', tableId: table, nombrePersonnes: guestCount, moyenPaiement: moyen_paiement, items });
  return created(res, order);
}

async function deleteBarOrderHandler(req, res) {
  const deleted = await deleteBarOrder(req.params.id);
  if (!deleted) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, { message: 'Commande supprimée' });
}

async function updateBarOrderStatusHandler(req, res) {
  const { statut } = req.body || {};
  const order = await updateBarOrderStatus(req.params.id, statut);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, order);
}

module.exports = {
  tablesCrud, cashiersCrud, sessionsCrud, productsCrud,
  tablesStatsHandler, openCashierHandler, closeCashierHandler,
  cashierStatusHandler, openSessionsHandler, sessionStatsHandler,
  currentSessionHandler, getBarStockHandler,
  addBarStockHandler, updateBarStockHandler, deleteBarStockHandler,
  addTransactionHandler, latestTransactionsByProductHandler, listTransactionsHandler,
  listBarOrdersHandler, createBarOrderHandler, deleteBarOrderHandler, updateBarOrderStatusHandler,
};
