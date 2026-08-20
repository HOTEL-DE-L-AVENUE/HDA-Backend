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

// Indicateurs opérationnels : les commandes représentent les revenus et la
// valeur du stock disponible représente les sorties du module. Les achats ne
// sont volontairement pas additionnés ici, sinon la valeur du stock serait
// comptée deux fois.
async function financialSummary() {
  const modules = new Map([
    ['hebergement', { module: 'hebergement', entrees: 0, sorties: 0 }],
    ['hotel', { module: 'hotel', entrees: 0, sorties: 0 }],
    ['restaurant', { module: 'restaurant', entrees: 0, sorties: 0 }],
    ['bar', { module: 'bar', entrees: 0, sorties: 0 }],
    ['casino', { module: 'casino', entrees: 0, sorties: 0 }],
  ]);
  const normaliseModule = (value) => {
    const key = String(value || '').trim().toLowerCase();
    if (key.includes('restaurant')) return 'restaurant';
    if (key.includes('bar')) return 'bar';
    if (key.includes('casino')) return 'casino';
    if (key.includes('hotel') || key.includes('hôtel')) return 'hotel';
    if (key.includes('hebergement') || key.includes('hébergement')) return 'hebergement';
    return null;
  };
  const add = (module, field, amount) => {
    const key = normaliseModule(module);
    if (!key) return;
    const summary = modules.get(key);
    summary[field] += Number(amount) || 0;
  };

  const [orders] = await pool.query(
    `SELECT source_module AS module, COALESCE(SUM(montant_total), 0) AS montant
     FROM orders
      WHERE UPPER(COALESCE(statut, '')) IN ('PAYEE', 'PAYE')
     GROUP BY source_module`
  );
  orders.forEach((row) => add(row.module, 'entrees', row.montant));

  // Les flux Hébergement et Hôtel sont enregistrés directement dans le
  // grand livre financier (réservations et consommations minibar).
  const [hotelTransactions] = await pool.query(
    `SELECT UPPER(module) AS module, type_flux, COALESCE(SUM(montant), 0) AS montant
     FROM financial_transactions
     WHERE UPPER(module) IN ('HEBERGEMENT', 'HOTEL')
     GROUP BY UPPER(module), type_flux`
  );
  hotelTransactions.forEach((row) => {
    const module = String(row.module).toLowerCase();
    if (String(row.type_flux || '').toUpperCase().startsWith('ENTREE')) {
      add(module, 'entrees', row.montant);
    } else if (String(row.type_flux || '').toUpperCase().startsWith('SORTIE')) {
      add(module, 'sorties', row.montant);
    }
  });

  // Les opérations Casino sont synchronisées directement dans le grand livre
  // financier avec des types ENTREE_CAISSE_CASINO ou SORTIE_CAISSE_CASINO.
  const [casinoTransactions] = await pool.query(
    `SELECT type_flux, COALESCE(SUM(montant), 0) AS montant
     FROM financial_transactions
     WHERE UPPER(module) = 'CASINO'
     GROUP BY type_flux`
  );
  casinoTransactions.forEach((row) => {
    if (String(row.type_flux || '').toUpperCase().startsWith('ENTREE')) {
      add('casino', 'entrees', row.montant);
    } else if (String(row.type_flux || '').toUpperCase().startsWith('SORTIE')) {
      add('casino', 'sorties', row.montant);
    }
  });

  // Le bar possède sa propre table de commandes dans certaines installations.
  const [[barOrdersTable]] = await pool.query("SHOW TABLES LIKE 'bar_orders'");
  const [[barStockTable]] = await pool.query("SHOW TABLES LIKE 'bar_stock'");
  if (barOrdersTable) {
    const [barOrders] = await pool.query(
      `SELECT COALESCE(SUM(montant_total), 0) AS montant
        FROM bar_orders WHERE UPPER(COALESCE(statut, '')) = 'ENCAISSEE'`
    );
    add('bar', 'entrees', barOrders[0]?.montant);
  }

  const [stockValues] = await pool.query(
    `SELECT sl.nom AS module, COALESCE(SUM(s.quantite * COALESCE(p.prix_achat, 0)), 0) AS montant
     FROM stocks s
     JOIN products p ON p.id = s.product_id
     JOIN stock_locations sl ON sl.id = s.location_id
     GROUP BY sl.id, sl.nom`
  );
  stockValues.forEach((row) => add(row.module, 'sorties', row.montant));

  // Le bar utilise ses propres tables de produits et de stock.
  if (barStockTable) {
    const [barStockValues] = await pool.query(
      `SELECT COALESCE(SUM(bs.quantite * COALESCE(bp.prix, 0)), 0) AS montant
       FROM bar_stock bs
       JOIN bar_products bp ON bp.id = bs.product_id`
    );
    add('bar', 'sorties', barStockValues[0]?.montant);
  }

  const moduleRows = [...modules.values()].map((row) => ({
    ...row,
    solde: row.entrees - row.sorties,
  }));
  const totalEntrees = moduleRows.reduce((sum, row) => sum + row.entrees, 0);
  const totalSorties = moduleRows.reduce((sum, row) => sum + row.sorties, 0);
  const beneficeNet = totalEntrees - totalSorties;
  return {
    totalEntrees,
    totalSorties,
    beneficeNet,
    totalRevenu: totalEntrees,
    totalDepenses: totalSorties,
    soldeGlobal: beneficeNet,
    modules: moduleRows,
  };
}

module.exports = {
  Invoices, InvoiceItems, Payments, FinancialTransactions,
  createInvoiceWithItems, recordPayment, invoiceWithItemsAndPayments, clientFinancialStatement, financialSummary,
};
