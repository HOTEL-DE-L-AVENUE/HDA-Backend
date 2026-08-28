// routes/financeRoutes.js
const express = require('express');
const ctrl = require('../controllers/financeController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth, requireRole } = require('../middlewares/auth');

const router = express.Router();
const managementRoles = requireRole('admin', 'manager');
const cashierRoles = requireRole('admin', 'manager', 'caisse', 'caissier');
router.use(requireAuth);

router.post('/invoices', managementRoles, ctrl.createInvoiceHandler);                 // POST /api/finance/invoices (avec lignes)
router.get('/invoices/:id/detail', ctrl.invoiceDetailHandler);       // GET  /api/finance/invoices/:id/detail
router.use('/invoices', managementRoles, createCrudRouter(ctrl.invoicesCrud));
router.use('/invoice-items', managementRoles, createCrudRouter(ctrl.invoiceItemsCrud));

router.post('/payments', cashierRoles, ctrl.recordPaymentHandler);                 // POST /api/finance/payments
router.use('/payments', managementRoles, createCrudRouter(ctrl.paymentsCrud));

router.get('/clients/:clientId/statement', ctrl.clientStatementHandler); // GET /api/finance/clients/:clientId/statement
router.get('/summary', ctrl.financialSummaryHandler);                   // GET /api/finance/summary
router.post('/transactions', cashierRoles, ctrl.createFinancialTransactionHandler);   // POST /api/finance/transactions
router.get('/transactions', ctrl.listFinancialTransactionsHandler);
router.use('/transactions', managementRoles, createCrudRouter(ctrl.financialTransactionsCrud));

module.exports = router;
