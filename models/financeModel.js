// models/financeModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const Invoices = createCrudModel({
  table: 'invoices', pk: 'id',
  fields: ['client_id', 'montant_total', 'statut'],
  sortable: ['id', 'montant_total', 'statut'],
});

const InvoiceItems = createCrudModel({
  table: 'invoice_items', pk: 'id',
  fields: ['invoice_id', 'description', 'montant'],
  sortable: ['id'],
});

const Payments = createCrudModel({
  table: 'payments', pk: 'id',
  fields: ['client_id', 'invoice_id', 'montant', 'moyen_paiement'],
  sortable: ['id', 'montant'],
});

const FinancialTransactions = createCrudModel({
  table: 'financial_transactions', pk: 'id',
  fields: ['client_id', 'module', 'type_flux', 'montant', 'reference_id', 'description', 'created_at'],
  sortable: ['id', 'created_at', 'module', 'montant'],
});

// --- Logique métier -------------------------------------------------------

// Crée une facture + ses lignes ; le montant_total est recalculé à partir des lignes.
async function createInvoiceWithItems({ clientId, items }) {
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, it) => sum + Number(it.montant), 0);
    const [inv] = await conn.query(
      `INSERT INTO invoices (client_id, montant_total, statut) VALUES (?, ?, 'EN_ATTENTE')`,
      [clientId, montantTotal]
    );
    const invoiceId = inv.insertId;
    for (const it of items) {
      await conn.query('INSERT INTO invoice_items (invoice_id, description, montant) VALUES (?, ?, ?)', [invoiceId, it.description, it.montant]);
    }
    const [row] = await conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
    return row[0];
  });
}

// Enregistre un paiement sur une facture, et bascule le statut de la facture
// à "PAYEE" si le cumul des paiements couvre le montant total.
async function recordPayment({ clientId, invoiceId, montant, moyenPaiement }) {
  return withTransaction(async (conn) => {
    const [invRows] = await conn.query('SELECT * FROM invoices WHERE id = ? FOR UPDATE', [invoiceId]);
    const invoice = invRows[0];
    if (!invoice) throw new Error(`Facture #${invoiceId} introuvable`);

    const [pay] = await conn.query(
      'INSERT INTO payments (client_id, invoice_id, montant, moyen_paiement) VALUES (?, ?, ?, ?)',
      [clientId, invoiceId, montant, moyenPaiement]
    );

    const [[sumRow]] = await conn.query(
      'SELECT COALESCE(SUM(montant), 0) AS total_paye FROM payments WHERE invoice_id = ?',
      [invoiceId]
    );
    const nouveauStatut = Number(sumRow.total_paye) >= Number(invoice.montant_total) ? 'PAYEE' : 'PARTIELLE';
    await conn.query('UPDATE invoices SET statut = ? WHERE id = ?', [nouveauStatut, invoiceId]);

    await conn.query(
      `INSERT INTO financial_transactions (client_id, module, type_flux, montant, reference_id, description, created_at)
       VALUES (?, 'FACTURATION', 'ENTREE', ?, ?, ?, NOW())`,
      [clientId, montant, invoiceId, `Paiement facture #${invoiceId}`]
    );

    const [row] = await conn.query('SELECT * FROM payments WHERE id = ?', [pay.insertId]);
    return { payment: row[0], invoiceStatus: nouveauStatut };
  });
}

async function invoiceWithItemsAndPayments(invoiceId) {
  const [invRows] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  if (!invRows[0]) return null;
  const [items] = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = ?', [invoiceId]);
  const [payments] = await pool.query('SELECT * FROM payments WHERE invoice_id = ?', [invoiceId]);
  return { ...invRows[0], items, payments };
}

// Relevé consolidé multi-module pour un client (vision 360°, tous modules confondus)
async function clientFinancialStatement(clientId) {
  const [rows] = await pool.query(
    `SELECT module, type_flux, montant, reference_id, description, created_at
     FROM financial_transactions WHERE client_id = ? ORDER BY created_at DESC`,
    [clientId]
  );
  return rows;
}

// Totaux issus du même grand livre que l'historique. Les valeurs de type_flux
// ont des suffixes selon le module (ex. ENTREE_CAISSE_CASINO) : il faut donc
// les reconnaître par préfixe, et non uniquement par égalité stricte.
async function financialSummary() {
  const [rows] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN UPPER(type_flux) LIKE 'ENTREE%' THEN montant ELSE 0 END), 0) AS totalRevenu,
       COALESCE(SUM(CASE WHEN UPPER(type_flux) LIKE 'SORTIE%' THEN montant ELSE 0 END), 0) AS totalDepenses
     FROM financial_transactions`
  );
  const [modules] = await pool.query(
    `SELECT
       LOWER(module) AS module,
       COALESCE(SUM(CASE WHEN UPPER(type_flux) LIKE 'ENTREE%' THEN montant ELSE 0 END), 0) AS entrees,
       COALESCE(SUM(CASE WHEN UPPER(type_flux) LIKE 'SORTIE%' THEN montant ELSE 0 END), 0) AS sorties
     FROM financial_transactions
     GROUP BY LOWER(module)
     ORDER BY module`
  );
  const totals = rows[0];
  return {
    totalRevenu: Number(totals.totalRevenu),
    totalDepenses: Number(totals.totalDepenses),
    soldeGlobal: Number(totals.totalRevenu) - Number(totals.totalDepenses),
    modules: modules.map((row) => ({
      module: row.module || 'general',
      entrees: Number(row.entrees),
      sorties: Number(row.sorties),
      solde: Number(row.entrees) - Number(row.sorties),
    })),
  };
}

module.exports = {
  Invoices, InvoiceItems, Payments, FinancialTransactions,
  createInvoiceWithItems, recordPayment, invoiceWithItemsAndPayments, clientFinancialStatement, financialSummary,
};
