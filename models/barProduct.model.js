const { createCrudModel } = require('./crudFactory');

const barProducts = createCrudModel({
  table: 'bar_products',
  pk: 'id',
  fields: ['nom', 'ingredients', 'prix', 'categorie', 'alcool', 'type_produit', 'source_module'],
  sortable: ['id', 'nom', 'categorie'],
});

async function getBarProductsWithStock() {
  const pool = require('../config/db').pool;
  const [rows] = await pool.query(`
    SELECT bp.*, bs.product_id, bs.quantite, bs.seuil_minimum, bs.unite
    FROM bar_products bp
    LEFT JOIN bar_stock bs ON bs.product_id = bp.id
    ORDER BY bp.id DESC
  `);
  return rows;
}

async function addBarProductWithStock(data) {
  const pool = require('../config/db').pool;
  const { nom, categorie, prix, alcool, unite, quantite, seuil_minimum, ingredients } = data;
  const result = await pool.query(
    'INSERT INTO bar_products (nom, ingredients, prix, categorie, alcool, type_produit, source_module) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nom, ingredients || '', prix || 0, categorie || 'Bar', alcool !== false ? 1 : 0, 'PRODUIT_FINI', 'BAR']
  );
  const productId = result.insertId;
  await pool.query(
    'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?)',
    [productId, quantite || 0, seuil_minimum || 5, unite || 'unités']
  );
  return { id: productId, ...data };
}

async function updateBarProductWithStock(id, data) {
  const pool = require('../config/db').pool;
  const { nom, categorie, prix, alcool, unite, quantite, seuil_minimum, ingredients } = data;
  await pool.query(
    'UPDATE bar_products SET nom=?, ingredients=?, prix=?, categorie=?, alcool=?, type_produit=?, source_module=? WHERE id=?',
    [nom, ingredients || '', prix || 0, categorie || 'Bar', alcool !== false ? 1 : 0, 'PRODUIT_FINI', 'BAR', id]
  );
  await pool.query(
    'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantite=VALUES(quantite), seuil_minimum=VALUES(seuil_minimum), unite=VALUES(unite)',
    [id, quantite || 0, seuil_minimum || 5, unite || 'unités']
  );
  return { id, ...data };
}

async function deleteBarProductWithStock(id) {
  const pool = require('../config/db').pool;
  await pool.query('DELETE FROM bar_stock WHERE product_id = ?', [id]);
  await pool.query('DELETE FROM bar_products WHERE id = ?', [id]);
  return { id };
}

module.exports = {
  barProducts,
  getBarProductsWithStock,
  addBarProductWithStock,
  updateBarProductWithStock,
  deleteBarProductWithStock,
};