const { createCrudModel } = require('./crudFactory');

const BarTransactions = createCrudModel({
  table: 'bar_transactions',
  pk: 'id',
  fields: ['session_id', 'product_id', 'quantite', 'prix_unitaire'],
  sortable: ['id', 'created_at'],
});

async function addTransaction({ session_id, product_id, quantite, prix_unitaire }) {
  const { pool } = require('../config/db');
  const [result] = await pool.query(
    'INSERT INTO bar_transactions (session_id, product_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
    [session_id || null, product_id, quantite || 1, prix_unitaire]
  );
  return { id: result.insertId, session_id, product_id, quantite, prix_unitaire };
}

module.exports = { BarTransactions, addTransaction };