// models/stockModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const Categories = createCrudModel({
  table: 'categories', pk: 'id', fields: ['nom'], sortable: ['id', 'nom'],
});

const ProductTypes = createCrudModel({
  table: 'product_types', pk: 'id',
  fields: ['nom', 'description', 'actif'],
  sortable: ['id', 'nom', 'actif'],
});

const Units = createCrudModel({
  table: 'units', pk: 'id', fields: ['code', 'nom'], sortable: ['id', 'nom'],
});

const Products = createCrudModel({
  table: 'products', pk: 'id',
  fields: ['category_id', 'code', 'nom', 'unite', 'prix_achat', 'prix_vente', 'actif', 'type_produit'],
  sortable: ['id', 'nom', 'code', 'prix_vente'],
});

const StockLocations = createCrudModel({
  table: 'stock_locations', pk: 'id', fields: ['nom'], sortable: ['id', 'nom'],
});

const Stocks = createCrudModel({
  table: 'stocks', pk: 'id',
  fields: ['product_id', 'location_id', 'quantite'],
  sortable: ['id', 'quantite'],
});

// Custom method to get stocks with product information
async function getProductsWithStock(locationId = null) {
  let sql = `
    SELECT s.*, p.nom as product_nom, p.unite as product_unite, p.code as product_code,
           p.prix_achat as prix
    FROM stocks s
    JOIN products p ON p.id = s.product_id
  `;
  const params = [];
  
  if (locationId) {
    sql += ' WHERE s.location_id = ?';
    params.push(locationId);
  }
  
  sql += ' ORDER BY s.quantite ASC';
  
  const [rows] = await pool.query(sql, params);
  return rows;
}

const StockMovements = createCrudModel({
  table: 'stock_movements', pk: 'id',
  fields: ['product_id', 'location_id', 'type_mouvement', 'quantite', 'source_module', 'reference_id', 'created_at'],
  sortable: ['id', 'created_at', 'type_mouvement'],
});

const Suppliers = createCrudModel({
  table: 'suppliers', pk: 'id', fields: ['nom', 'telephone', 'email'], sortable: ['id', 'nom'],
});

const Purchases = createCrudModel({
  table: 'purchases', pk: 'id',
  fields: ['supplier_id', 'montant_total', 'statut'],
  sortable: ['id', 'montant_total', 'statut'],
});

const PurchaseItems = createCrudModel({
  table: 'purchase_items', pk: 'id',
  fields: ['purchase_id', 'product_id', 'quantite', 'prix_unitaire'],
  sortable: ['id'],
});

// --- Logique métier -------------------------------------------------------

// Enregistre un mouvement de stock et met à jour la table `stocks` en conséquence.
// type: 'ENTREE' | 'SORTIE' | 'AJUSTEMENT' (le signe de quantite peut aussi porter l'info)
async function recordMovement({ productId, locationId, type, quantite, sourceModule, referenceId }) {
  return withTransaction(async (conn) => {
    const signedQty = type === 'SORTIE' ? -Math.abs(quantite) : Math.abs(quantite);

    const [stockRows] = await conn.query(
      'SELECT * FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
      [productId, locationId]
    );
    if (stockRows[0]) {
      await conn.query('UPDATE stocks SET quantite = quantite + ? WHERE id = ?', [signedQty, stockRows[0].id]);
    } else {
      await conn.query('INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, ?, ?)', [productId, locationId, signedQty]);
    }

    const [mv] = await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [productId, locationId, type, quantite, sourceModule || null, referenceId || null]
    );
    const [row] = await conn.query('SELECT * FROM stock_movements WHERE id = ?', [mv.insertId]);
    return row[0];
  });
}

// Crée un achat fournisseur + ses lignes, et alimente le stock à réception.
async function createPurchaseWithItems({ supplierId, locationId, items, sourceModule = 'GENERAL' }) {
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, it) => sum + Number(it.quantite) * Number(it.prix_unitaire), 0);
    const [purchase] = await conn.query(
      `INSERT INTO purchases (supplier_id, montant_total, statut) VALUES (?, ?, 'RECU')`,
      [supplierId, montantTotal]
    );
    const purchaseId = purchase.insertId;

    for (const it of items) {
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
        [purchaseId, it.product_id, it.quantite, it.prix_unitaire]
      );
      const [stockRows] = await conn.query(
        'SELECT * FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
        [it.product_id, locationId]
      );
      if (stockRows[0]) {
        await conn.query('UPDATE stocks SET quantite = quantite + ? WHERE id = ?', [it.quantite, stockRows[0].id]);
      } else {
        await conn.query('INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, ?, ?)', [it.product_id, locationId, it.quantite]);
      }
      await conn.query(
        `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
         VALUES (?, ?, 'ENTREE', ?, 'ACHAT', ?, NOW())`,
        [it.product_id, locationId, it.quantite, purchaseId]
      );
    }

    const [row] = await conn.query('SELECT * FROM purchases WHERE id = ?', [purchaseId]);
    return row[0];
  });
}

// Produits sous un seuil donné (alerte réappro)
async function lowStock(threshold = 10) {
  const [rows] = await pool.query(
    `SELECT p.id, p.nom, p.code, s.location_id, s.quantite
     FROM stocks s JOIN products p ON p.id = s.product_id
     WHERE s.quantite < ? ORDER BY s.quantite ASC`,
    [threshold]
  );
  return rows;
}

async function stockByProduct(productId) {
  const [rows] = await pool.query(
    `SELECT s.*, sl.nom AS location_nom FROM stocks s
     JOIN stock_locations sl ON sl.id = s.location_id
     WHERE s.product_id = ?`,
    [productId]
  );
  return rows;
}

module.exports = {
  Categories, ProductTypes, Units, Products, StockLocations, Stocks, StockMovements,
  Suppliers, Purchases, PurchaseItems,
  recordMovement, createPurchaseWithItems, lowStock, stockByProduct, getProductsWithStock,
};
