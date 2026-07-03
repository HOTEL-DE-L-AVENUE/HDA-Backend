// controllers/financeController.js
const finance = require('../models/financeModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

const invoicesCrud = createCrudController(finance.Invoices, { filterable: ['client_id', 'statut'] });
const invoiceItemsCrud = createCrudController(finance.InvoiceItems, { filterable: ['invoice_id'] });
const paymentsCrud = createCrudController(finance.Payments, { filterable: ['client_id', 'invoice_id'] });
const financialTransactionsCrud = createCrudController(finance.FinancialTransactions, { filterable: ['client_id', 'module', 'type_flux'] });

async function createInvoiceHandler(req, res) {
  const { client_id, items } = req.body;
  if (!items || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');
  const invoice = await finance.createInvoiceWithItems({ clientId: client_id, items });
  return created(res, invoice);
}

async function invoiceDetailHandler(req, res) {
  const invoice = await finance.invoiceWithItemsAndPayments(req.params.id);
  if (!invoice) throw ApiError.notFound(`Facture #${req.params.id} introuvable`);
  return ok(res, invoice);
}

async function recordPaymentHandler(req, res) {
  const { client_id, invoice_id, montant, moyen_paiement } = req.body;
  if (!invoice_id || !montant) throw ApiError.badRequest('invoice_id et montant sont requis');
  try {
    const result = await finance.recordPayment({ clientId: client_id, invoiceId: invoice_id, montant, moyenPaiement: moyen_paiement });
    return created(res, result);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }
}

async function clientStatementHandler(req, res) {
  const rows = await finance.clientFinancialStatement(req.params.clientId);
  return ok(res, rows);
}

module.exports = {
  invoicesCrud, invoiceItemsCrud, paymentsCrud, financialTransactionsCrud,
  createInvoiceHandler, invoiceDetailHandler, recordPaymentHandler, clientStatementHandler,
};
