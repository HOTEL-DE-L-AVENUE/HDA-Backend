const { createCrudModel } = require('./crudFactory');
const { withTransaction } = require('../config/db');
const stockModel = require('./stockModel');

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
  const nom = String(data.nom || '').trim();
  const categorie = String(data.categorie || data.category || 'Bar').trim();
  const prix = Number(data.prix ?? data.prixUnitaire ?? data.prix_unitaire ?? data.price ?? 0);
  const alcool = data.alcool === false || data.alcool === 0 ? 0 : 1;
  const unite = String(data.unite || 'unités').trim();
  const quantite = Number(data.quantite ?? 0);
  const seuil_minimum = Number(data.seuil_minimum ?? data.seuilMinimum ?? 5);
  const ingredients = String(data.ingredients || '').trim();

  if (!nom) throw new Error('Le nom du produit est requis');
  if (![prix, quantite, seuil_minimum].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error('Le prix, la quantité et le seuil doivent être des nombres positifs');
  }

  return withTransaction(async (conn) => {
    const [result] = await conn.query(
      'INSERT INTO bar_products (nom, ingredients, prix, categorie, alcool, type_produit, source_module) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nom, ingredients, Number.isFinite(prix) ? prix : 0, categorie, alcool, 'PRODUIT_FINI', 'BAR']
    );
    const productId = result.insertId;
    await conn.query(
      'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, 0, ?, ?)',
      [productId, Number.isFinite(seuil_minimum) ? seuil_minimum : 5, unite]
    );
    if (quantite > 0) {
      await stockModel.recordBarMovement({
        productId,
        locationId: 3,
        type: 'ENTREE',
        quantite,
        sourceModule: 'STOCK_MANUEL',
        motif: 'Création produit bar',
        allowNegative: false,
        conn,
      });
    }
    return { id: productId, nom, categorie, prix: Number.isFinite(prix) ? prix : 0, quantite: Number.isFinite(quantite) ? quantite : 0, seuil_minimum: Number.isFinite(seuil_minimum) ? seuil_minimum : 5, unite, ingredients, alcool };
  });
}

async function updateBarProductWithStock(id, data) {
  const nom = String(data.nom || '').trim();
  const categorie = String(data.categorie || data.category || 'Bar').trim();
  const prix = Number(data.prix ?? data.prixUnitaire ?? data.prix_unitaire ?? data.price ?? 0);
  const alcool = data.alcool === false || data.alcool === 0 ? 0 : 1;
  const unite = String(data.unite || 'unités').trim();
  const quantite = Number(data.quantite ?? 0);
  const seuil_minimum = Number(data.seuil_minimum ?? data.seuilMinimum ?? 5);
  const ingredients = String(data.ingredients || '').trim();

  if (!nom) throw new Error('Le nom du produit est requis');
  if (![prix, quantite, seuil_minimum].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error('Le prix, la quantité et le seuil doivent être des nombres positifs');
  }

  return withTransaction(async (conn) => {
    const [products] = await conn.query('SELECT id FROM bar_products WHERE id = ? FOR UPDATE', [id]);
    if (!products.length) throw new Error(`Produit bar #${id} introuvable`);

    await conn.query(
      'UPDATE bar_products SET nom=?, ingredients=?, prix=?, categorie=?, alcool=?, type_produit=?, source_module=? WHERE id=?',
      [nom, ingredients, Number.isFinite(prix) ? prix : 0, categorie, alcool, 'PRODUIT_FINI', 'BAR', id]
    );
    const [[currentStock]] = await conn.query(
      'SELECT quantite FROM bar_stock WHERE product_id = ? FOR UPDATE',
      [id]
    );
    const currentQuantity = Number(currentStock?.quantite || 0);
    await conn.query(
      'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, 0, ?, ?) ON DUPLICATE KEY UPDATE seuil_minimum=VALUES(seuil_minimum), unite=VALUES(unite)',
      [id, Number.isFinite(seuil_minimum) ? seuil_minimum : 5, unite]
    );
    if (quantite !== currentQuantity) {
      const difference = quantite - currentQuantity;
      await stockModel.recordBarMovement({
        productId: id,
        locationId: 3,
        type: difference > 0 ? 'ENTREE' : 'SORTIE',
        quantite: Math.abs(difference),
        sourceModule: 'STOCK_MANUEL',
        motif: 'Modification depuis la fiche produit Bar',
        allowNegative: false,
        conn,
      });
    }
    return { id, nom, categorie, prix: Number.isFinite(prix) ? prix : 0, quantite: Number.isFinite(quantite) ? quantite : 0, seuil_minimum: Number.isFinite(seuil_minimum) ? seuil_minimum : 5, unite, ingredients, alcool };
  });
}

async function deleteBarProductWithStock(id) {
  return withTransaction(async (conn) => {
    const [products] = await conn.query('SELECT id, nom FROM bar_products WHERE id = ? FOR UPDATE', [id]);
    if (!products.length) throw new Error(`Produit bar #${id} introuvable`);

    const [[sales]] = await conn.query(
      'SELECT COUNT(*) AS total FROM bar_transactions WHERE product_id = ?',
      [id]
    );
    if (Number(sales.total) > 0) {
      throw new Error(
        `« ${products[0].nom} » a déjà été vendu : mettez sa quantité à 0 au lieu de le supprimer, pour conserver l'historique des ventes.`
      );
    }

    await conn.query('DELETE FROM bar_stock_movements WHERE product_id = ?', [id]);
    await conn.query('DELETE FROM bar_stock WHERE product_id = ?', [id]);
    await conn.query('DELETE FROM bar_products WHERE id = ?', [id]);
    return { id };
  });
}

module.exports = {
  barProducts,
  getBarProductsWithStock,
  addBarProductWithStock,
  updateBarProductWithStock,
  deleteBarProductWithStock,
};