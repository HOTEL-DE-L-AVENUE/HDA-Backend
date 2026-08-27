// routes/stockRoutes.js
const express = require('express');
const ctrl = require('../controllers/stockController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth);
const managementRoles = requireRole('admin', 'manager', 'stock_manager');

router.delete('/stocks/:id', managementRoles, ctrl.stocksCrud.remove);  // DELETE /api/stock/stocks/:id
router.use('/categories', managementRoles, createCrudRouter(ctrl.categoriesCrud));
router.use('/subcategories', managementRoles, createCrudRouter(ctrl.subcategoriesCrud));
router.use('/product-types', managementRoles, createCrudRouter(ctrl.productTypesCrud));
router.use('/units', managementRoles, createCrudRouter(ctrl.unitsCrud));
router.use('/products', managementRoles, createCrudRouter(ctrl.productsCrud));
router.use('/locations', managementRoles, createCrudRouter(ctrl.stockLocationsCrud));

router.get('/alerts/low-stock', ctrl.lowStockHandler);            // GET /api/stock/alerts/low-stock?threshold=
router.get('/products/:id/stock', ctrl.stockByProductHandler);    // GET /api/stock/products/:id/stock
router.get('/stocks/with-products', ctrl.getProductsWithStockHandler); // GET /api/stock/stocks/with-products?location_id=
router.use('/stocks', createCrudRouter(ctrl.stocksCrud));

router.post('/movements', managementRoles, ctrl.movementHandler);                  // POST /api/stock/movements
router.use('/movements', managementRoles, createCrudRouter(ctrl.stockMovementsCrud));

router.post('/consume-portion', managementRoles, ctrl.consumePortionHandler);       // POST /api/stock/consume-portion

router.use('/suppliers', managementRoles, createCrudRouter(ctrl.suppliersCrud));

router.post('/purchases', managementRoles, ctrl.createPurchaseHandler);            // POST /api/stock/purchases (avec lignes + réception auto)
router.use('/purchases', managementRoles, createCrudRouter(ctrl.purchasesCrud));
router.use('/purchase-items', managementRoles, createCrudRouter(ctrl.purchaseItemsCrud));

module.exports = router;
