// routes/stockRoutes.js
const express = require('express');
const ctrl = require('../controllers/stockController');
const { createCrudRouter } = require('./routeFactory');

const router = express.Router();

router.delete('/stocks/:id', ctrl.stocksCrud.remove);  // DELETE /api/stock/stocks/:id
router.use('/categories', createCrudRouter(ctrl.categoriesCrud));
router.use('/product-types', createCrudRouter(ctrl.productTypesCrud));
router.use('/units', createCrudRouter(ctrl.unitsCrud));
router.use('/products', createCrudRouter(ctrl.productsCrud));
router.use('/locations', createCrudRouter(ctrl.stockLocationsCrud));

router.get('/alerts/low-stock', ctrl.lowStockHandler);            // GET /api/stock/alerts/low-stock?threshold=
router.get('/products/:id/stock', ctrl.stockByProductHandler);    // GET /api/stock/products/:id/stock
router.get('/stocks/with-products', ctrl.getProductsWithStockHandler); // GET /api/stock/stocks/with-products?location_id=
router.use('/stocks', createCrudRouter(ctrl.stocksCrud));

router.post('/movements', ctrl.movementHandler);                  // POST /api/stock/movements
router.use('/movements', createCrudRouter(ctrl.stockMovementsCrud));

router.use('/suppliers', createCrudRouter(ctrl.suppliersCrud));

router.post('/purchases', ctrl.createPurchaseHandler);            // POST /api/stock/purchases (avec lignes + réception auto)
router.use('/purchases', createCrudRouter(ctrl.purchasesCrud));
router.use('/purchase-items', createCrudRouter(ctrl.purchaseItemsCrud));

module.exports = router;
