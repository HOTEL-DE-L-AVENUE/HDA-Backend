// routes/barRoutes.js
const express = require('express');
const ctrl = require('../controllers/barController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const managementRoles = requireRole('admin', 'manager', 'stock_manager');
const adminOnly = requireRole('admin');
const cashierRoles = requireRole('admin', 'manager', 'caisse', 'caissier');
	const orderRoles = requireRole('admin', 'manager', 'water', 'barman', 'hotesse', 'serveur');
	const createOrderRoles = requireRole('admin', 'manager', 'caisse', 'caissier', 'water', 'barman', 'hotesse', 'serveur');
const tableRoles = requireRole('admin', 'manager', 'stock_manager', 'water', 'barman', 'caisse', 'caissier');

const orderStatusRoles = (req, res, next) => {
	const middleware = req.body?.statut === 'ENCAISSEE'
		? requireRole('admin', 'manager', 'caisse', 'caissier')
		: orderRoles;
	return middleware(req, res, next);
};

router.use(requireAuth, (req, res, next) => {
	const role = String(req.user?.role || '').toLowerCase();
	if (!['serveur', 'caisse', 'caissier'].includes(role)) return next();
	let modules = req.user?.module;
	if (typeof modules === 'string') {
		try { modules = JSON.parse(modules); } catch { modules = modules.split(',').map((item) => item.trim()); }
	}
	if (!Array.isArray(modules)) modules = [];
	modules = modules.map((item) => typeof item === 'string' ? item : item?.id).filter(Boolean);
	const canReadRestaurantDrinkMenu = role === 'serveur'
		&& modules.includes('restaurant')
		&& req.method === 'GET'
		&& /^\/products(?:\/\d+)?$/.test(req.path);
	if (!modules.includes('bar') && !canReadRestaurantDrinkMenu) return next(require('../utils/ApiError').forbidden('AccÃ¨s au menu des boissons refusÃ©'));
	const method = req.method;
	const path = req.path;
	if (role === 'caisse' || role === 'caissier') {
		if (method === 'GET' && ['/products', '/stock', '/tables', '/orders', '/transactions', '/sessions/open', '/cashier-status'].includes(path)) return next();
		if (method === 'POST' && path === '/orders') return next();
		if (method === 'PUT' && /^\/orders\/\d+\/status$/.test(path)) return next();
		if (method === 'POST' && ['/orders/close-all', '/sessions/open', '/sessions/close'].includes(path)) return next();
		return next(require('../utils/ApiError').forbidden('Le rÃ´le caisse est limitÃ© aux chiffres et aux opÃ©rations dâ€™encaissement du Bar'));
	}
	const canViewProducts = method === 'GET' && (/^\/products(?:\/\d+)?$/.test(path) || path === '/stock' || path === '/tables');
	const canManageOrders = /^\/orders(?:\/\d+)?(?:\/status)?$/.test(path) && (
		method === 'GET' || method === 'POST' && path === '/orders' || method === 'PUT'
	);
	if (canViewProducts || canManageOrders) return next();
	return next(require('../utils/ApiError').forbidden('Le rÃ´le serveur est limitÃ© aux produits et aux commandes'));
});

// Stock bar
router.get('/stock', ctrl.getBarStockHandler);
router.post('/stock', managementRoles, ctrl.addBarStockHandler);
router.put('/stock/:id', managementRoles, ctrl.updateBarStockHandler);
router.delete('/stock/:id', managementRoles, ctrl.deleteBarStockHandler);

// Products / Cocktails
router.get('/products', ctrl.productsCrud.list);
router.get('/products/:id', ctrl.productsCrud.getOne);
router.use('/products', managementRoles, createCrudRouter(ctrl.productsCrud));

// Ã‰quipements propres au Bar â€” accÃ¨s rÃ©servÃ© Ã  l'administrateur.
router.use('/equipments', adminOnly, createCrudRouter(ctrl.barEquipmentsCrud));

// Tables â€” stats route BEFORE CRUD so it doesn't get caught by/:id wildcard
router.get('/tables/stats', ctrl.tablesStatsHandler);
router.get('/tables', ctrl.tablesCrud.list);
router.get('/tables/:id', ctrl.tablesCrud.getOne);
router.post('/tables', tableRoles, ctrl.tablesCrud.create);
router.put('/tables/:id', managementRoles, ctrl.tablesCrud.update);
router.delete('/tables/:id', managementRoles, ctrl.tablesCrud.remove);

// Cashiers
router.get('/cashier-status', ctrl.cashierStatusHandler);
router.get('/cashiers', ctrl.cashiersCrud.list);
router.get('/cashiers/:id', ctrl.cashiersCrud.getOne);
router.use('/cashiers', managementRoles, createCrudRouter(ctrl.cashiersCrud));

// Sessions â€” all specific routes BEFORE CRUD middleware
router.post('/sessions/open', cashierRoles, ctrl.openCashierHandler);
router.post('/sessions/close', cashierRoles, ctrl.closeCashierHandler);
router.get('/sessions/open', ctrl.openSessionsHandler);
router.get('/sessions/stats', ctrl.sessionStatsHandler);
router.get('/sessions', ctrl.sessionsCrud.list);
router.get('/sessions/:id', ctrl.currentSessionHandler);
router.use('/sessions', managementRoles, createCrudRouter(ctrl.sessionsCrud));

// Commandes bar
router.get('/history', adminOnly, ctrl.listBarHistoryHandler);
router.get('/reports/:date', ctrl.getBarReportHandler);
router.post('/reports', orderRoles, ctrl.saveBarReportHandler);

// Historique produits (admin uniquement)
router.get('/product-history', adminOnly, ctrl.getProductHistoryHandler);

router.get('/orders', ctrl.listBarOrdersHandler);
router.post('/orders', createOrderRoles, ctrl.createBarOrderHandler);
router.put('/orders/:id', orderRoles, ctrl.updateBarOrderHandler);
router.put('/orders/:id/status', orderStatusRoles, ctrl.updateBarOrderStatusHandler);
router.post('/orders/close-all', cashierRoles, ctrl.closeAllBarOrdersHandler);
router.delete('/orders/:id', adminOnly, ctrl.deleteBarOrderHandler);

// Transactions â€” commandes caisse
router.get('/transactions', ctrl.listTransactionsHandler);
router.post('/transactions', cashierRoles, ctrl.addTransactionHandler);
router.get('/transactions/latest', ctrl.latestTransactionsByProductHandler);

module.exports = router;
