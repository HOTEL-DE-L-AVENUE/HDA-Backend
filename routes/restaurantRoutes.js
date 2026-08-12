// routes/restaurantRoutes.js
const express = require('express');
const ctrl = require('../controllers/restaurantController');
const { createCrudRouter } = require('./routeFactory');
const stockCtrl = require('../controllers/stockController');

const router = express.Router();

// Stock restaurant - same data as stock module, with labels needed for the interface.
router.get('/stock', ctrl.restaurantStockHandler);
router.get('/stock/movements', ctrl.restaurantStockMovementsHandler);
router.post('/stock/adjust', ctrl.adjustRestaurantStockHandler);
router.use('/stock/locations', createCrudRouter(stockCtrl.stockLocationsCrud));
router.use('/products', createCrudRouter(stockCtrl.productsCrud));
router.use('/units', createCrudRouter(stockCtrl.unitsCrud));
router.use('/product-types', createCrudRouter(stockCtrl.productTypesCrud));
router.use('/categories', createCrudRouter(stockCtrl.categoriesCrud));
router.use('/suppliers', createCrudRouter(stockCtrl.suppliersCrud));
router.get('/purchases', ctrl.listRestaurantPurchasesHandler);
router.post('/purchases', ctrl.createRestaurantPurchaseHandler);
router.get('/purchases/:id', ctrl.restaurantPurchaseDetailHandler);

// Tables
router.use('/tables', createCrudRouter(ctrl.tablesCrud));

// Menu
router.get('/menu', ctrl.menuHandler);

// Orders - specific routes BEFORE CRUD
router.post('/orders', ctrl.createOrderHandler);
router.get('/orders/in-progress', ctrl.ordersInProgressHandler);
router.get('/orders/:id/detail', ctrl.orderDetailHandler);
router.put('/orders/:id/status', ctrl.updateOrderStatusHandler);
router.use('/orders', createCrudRouter(ctrl.ordersCrud));
router.use('/order-items', createCrudRouter(ctrl.orderItemsCrud));

// Recipes
router.get('/recipes/:id/requirements', ctrl.recipeRequirementsHandler);
router.use('/recipes', createCrudRouter(ctrl.recipesCrud));
router.use('/recipe-items', createCrudRouter(ctrl.recipeItemsCrud));

// Cashiers & Sessions
router.post('/cashier/open', ctrl.openCashierHandler);
router.post('/cashier/close', ctrl.closeCashierHandler);
router.get('/cashier/status', ctrl.cashierStatusHandler);
router.use('/cashiers', createCrudRouter(ctrl.cashiersCrud));
router.use('/sessions', createCrudRouter(ctrl.sessionsCrud));

// Payments
router.post('/payments', ctrl.processPaymentHandler);
router.post('/bill-to-room', ctrl.billToRoomHandler);

// Stats
router.get('/stats', ctrl.statsHandler);

module.exports = router;
