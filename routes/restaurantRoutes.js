// routes/restaurantRoutes.js
const express = require('express');
const ctrl = require('../controllers/restaurantController');
const { createCrudRouter } = require('./routeFactory');
const stockCtrl = require('../controllers/stockController');

const router = express.Router();

// Stock restaurant — mêmes données que le module stock, avec les libellés nécessaires à l'interface.
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
router.use('/tables', createCrudRouter(ctrl.tablesCrud));

router.post('/orders', ctrl.createOrderHandler);              // POST /api/restaurant/orders (avec lignes)
router.get('/orders/in-progress', ctrl.ordersInProgressHandler); // GET /api/restaurant/orders/in-progress
router.get('/orders/:id/detail', ctrl.orderDetailHandler);    // GET /api/restaurant/orders/:id/detail
router.use('/orders', createCrudRouter(ctrl.ordersCrud));
router.use('/order-items', createCrudRouter(ctrl.orderItemsCrud));

router.get('/recipes/:id/requirements', ctrl.recipeRequirementsHandler); // GET /api/restaurant/recipes/:id/requirements?portions=
router.use('/recipes', createCrudRouter(ctrl.recipesCrud));
router.use('/recipe-items', createCrudRouter(ctrl.recipeItemsCrud));

router.use('/cashiers', createCrudRouter(ctrl.cashiersCrud));
router.use('/sessions', createCrudRouter(ctrl.sessionsCrud));

module.exports = router;
