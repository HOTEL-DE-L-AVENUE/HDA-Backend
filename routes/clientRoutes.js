// routes/clientRoutes.js
const express = require('express');
const ctrl = require('../controllers/clientController');
const { createCrudRouter } = require('./routeFactory');

const router = express.Router();

// Routes spécifiques AVANT les routes génériques /:id pour éviter les conflits
router.get('/search', ctrl.searchClients);              // GET /api/clients/search?q=
router.get('/:id/full', ctrl.getOneWithAccount);         // GET /api/clients/:id/full (client + solde)
router.get('/:id/account', ctrl.getAccount);             // GET /api/clients/:id/account
router.post('/:id/account/credit', ctrl.creditAccount);  // POST /api/clients/:id/account/credit
router.post('/:id/account/debit', ctrl.debitAccount);    // POST /api/clients/:id/account/debit
router.get('/:id/loyalty', ctrl.loyaltyHistory);         // GET /api/clients/:id/loyalty

// CRUD standard sur /api/clients
router.use('/', createCrudRouter(ctrl.clientsCrud));

module.exports = router;
