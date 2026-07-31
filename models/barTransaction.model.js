const { createCrudModel } = require('./crudFactory');
const { pool } = require('../config/db');

// Keep installations created before these order columns compatible.
let schemaReady;

async function ensureBarTransactionsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const [columns] = await pool.query('SHOW COLUMNS FROM bar_transactions');
      const existing = new Set(columns.map((column) => column.Field));
      if (!existing.has('client_id')) await pool.query('ALTER TABLE bar_transactions ADD COLUMN client_id BIGINT UNSIGNED NULL AFTER session_id');
      if (!existing.has('table_id')) await pool.query('ALTER TABLE bar_transactions ADD COLUMN table_id BIGINT UNSIGNED NULL AFTER client_id');
      if (!existing.has('statut')) await pool.query("ALTER TABLE bar_transactions ADD COLUMN statut ENUM('EN_ATTENTE','EN_COURS','SERVIE','PAYEE','ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE' AFTER prix_unitaire");
      if (!existing.has('order_id')) await pool.query('ALTER TABLE bar_transactions ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER table_id');
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  return schemaReady;
}

const BarTransactions = createCrudModel({
  table: 'bar_transactions',
  pk: 'id',
  fields: ['session_id', 'product_id', 'quantite', 'prix_unitaire'],
  sortable: ['id', 'created_at'],
});

async function addTransaction({ session_id, product_id, quantite, prix_unitaire }) {
  const [result] = await pool.query(
    'INSERT INTO bar_transactions (session_id, product_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
    [session_id || null, product_id, quantite || 1, prix_unitaire]
  );
  return { id: result.insertId, session_id, product_id, quantite, prix_unitaire };
}

async function createOrder({ client_id, table_id, order_id, items, session_id, connection }) {
  await ensureBarTransactionsSchema();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const db = connection || pool;

  const transactionIds = [];
  for (const item of items || []) {
    const productId = item.product_id ?? item.id;
    const quantity = Number(item.quantite || 1);
    const unitPrice = Number(item.prix_unitaire ?? item.prix ?? 0);

    if (!productId) continue;

    const [result] = await db.query(
      'INSERT INTO bar_transactions (session_id, client_id, table_id, order_id, product_id, quantite, prix_unitaire, statut, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, \'EN_ATTENTE\', ?)',
      [session_id || null, client_id || null, table_id || null, order_id || null, productId, quantity, unitPrice, now]
    );
    transactionIds.push(result.insertId);
  }

  return { ids: transactionIds, client_id, table_id, items: (items || []).map((item) => ({
    product_id: item.product_id ?? item.id,
    quantite: Number(item.quantite || 1),
    prix_unitaire: Number(item.prix_unitaire ?? item.prix ?? 0),
  })), statut: 'EN_ATTENTE' };
}

module.exports = { BarTransactions, addTransaction, createOrder, ensureBarTransactionsSchema };