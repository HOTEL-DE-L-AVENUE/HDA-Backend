// models/stockModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const ApiError = require('../utils/ApiError');

const Categories = createCrudModel({
  table: 'categories', pk: 'id', fields: ['nom'], sortable: ['id', 'nom'],
});

const Subcategories = createCrudModel({
  table: 'subcategories', pk: 'id',
  fields: ['category_id', 'nom'],
  sortable: ['id', 'nom', 'category_id'],
  filterable: ['category_id'],
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
  fields: ['category_id', 'subcategory_id', 'code', 'nom', 'unite', 'prix_achat', 'prix_vente', 'actif', 'type_produit', 'portion_size', 'portion_unite', 'source_module'],
  sortable: ['id', 'nom', 'code', 'prix_vente'],
  filterable: ['category_id', 'subcategory_id', 'actif', 'type_produit'],
});

const StockLocations = createCrudModel({
  table: 'stock_locations', pk: 'id', fields: ['nom'], sortable: ['id', 'nom'],
});

const Stocks = createCrudModel({
  table: 'stocks', pk: 'id',
  fields: ['product_id', 'location_id', 'quantite', 'seuil_minimum', 'etat'],
  sortable: ['id', 'quantite'],
});

// Custom method to get stocks with product information
async function getProductsWithStock(locationId = null) {
  let sql = `
        SELECT s.*, p.nom as product_nom, p.unite as product_unite, p.code as product_code,
          p.prix_achat, p.prix_vente, p.prix_achat as prix, p.category_id, c.nom AS category_name,
          p.subcategory_id, p.type_produit
    FROM stocks s
    JOIN products p ON p.id = s.product_id
        LEFT JOIN categories c ON c.id = p.category_id
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
// New optional params: conn (use caller's transaction), motif, userId, allowNegative
const HOTEL_LOCATION_ID = 5;

async function recordHotelStockExpense(connection, { movementId, productId, quantite }) {
  const [[product]] = await connection.query(
    'SELECT nom, COALESCE(NULLIF(prix_achat, 0), prix_vente, 0) AS prix_unitaire FROM products WHERE id = ?',
    [productId]
  );
  const montant = Math.abs(Number(quantite)) * Number(product?.prix_unitaire || 0);
  if (!(montant > 0)) return;
  await connection.query(
    `INSERT IGNORE INTO financial_transactions
       (module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
     VALUES ('HOTEL', 'SORTIE', ?, ?, ?, ?, 'SYNCED', NOW())`,
    [montant, productId, `HOTEL-STOCK-ENTREE-${movementId}`,
      `Achats - Approvisionnement stock : ${product?.nom || `produit #${productId}`} (x${Math.abs(Number(quantite))})`]
  );
}

async function recordMovement({ productId, locationId, type, quantite, sourceModule, referenceId, conn = null, motif = null, userId = null, allowNegative = true }) {
  if (Number(locationId) === 5 && !Number.isInteger(Number(quantite))) {
    throw ApiError.badRequest('Les quantités du stock hôtel doivent être des nombres entiers');
  }
  const transactionFn = async (connection) => {
    const signedQty = type === 'SORTIE' ? -Math.abs(quantite) : Math.abs(quantite);
    // For AJUSTEMENT, respect the sign of quantite directly
    const effectiveSignedQty = type === 'AJUSTEMENT' ? Number(quantite) : signedQty;

    const [stockRows] = await connection.query(
      'SELECT * FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
      [productId, locationId]
    );
    
    let newQuantity;
    if (stockRows[0]) {
      newQuantity = Number(stockRows[0].quantite) + effectiveSignedQty;
      
      // Check for negative stock if not allowed
      if (!allowNegative && newQuantity < 0) {
        throw ApiError.badRequest(`Stock insuffisant : ${stockRows[0].quantite} disponible, ${Math.abs(effectiveSignedQty)} demandé`);
      }
      
      await connection.query('UPDATE stocks SET quantite = quantite + ? WHERE id = ?', [effectiveSignedQty, stockRows[0].id]);
    } else {
      newQuantity = effectiveSignedQty;
      
      // Check for negative stock if not allowed
      if (!allowNegative && newQuantity < 0) {
        throw ApiError.badRequest(`Stock insuffisant : 0 disponible, ${Math.abs(effectiveSignedQty)} demandé`);
      }
      
      await connection.query('INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, ?, ?)', [productId, locationId, newQuantity]);
    }

    const [mv] = await connection.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at, stock_after, motif, user_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
      [productId, locationId, type, quantite, sourceModule || null, referenceId || null, newQuantity, motif, userId]
    );
    // Approvisionnement manuel du stock Hôtel : la valeur ajoutée est une dépense
    // de la caisse Hôtel (SORTIE), valorisée au prix d'achat ou, à défaut, au prix du produit.
    if (Number(locationId) === HOTEL_LOCATION_ID && type === 'ENTREE' && sourceModule === 'STOCK_MANUEL') {
      await recordHotelStockExpense(connection, { movementId: mv.insertId, productId, quantite });
    }

    const [row] = await connection.query('SELECT * FROM stock_movements WHERE id = ?', [mv.insertId]);
    return row[0];
  };

  if (conn) {
    return await transactionFn(conn);
  } else {
    return await withTransaction(transactionFn);
  }
}

// Helper to get current stock quantity for a product at a location
async function getStockQuantity(productId, locationId) {
  const [rows] = await pool.query(
    'SELECT quantite FROM stocks WHERE product_id = ? AND location_id = ?',
    [productId, locationId]
  );
  return rows[0] ? Number(rows[0].quantite) : 0;
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

// Vue consolidée de tous les articles en stock : le bar garde son propre stock
// (bar_products / bar_stock), les autres modules utilisent stocks par emplacement.
async function stockOverview() {
  const [rows] = await pool.query(
    `SELECT CONCAT('BAR-', p.id) AS cle, 'BAR' AS module, 'Bar & Lounge' AS emplacement,
            p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type, NULL AS location_id,
            p.nom, NULL AS code, p.categorie, p.prix_achat,
            COALESCE(s.quantite, 0) AS quantite, COALESCE(s.seuil_minimum, 0) AS seuil_minimum,
            COALESCE(s.unite, 'unités') AS unite, s.updated_at
       FROM bar_products p
       LEFT JOIN bar_stock s ON s.product_id = p.id
     UNION ALL
     SELECT CONCAT('STK-', s.id), UPPER(COALESCE(p.source_module, sl.nom)), sl.nom,
            p.id, NULL, 'PRODUCT', s.location_id, p.nom, p.code, c.nom, p.prix_achat,
            s.quantite, s.seuil_minimum, p.unite, NULL
       FROM stocks s
       JOIN products p ON p.id = s.product_id
       JOIN stock_locations sl ON sl.id = s.location_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE NOT EXISTS (
        SELECT 1 FROM restaurant_ingredients ri WHERE ri.legacy_product_id = p.id
      )
     UNION ALL
     SELECT CONCAT('ING-', i.id, '-', s.location_id), 'RESTAURANT', sl.nom,
            NULL, i.id, 'INGREDIENT', s.location_id, i.nom, NULL, 'Ingrédients de cuisine', i.prix_achat,
            s.quantite, 5, i.unite, NULL
       FROM restaurant_ingredient_stocks s
       JOIN restaurant_ingredients i ON i.id = s.ingredient_id
       JOIN stock_locations sl ON sl.id = s.location_id
      WHERE i.actif = 1
     ORDER BY emplacement, nom`
  );
  return rows.map((r) => ({ ...r, quantite: Number(r.quantite), seuil_minimum: Number(r.seuil_minimum) }));
}

// Clés : 'BAR-<id>', 'STK-<id>' ou 'ING-<ingredient_id>-<location_id>'.
function parseOverviewKey(cle) {
  const ingredientMatch = /^ING-(\d+)-(\d+)$/.exec(String(cle || ''));
  if (ingredientMatch) {
    return {
      kind: 'ING',
      id: Number(ingredientMatch[1]),
      locationId: Number(ingredientMatch[2]),
    };
  }
  const match = /^(BAR|STK)-(\d+)$/.exec(String(cle || ''));
  if (!match) throw ApiError.badRequest('Article de stock invalide');
  return { kind: match[1], id: Number(match[2]) };
}

async function stockItemDetails(cle) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  if (kind === 'ING') {
    const [[item]] = await pool.query(
      `SELECT CONCAT('ING-', i.id, '-', s.location_id) AS cle,
              'RESTAURANT' AS module, sl.nom AS emplacement,
              NULL AS product_id, i.id AS ingredient_id, 'INGREDIENT' AS item_type,
              s.location_id, i.nom, NULL AS code, 'Ingrédients de cuisine' AS categorie,
              NULL AS prix_vente, i.prix_achat, NULL AS type_produit,
              s.quantite, 5 AS seuil_minimum, i.unite, NULL AS updated_at
         FROM restaurant_ingredient_stocks s
         JOIN restaurant_ingredients i ON i.id = s.ingredient_id
         JOIN stock_locations sl ON sl.id = s.location_id
        WHERE i.id = ? AND s.location_id = ? AND i.actif = 1`,
      [id, locationId]
    );
    if (!item) throw ApiError.notFound('Ingrédient introuvable');
    const [history] = await pool.query(
      `SELECT m.id, m.created_at, m.type_mouvement, m.quantite, m.stock_after,
              COALESCE(m.motif, m.source_module) AS motif,
              TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) AS user_nom
         FROM restaurant_ingredient_stock_movements m
         LEFT JOIN users u ON u.id_admin = m.user_id
        WHERE m.ingredient_id = ? AND m.location_id = ?
        ORDER BY m.created_at DESC, m.id DESC LIMIT 50`,
      [id, item.location_id]
    );
    return { item, history };
  }
  if (kind === 'BAR') {
    const [[item]] = await pool.query(
      `SELECT CONCAT('BAR-', p.id) AS cle, 'BAR' AS module, 'Bar & Lounge' AS emplacement,
              p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type, NULL AS location_id,
              p.nom, NULL AS code, p.categorie, p.prix AS prix_vente, p.prix_achat,
              IF(p.alcool, 'Avec alcool', 'Sans alcool') AS type_produit,
              COALESCE(s.quantite, 0) AS quantite, COALESCE(s.seuil_minimum, 0) AS seuil_minimum,
              COALESCE(s.unite, 'unités') AS unite, s.updated_at
         FROM bar_products p LEFT JOIN bar_stock s ON s.product_id = p.id
        WHERE p.id = ?`,
      [id]
    );
    if (!item) throw ApiError.notFound('Article introuvable');
    // Le bar n'a pas de journal de mouvements : son historique est celui des ventes.
    const [history] = await pool.query(
      `SELECT bt.id, bt.created_at, 'SORTIE' AS type_mouvement, bt.quantite, NULL AS stock_after,
              CONCAT('Vente – commande bar #', bt.order_id, IF(bt.statut IS NULL, '', CONCAT(' (', bt.statut, ')'))) AS motif,
              NULL AS user_nom
         FROM bar_transactions bt
        WHERE bt.product_id = ?
        ORDER BY bt.created_at DESC, bt.id DESC LIMIT 50`,
      [id]
    );
    return { item, history };
  }

  const [[item]] = await pool.query(
    `SELECT CONCAT('STK-', s.id) AS cle, UPPER(COALESCE(p.source_module, sl.nom)) AS module, sl.nom AS emplacement,
            p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type,
            p.nom, p.code, c.nom AS categorie, p.prix_vente, p.prix_achat, p.type_produit,
            s.quantite, s.seuil_minimum, p.unite, s.location_id
       FROM stocks s
       JOIN products p ON p.id = s.product_id
       JOIN stock_locations sl ON sl.id = s.location_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.id = ?`,
    [id]
  );
  if (!item) throw ApiError.notFound('Article introuvable');
  const [history] = await pool.query(
    `SELECT m.id, m.created_at, m.type_mouvement, m.quantite, m.stock_after,
            COALESCE(m.motif, m.source_module) AS motif, TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) AS user_nom
       FROM stock_movements m
       LEFT JOIN users u ON u.id_admin = m.user_id
      WHERE m.product_id = ? AND m.location_id = ?
      ORDER BY m.created_at DESC, m.id DESC LIMIT 50`,
    [item.product_id, item.location_id]
  );
  return { item, history };
}

async function updateStockItem(cle, { quantite, seuil_minimum, unite, prix_achat }, userId = null) {
  const { kind, id } = parseOverviewKey(cle);
  const qty = Number(quantite);
  const threshold = Number(seuil_minimum);
  if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(threshold) || threshold < 0) {
    throw ApiError.badRequest('La quantité et le seuil doivent être des nombres positifs');
  }

  return withTransaction(async (conn) => {
    if (kind === 'BAR') {
      if (!Number.isInteger(qty) || !Number.isInteger(threshold)) {
        throw ApiError.badRequest('Les quantités du bar doivent être des nombres entiers');
      }
      const purchasePrice = prix_achat === undefined ? undefined : Number(prix_achat);
      if (purchasePrice !== undefined && (!Number.isFinite(purchasePrice) || purchasePrice < 0)) {
        throw ApiError.badRequest('Le prix d’achat doit être un nombre positif ou nul');
      }
      const [[product]] = await conn.query('SELECT id FROM bar_products WHERE id = ? FOR UPDATE', [id]);
      if (!product) throw ApiError.notFound('Article introuvable');
      if (purchasePrice !== undefined) {
        await conn.query('UPDATE bar_products SET prix_achat = ? WHERE id = ?', [purchasePrice, id]);
      }
      await conn.query(
        `INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantite = VALUES(quantite), seuil_minimum = VALUES(seuil_minimum), unite = VALUES(unite)`,
        [id, qty, threshold, String(unite || 'unités').trim() || 'unités']
      );
      return { cle };
    }

    const [[row]] = await conn.query('SELECT * FROM stocks WHERE id = ? FOR UPDATE', [id]);
    if (!row) throw ApiError.notFound('Article introuvable');
    if (Number(row.location_id) === HOTEL_LOCATION_ID && (!Number.isInteger(qty) || !Number.isInteger(threshold))) {
      throw ApiError.badRequest('Les quantités du stock hôtel doivent être des nombres entiers');
    }
    // La correction de quantité passe par un mouvement pour garder la trace de l'écart.
    const difference = qty - Number(row.quantite || 0);
    if (difference !== 0) {
      await recordMovement({
        productId: row.product_id,
        locationId: row.location_id,
        type: difference > 0 ? 'ENTREE' : 'SORTIE',
        quantite: Math.abs(difference),
        sourceModule: 'STOCK_MANUEL',
        motif: 'Modification depuis la page Stock',
        userId,
        conn,
      });
    }
    await conn.query('UPDATE stocks SET seuil_minimum = ? WHERE id = ?', [threshold, id]);
    return { cle };
  });
}

async function deleteStockItem(cle, userId = null) {
  const { kind, id } = parseOverviewKey(cle);
  return withTransaction(async (conn) => {
    if (kind === 'BAR') {
      const [[product]] = await conn.query('SELECT id, nom FROM bar_products WHERE id = ? FOR UPDATE', [id]);
      if (!product) throw ApiError.notFound('Article introuvable');
      // Un produit déjà vendu reste en base pour ne pas fausser l'historique des ventes.
      const [[sales]] = await conn.query('SELECT COUNT(*) AS total FROM bar_transactions WHERE product_id = ?', [id]);
      if (Number(sales.total) > 0) {
        throw ApiError.badRequest(`« ${product.nom} » a déjà été vendu : mettez sa quantité à 0 au lieu de le supprimer, pour conserver l'historique des ventes.`);
      }
      await conn.query('DELETE FROM bar_stock WHERE product_id = ?', [id]);
      await conn.query('DELETE FROM bar_products WHERE id = ?', [id]);
      return { cle };
    }

    const [[row]] = await conn.query('SELECT * FROM stocks WHERE id = ? FOR UPDATE', [id]);
    if (!row) throw ApiError.notFound('Article introuvable');
    if (Number(row.quantite) > 0) {
      await recordMovement({
        productId: row.product_id,
        locationId: row.location_id,
        type: 'SORTIE',
        quantite: Number(row.quantite),
        sourceModule: 'STOCK_MANUEL',
        motif: 'Suppression depuis la page Stock',
        userId,
        conn,
      });
    }
    await conn.query('DELETE FROM stocks WHERE id = ?', [id]);
    return { cle };
  });
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

// Portion-based stock consumption: deduct a portion from total stock
async function consumePortion({ productId, locationId, portionSize, portionUnit, referenceId = null, sourceModule = 'RESTAURANT' }) {
  return withTransaction(async (conn) => {
    // Get current stock
    const [stockRows] = await conn.query(
      'SELECT * FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
      [productId, locationId]
    );

    if (!stockRows[0]) {
      throw new Error('Stock introuvable pour ce produit à cet emplacement');
    }

    const currentQuantity = Number(stockRows[0].quantite);
    const portionToConsume = Number(portionSize);

    if (portionToConsume > currentQuantity) {
      throw new Error(`Stock insuffisant: ${currentQuantity} disponible, ${portionToConsume} demandé`);
    }

    // Update stock quantity
    const newQuantity = currentQuantity - portionToConsume;
    await conn.query(
      'UPDATE stocks SET quantite = ? WHERE id = ?',
      [newQuantity, stockRows[0].id]
    );

    // Record the movement
    const [mv] = await conn.query(
      `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
       VALUES (?, ?, 'SORTIE', ?, ?, ?, NOW())`,
      [productId, locationId, portionToConsume, sourceModule, referenceId]
    );

    const [movement] = await conn.query('SELECT * FROM stock_movements WHERE id = ?', [mv.insertId]);
    return {
      ...movement[0],
      previous_quantity: currentQuantity,
      new_quantity: newQuantity,
      portion_consumed: portionToConsume,
      portion_unit: portionUnit
    };
  });
}

module.exports = {
  Categories, Subcategories, ProductTypes, Units, Products, StockLocations, Stocks, StockMovements,
  Suppliers, Purchases, PurchaseItems,
  recordMovement, createPurchaseWithItems, lowStock, stockByProduct, stockOverview, stockItemDetails, updateStockItem, deleteStockItem, getProductsWithStock, consumePortion, getStockQuantity,
};
