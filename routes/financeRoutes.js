// routes/financeRoutes.js
const express = require('express');
const ctrl = require('../controllers/financeController');
const { createCrudRouter } = require('./routeFactory');

const router = express.Router();

router.post('/invoices', ctrl.createInvoiceHandler);                 // POST /api/finance/invoices (avec lignes)
router.get('/invoices/:id/detail', ctrl.invoiceDetailHandler);       // GET  /api/finance/invoices/:id/detail
router.use('/invoices', createCrudRouter(ctrl.invoicesCrud));
router.use('/invoice-items', createCrudRouter(ctrl.invoiceItemsCrud));

router.post('/payments', ctrl.recordPaymentHandler);                 // POST /api/finance/payments
router.use('/payments', createCrudRouter(ctrl.paymentsCrud));

router.get('/clients/:clientId/statement', ctrl.clientStatementHandler); // GET /api/finance/clients/:clientId/statement
router.use('/transactions', createCrudRouter(ctrl.financialTransactionsCrud));

module.exports = router;
