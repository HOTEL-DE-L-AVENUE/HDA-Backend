// routes/restaurantRoutes.js
const express = require('express');
const ctrl = require('../controllers/restaurantController');
const { createCrudRouter } = require('./routeFactory');

const router = express.Router();

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
