// routes/barRoutes.js
const express = require('express');
const ctrl = require('../controllers/barController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const managementRoles = requireRole('admin', 'manager', 'stock_manager');
const adminOnly = requireRole('admin');
const cashierRoles = requireRole('admin', 'manager', 'caisse', 'caissier', 'water');
const orderStatusRoles = (req, res, next) => {
	const middleware = req.body?.statut === 'ENCAISSEE'
		? requireRole('admin', 'caisse', 'caissier')
		: cashierRoles;
	return middleware(req, res, next);
};

router.use(requireAuth);

// Stock bar
router.get('/stock', ctrl.getBarStockHandler);
router.post('/stock', managementRoles, ctrl.addBarStockHandler);
router.put('/stock/:id', managementRoles, ctrl.updateBarStockHandler);
router.delete('/stock/:id', managementRoles, ctrl.deleteBarStockHandler);

// Products / Cocktails
router.get('/products', ctrl.productsCrud.list);
router.get('/products/:id', ctrl.productsCrud.getOne);
router.use('/products', managementRoles, createCrudRouter(ctrl.productsCrud));

// Tables — stats route BEFORE CRUD so it doesn't get caught by/:id wildcard
router.get('/tables/stats', ctrl.tablesStatsHandler);
router.get('/tables', ctrl.tablesCrud.list);
router.use('/tables', managementRoles, createCrudRouter(ctrl.tablesCrud));

// Cashiers
router.get('/cashier-status', ctrl.cashierStatusHandler);
router.use('/cashiers', managementRoles, createCrudRouter(ctrl.cashiersCrud));

// Sessions — all specific routes BEFORE CRUD middleware
router.post('/sessions/open', cashierRoles, ctrl.openCashierHandler);
router.post('/sessions/close', cashierRoles, ctrl.closeCashierHandler);
router.get('/sessions/open', ctrl.openSessionsHandler);
router.get('/sessions/stats', ctrl.sessionStatsHandler);
router.get('/sessions/:id', ctrl.currentSessionHandler);
router.use('/sessions', managementRoles, createCrudRouter(ctrl.sessionsCrud));

// Commandes bar
router.get('/orders', ctrl.listBarOrdersHandler);
router.post('/orders', cashierRoles, ctrl.createBarOrderHandler);
router.put('/orders/:id/status', orderStatusRoles, ctrl.updateBarOrderStatusHandler);
router.delete('/orders/:id', adminOnly, ctrl.deleteBarOrderHandler);

// Transactions — commandes caisse
router.get('/transactions', ctrl.listTransactionsHandler);
router.post('/transactions', cashierRoles, ctrl.addTransactionHandler);
router.get('/transactions/latest', ctrl.latestTransactionsByProductHandler);

module.exports = router;
