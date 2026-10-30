// models/stockModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const ApiError = require('../utils/ApiError');
const { convertQuantity } = require('../utils/unitConversion');
const {
  monthBounds,
  aggregateMovements,
  openingStock,
  computeStockStatus,
  signedQuantity,
} = require('../utils/stockMath');

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

async function recordMovement({
  productId,
  locationId,
  type,
  quantite,
  sourceModule,
  referenceId,
  conn = null,
  motif = null,
  userId = null,
  allowNegative = true,
  dateOperation = null,
  referenceExterne = null,
  commentaire = null,
  supplierId = null,
}) {
  if (!['ENTREE', 'SORTIE', 'AJUSTEMENT'].includes(type)) {
    throw ApiError.badRequest('Type de mouvement invalide');
  }
  const numericQuantity = Number(quantite);
  if (!Number.isFinite(numericQuantity) || numericQuantity === 0 || (type !== 'AJUSTEMENT' && numericQuantity < 0)) {
    throw ApiError.badRequest('La quantité doit être un nombre strictement positif');
  }
  if (Number(locationId) === 5 && !Number.isInteger(numericQuantity)) {
    throw ApiError.badRequest('Les quantités du stock hôtel doivent être des nombres entiers');
  }
  const transactionFn = async (connection) => {
    const effectiveSignedQty = signedQuantity(type, numericQuantity);

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
      `INSERT INTO stock_movements
         (product_id, location_id, type_mouvement, quantite, source_module, reference_id,
          created_at, date_operation, stock_after, motif, user_id, reference_externe, commentaire, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?)`,
      [
        productId,
        locationId,
        type,
        numericQuantity,
        sourceModule || null,
        referenceId || null,
        dateOperation || null,
        newQuantity,
        motif,
        userId,
        referenceExterne || null,
        commentaire || null,
        supplierId || null,
      ]
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

// Agrégats mensuels par article. Les ventes sont lues dans leur source de
// vérité : bar_transactions pour le Bar, les mouvements RESTAURANT pour les
// produits et ingrédients du restaurant.
async function monthlyMaps(month) {
  const { start, endExclusive } = monthBounds(month);

  const [barRows] = await pool.query(
    `SELECT product_id, type_mouvement, quantite, source_module
       FROM bar_stock_movements
      WHERE COALESCE(date_operation, DATE(created_at)) >= ?
        AND COALESCE(date_operation, DATE(created_at)) < ?`,
    [start, endExclusive]
  );
  const barGroups = new Map();
  for (const row of barRows) {
    const key = `bar:${row.product_id}`;
    if (!barGroups.has(key)) barGroups.set(key, []);
    barGroups.get(key).push(row);
  }
  const barTotals = new Map();
  for (const [key, rows] of barGroups) {
    barTotals.set(key, aggregateMovements(rows, { salesFromLedger: false }));
  }
  const [barSales] = await pool.query(
    `SELECT product_id, SUM(quantite) AS ventes
       FROM bar_transactions
      WHERE statut <> 'ANNULEE'
        AND DATE(created_at) >= ? AND DATE(created_at) < ?
      GROUP BY product_id`,
    [start, endExclusive]
  );
  for (const row of barSales) {
    const key = `bar:${row.product_id}`;
    const totals = barTotals.get(key) || { entrees: 0, sorties: 0, ventes: 0 };
    totals.ventes = Math.round((Number(row.ventes) || 0) * 1000) / 1000;
    barTotals.set(key, totals);
  }

  const [productRows] = await pool.query(
    `SELECT product_id, location_id, type_mouvement, quantite, source_module
       FROM stock_movements
      WHERE COALESCE(date_operation, DATE(created_at)) >= ?
        AND COALESCE(date_operation, DATE(created_at)) < ?`,
    [start, endExclusive]
  );
  const productGroups = new Map();
  for (const row of productRows) {
    const key = `${row.product_id}:${row.location_id}`;
    if (!productGroups.has(key)) productGroups.set(key, []);
    productGroups.get(key).push(row);
  }
  const productTotals = new Map();
  for (const [key, rows] of productGroups) {
    productTotals.set(key, aggregateMovements(rows));
  }

  const [ingredientRows] = await pool.query(
    `SELECT ingredient_id, location_id, type_mouvement, quantite, source_module
       FROM restaurant_ingredient_stock_movements
      WHERE COALESCE(date_operation, DATE(created_at)) >= ?
        AND COALESCE(date_operation, DATE(created_at)) < ?`,
    [start, endExclusive]
  );
  const ingredientGroups = new Map();
  for (const row of ingredientRows) {
    const key = `${row.ingredient_id}:${row.location_id}`;
    if (!ingredientGroups.has(key)) ingredientGroups.set(key, []);
    ingredientGroups.get(key).push(row);
  }
  const ingredientTotals = new Map();
  for (const [key, rows] of ingredientGroups) {
    ingredientTotals.set(key, aggregateMovements(rows));
  }

  // Dernier inventaire du mois pour chaque article : c'est le stock réel retenu.
  const [inventoryRows] = await pool.query(
    `SELECT item_type, product_id, ingredient_id, location_id, stock_reel, ecart
       FROM stock_inventories
      WHERE inventory_date >= ? AND inventory_date < ?
      ORDER BY inventory_date ASC, id ASC`,
    [start, endExclusive]
  );
  const inventories = new Map();
  for (const row of inventoryRows) {
    const key = row.item_type === 'BAR_PRODUCT'
      ? `BAR_PRODUCT:${row.product_id}`
      : row.item_type === 'INGREDIENT'
        ? `INGREDIENT:${row.ingredient_id}:${row.location_id}`
        : `PRODUCT:${row.product_id}:${row.location_id}`;
    inventories.set(key, row);
  }

  return { barTotals, productTotals, ingredientTotals, inventories };
}

function applyMonthly(items, maps) {
  return items.map((item) => {
    let totals = { entrees: 0, sorties: 0, ventes: 0 };
    let inventory = null;

    if (item.module === 'BAR') {
      totals = maps.barTotals.get(`bar:${item.product_id}`) || totals;
      inventory = maps.inventories.get(`BAR_PRODUCT:${item.product_id}`) || null;
    } else if (item.item_type === 'INGREDIENT') {
      const key = `${item.ingredient_id}:${item.location_id}`;
      totals = maps.ingredientTotals.get(key) || totals;
      inventory = maps.inventories.get(`INGREDIENT:${key}`) || null;
    } else {
      const key = `${item.product_id}:${item.location_id}`;
      totals = maps.productTotals.get(key) || totals;
      inventory = maps.inventories.get(`PRODUCT:${key}`) || null;
    }

    const quantite = Number(item.quantite) || 0;
    const seuilMinimum = Number(item.seuil_minimum) || 0;
    const seuilMaximum = item.seuil_maximum === null || item.seuil_maximum === undefined
      ? null
      : Number(item.seuil_maximum);
    const stockReel = inventory ? Number(inventory.stock_reel) : null;
    const ecart = inventory ? Number(inventory.ecart) : null;

    return {
      ...item,
      quantite,
      seuil_minimum: seuilMinimum,
      seuil_maximum: seuilMaximum,
      stock_initial: item.stock_initial === null || item.stock_initial === undefined
        ? null
        : Number(item.stock_initial),
      stock_debut_mois: openingStock(quantite, totals),
      entree_mensuel: totals.entrees,
      sortie_mensuel: totals.sorties,
      vente_mensuel: totals.ventes,
      stock_reel: stockReel,
      ecart,
      statut: computeStockStatus({ quantite, seuilMinimum, seuilMaximum }),
    };
  });
}

// Vue consolidée de tous les articles en stock : le bar garde son propre stock
// (bar_products / bar_stock), les autres modules utilisent stocks par emplacement.
async function stockOverview(month = null) {
  const [rows] = await pool.query(
    `SELECT CONCAT('BAR-', p.id) AS cle, 'BAR' AS module, 'Bar & Lounge' AS emplacement,
            p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type, NULL AS location_id,
            p.nom, NULL AS code, p.categorie, p.prix_achat,
            COALESCE(s.quantite, 0) AS quantite, COALESCE(s.seuil_minimum, 0) AS seuil_minimum,
            s.seuil_maximum, s.stock_initial, COALESCE(s.unite, 'unités') AS unite, s.updated_at
       FROM bar_products p
       LEFT JOIN bar_stock s ON s.product_id = p.id
     UNION ALL
     SELECT CONCAT('STK-', s.id), UPPER(COALESCE(p.source_module, sl.nom)), sl.nom,
            p.id, NULL, 'PRODUCT', s.location_id, p.nom, p.code, c.nom, p.prix_achat,
            s.quantite, s.seuil_minimum, s.seuil_maximum, s.stock_initial, p.unite, NULL
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
            s.quantite, COALESCE(s.seuil_minimum, 0), s.seuil_maximum, s.stock_initial, i.unite, s.updated_at
       FROM restaurant_ingredient_stocks s
       JOIN restaurant_ingredients i ON i.id = s.ingredient_id
       JOIN stock_locations sl ON sl.id = s.location_id
      WHERE i.actif = 1
     ORDER BY emplacement, nom`
  );
  const maps = await monthlyMaps(month);
  return applyMonthly(rows, maps);
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

async function stockItemDetails(cle, month = null) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  if (kind === 'ING') {
    const [[item]] = await pool.query(
      `SELECT CONCAT('ING-', i.id, '-', s.location_id) AS cle,
              'RESTAURANT' AS module, sl.nom AS emplacement,
              NULL AS product_id, i.id AS ingredient_id, 'INGREDIENT' AS item_type,
              s.location_id, i.nom, NULL AS code, 'Ingrédients de cuisine' AS categorie,
              NULL AS prix_vente, i.prix_achat, NULL AS type_produit,
              s.quantite, COALESCE(s.seuil_minimum, 0) AS seuil_minimum, s.seuil_maximum,
              s.stock_initial, i.unite, s.updated_at
         FROM restaurant_ingredient_stocks s
         JOIN restaurant_ingredients i ON i.id = s.ingredient_id
         JOIN stock_locations sl ON sl.id = s.location_id
        WHERE i.id = ? AND s.location_id = ? AND i.actif = 1`,
      [id, locationId]
    );
    if (!item) throw ApiError.notFound('Ingrédient introuvable');
    const [history] = await pool.query(
      `SELECT m.id, 'INGREDIENT' AS source, m.created_at, m.date_operation, m.type_mouvement,
              m.quantite, m.stock_after, m.reference_externe, m.commentaire,
              COALESCE(m.motif, m.source_module) AS motif,
              TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) AS user_nom
         FROM restaurant_ingredient_stock_movements m
         LEFT JOIN users u ON u.id_admin = m.user_id
        WHERE m.ingredient_id = ? AND m.location_id = ?
        ORDER BY COALESCE(m.date_operation, DATE(m.created_at)) DESC, m.created_at DESC, m.id DESC LIMIT 50`,
      [id, item.location_id]
    );
    return { item: applyMonthly([item], await monthlyMaps(month))[0], history };
  }
  if (kind === 'BAR') {
    const [[item]] = await pool.query(
      `SELECT CONCAT('BAR-', p.id) AS cle, 'BAR' AS module, 'Bar & Lounge' AS emplacement,
              p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type, NULL AS location_id,
              p.nom, NULL AS code, p.categorie, p.prix AS prix_vente, p.prix_achat,
              IF(p.alcool, 'Avec alcool', 'Sans alcool') AS type_produit,
              COALESCE(s.quantite, 0) AS quantite, COALESCE(s.seuil_minimum, 0) AS seuil_minimum,
              s.seuil_maximum, s.stock_initial, COALESCE(s.unite, 'unités') AS unite, s.updated_at
         FROM bar_products p LEFT JOIN bar_stock s ON s.product_id = p.id
        WHERE p.id = ?`,
      [id]
    );
    if (!item) throw ApiError.notFound('Article introuvable');
    // Journal du bar + anciennes ventes qui n'ont pas encore de ligne de journal.
    const [history] = await pool.query(
      `SELECT * FROM (
         SELECT m.id, 'BAR_STOCK' AS source, m.created_at, m.date_operation, m.type_mouvement,
                m.quantite, m.stock_after,
                CASE WHEN m.source_module IN ('VENTE_BAR', 'VENTE') THEN 1 ELSE 0 END AS est_vente,
                m.reference_externe, m.commentaire,
                COALESCE(m.motif, m.source_module) COLLATE utf8mb4_unicode_ci AS motif,
                TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) COLLATE utf8mb4_unicode_ci AS user_nom
           FROM bar_stock_movements m
           LEFT JOIN users u ON u.id_admin = m.user_id
          WHERE m.product_id = ?
         UNION ALL
         SELECT bt.id, 'BAR_SALE' AS source, bt.created_at, DATE(bt.created_at) AS date_operation,
                'SORTIE' AS type_mouvement, bt.quantite, NULL AS stock_after, 1 AS est_vente,
                NULL AS reference_externe, NULL AS commentaire,
                CONCAT('Vente – commande bar #', COALESCE(bt.order_id, bt.id), IF(bt.statut IS NULL, '', CONCAT(' (', bt.statut, ')'))) COLLATE utf8mb4_unicode_ci AS motif,
                NULL AS user_nom
           FROM bar_transactions bt
          WHERE bt.product_id = ?
            AND bt.statut <> 'ANNULEE'
            AND NOT EXISTS (
              SELECT 1 FROM bar_stock_movements m
               WHERE m.source_module = 'VENTE_BAR'
                 AND m.reference_id = bt.order_id
                 AND m.product_id = bt.product_id
            )
       ) h
       ORDER BY COALESCE(h.date_operation, DATE(h.created_at)) DESC, h.created_at DESC, h.id DESC
       LIMIT 50`,
      [id, id]
    );
    return { item: applyMonthly([item], await monthlyMaps(month))[0], history };
  }

  const [[item]] = await pool.query(
    `SELECT CONCAT('STK-', s.id) AS cle, UPPER(COALESCE(p.source_module, sl.nom)) AS module, sl.nom AS emplacement,
            p.id AS product_id, NULL AS ingredient_id, 'PRODUCT' AS item_type,
            p.nom, p.code, c.nom AS categorie, p.prix_vente, p.prix_achat, p.type_produit,
            s.quantite, s.seuil_minimum, s.seuil_maximum, s.stock_initial, p.unite, s.location_id,
            s.updated_at
       FROM stocks s
       JOIN products p ON p.id = s.product_id
       JOIN stock_locations sl ON sl.id = s.location_id
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE s.id = ?`,
    [id]
  );
  if (!item) throw ApiError.notFound('Article introuvable');
  const [history] = await pool.query(
    `SELECT m.id, 'STOCK' AS source, m.created_at, m.date_operation, m.type_mouvement,
            m.quantite, m.stock_after, m.reference_externe, m.commentaire,
            COALESCE(m.motif, m.source_module) AS motif,
            TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) AS user_nom
       FROM stock_movements m
       LEFT JOIN users u ON u.id_admin = m.user_id
      WHERE m.product_id = ? AND m.location_id = ?
      ORDER BY COALESCE(m.date_operation, DATE(m.created_at)) DESC, m.created_at DESC, m.id DESC LIMIT 50`,
    [item.product_id, item.location_id]
  );
  return { item: applyMonthly([item], await monthlyMaps(month))[0], history };
}

function optionalNumber(value, label, { integer = false, min = 0 } = {}) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) {
    throw ApiError.badRequest(`${label} doit être un nombre supérieur ou égal à ${min}`);
  }
  if (integer && !Number.isInteger(number)) {
    throw ApiError.badRequest(`${label} doit être un nombre entier`);
  }
  return number;
}

async function resolveCategory(conn, categoryName) {
  const name = String(categoryName || '').trim();
  if (!name) return null;
  const [rows] = await conn.query(
    'SELECT id FROM categories WHERE nom COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci ORDER BY id LIMIT 1',
    [name]
  );
  if (rows[0]) return rows[0].id;
  const [result] = await conn.query('INSERT INTO categories (nom) VALUES (?)', [name]);
  return result.insertId;
}

async function updateStockItem(cle, payload = {}, userId = null) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  const {
    quantite, seuil_minimum, seuil_maximum, unite, prix_achat, prix_vente,
    nom, categorie, stock_initial, description,
  } = payload;

  return withTransaction(async (conn) => {
    if (kind === 'BAR') {
      const qty = optionalNumber(quantite, 'La quantité', { integer: true });
      const threshold = optionalNumber(seuil_minimum, 'Le seuil minimum', { integer: true });
      const maximum = optionalNumber(seuil_maximum, 'Le seuil maximum', { integer: true });
      const initial = optionalNumber(stock_initial, 'Le stock initial', { integer: true });
      const purchasePrice = optionalNumber(prix_achat, 'Le prix d’achat');
      const salePrice = optionalNumber(prix_vente, 'Le prix de vente');

      const [[product]] = await conn.query(
        'SELECT id, prix_achat FROM bar_products WHERE id = ? FOR UPDATE',
        [id]
      );
      if (!product) throw ApiError.notFound('Article introuvable');

      const productFields = [];
      const productParams = [];
      if (nom !== undefined) {
        if (!String(nom).trim()) throw ApiError.badRequest('Le nom de l’article est requis');
        productFields.push('nom = ?'); productParams.push(String(nom).trim());
      }
      if (categorie !== undefined) {
        productFields.push('categorie = ?'); productParams.push(String(categorie).trim() || 'Bar');
      }
      if (purchasePrice !== undefined && purchasePrice !== null) {
        productFields.push('prix_achat = ?'); productParams.push(purchasePrice);
      }
      if (salePrice !== undefined && salePrice !== null) {
        productFields.push('prix = ?'); productParams.push(salePrice);
      }
      if (description !== undefined) {
        productFields.push('description = ?'); productParams.push(String(description || '').trim() || null);
      }
      if (productFields.length) {
        await conn.query(`UPDATE bar_products SET ${productFields.join(', ')} WHERE id = ?`, [...productParams, id]);
      }

      const [[stock]] = await conn.query('SELECT * FROM bar_stock WHERE product_id = ? FOR UPDATE', [id]);
      const currentQuantity = Number(stock?.quantite || 0);
      if (qty !== null && qty !== undefined && qty !== currentQuantity) {
        const difference = qty - currentQuantity;
        await recordBarMovement({
          productId: id,
          locationId: 3,
          type: difference > 0 ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(difference),
          sourceModule: 'STOCK_MANUEL',
          motif: 'Modification depuis la page Stock',
          userId,
          allowNegative: false,
          conn,
        });
      }
      const fields = [];
      const params = [];
      if (threshold !== undefined && threshold !== null) { fields.push('seuil_minimum = ?'); params.push(threshold); }
      if (maximum !== undefined) { fields.push('seuil_maximum = ?'); params.push(maximum); }
      if (initial !== undefined) {
        fields.push('stock_initial = ?'); params.push(initial);
        fields.push('stock_initial_date = COALESCE(stock_initial_date, CURDATE())');
      }
      if (unite !== undefined) {
        fields.push('unite = ?'); params.push(String(unite || '').trim() || 'unités');
      }
      if (!stock) {
        await conn.query(
          'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, ?, ?)',
          [id, currentQuantity, threshold ?? 0, String(unite || 'unités').trim() || 'unités']
        );
      } else if (fields.length) {
        await conn.query(`UPDATE bar_stock SET ${fields.join(', ')} WHERE product_id = ?`, [...params, id]);
      }
      return { cle };
    }

    if (kind === 'ING') {
      const qty = optionalNumber(quantite, 'La quantité', { min: 0 });
      const threshold = optionalNumber(seuil_minimum, 'Le seuil minimum', { min: 0 });
      const maximum = optionalNumber(seuil_maximum, 'Le seuil maximum', { min: 0 });
      const initial = optionalNumber(stock_initial, 'Le stock initial', { min: 0 });
      const price = optionalNumber(prix_achat, 'Le prix d’achat', { min: 0 });

      const [[ingredient]] = await conn.query(
        'SELECT id, nom, unite FROM restaurant_ingredients WHERE id = ? AND actif = 1 FOR UPDATE',
        [id]
      );
      if (!ingredient) throw ApiError.notFound('Ingrédient introuvable');

      const newUnit = unite === undefined ? ingredient.unite : String(unite || '').trim();
      if (!newUnit) throw ApiError.badRequest('L’unité est requise');
      if (newUnit !== ingredient.unite) {
        const [recipeUnits] = await conn.query(
          `SELECT ri.unite FROM recipe_items ri WHERE ri.ingredient_id = ?`,
          [id]
        );
        const incompatible = recipeUnits.find(
          (row) => convertQuantity(1, row.unite || ingredient.unite, newUnit) === null
        );
        if (incompatible) {
          throw ApiError.badRequest(
            `Impossible de modifier l’unité : elle est incompatible avec une unité utilisée dans les recettes (${incompatible.unite || ingredient.unite}).`
          );
        }
      }

      const [[stock]] = await conn.query(
        'SELECT * FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ? FOR UPDATE',
        [id, locationId]
      );
      const currentQuantity = Number(stock?.quantite || 0);

      const ingredientFields = [];
      const ingredientParams = [];
      if (nom !== undefined) {
        if (!String(nom).trim()) throw ApiError.badRequest('Le nom de l’ingrédient est requis');
        ingredientFields.push('nom = ?'); ingredientParams.push(String(nom).trim());
      }
      ingredientFields.push('unite = ?'); ingredientParams.push(newUnit);
      if (price !== undefined && price !== null) {
        ingredientFields.push('prix_achat = ?'); ingredientParams.push(price);
      }
      if (description !== undefined) {
        ingredientFields.push('description = ?'); ingredientParams.push(String(description || '').trim() || null);
      }
      await conn.query(
        `UPDATE restaurant_ingredients SET ${ingredientFields.join(', ')} WHERE id = ?`,
        [...ingredientParams, id]
      );

      if (qty !== null && qty !== undefined && qty !== currentQuantity) {
        const difference = qty - currentQuantity;
        await recordIngredientMovement({
          ingredientId: id,
          locationId,
          type: difference > 0 ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(difference),
          sourceModule: 'STOCK_MANUEL',
          motif: newUnit !== ingredient.unite
            ? `Modification de l’unité (${ingredient.unite} → ${newUnit}) et du stock`
            : 'Modification depuis la page Stock',
          userId,
          allowNegative: false,
          conn,
        });
      }
      const fields = [];
      const params = [];
      if (threshold !== undefined && threshold !== null) { fields.push('seuil_minimum = ?'); params.push(threshold); }
      if (maximum !== undefined) { fields.push('seuil_maximum = ?'); params.push(maximum); }
      if (initial !== undefined) {
        fields.push('stock_initial = ?'); params.push(initial);
        fields.push('stock_initial_date = COALESCE(stock_initial_date, CURDATE())');
      }
      if (!stock) {
        await conn.query(
          'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite, seuil_minimum) VALUES (?, ?, ?, ?)',
          [id, locationId, currentQuantity, threshold ?? 0]
        );
      } else if (fields.length) {
        await conn.query(
          `UPDATE restaurant_ingredient_stocks SET ${fields.join(', ')} WHERE id = ?`,
          [...params, stock.id]
        );
      }
      return { cle };
    }

    const qty = optionalNumber(quantite, 'La quantité', { min: 0 });
    const threshold = optionalNumber(seuil_minimum, 'Le seuil minimum', { min: 0 });
    const maximum = optionalNumber(seuil_maximum, 'Le seuil maximum', { min: 0 });
    const initial = optionalNumber(stock_initial, 'Le stock initial', { min: 0 });
    const purchasePrice = optionalNumber(prix_achat, 'Le prix d’achat', { min: 0 });
    const salePrice = optionalNumber(prix_vente, 'Le prix de vente', { min: 0 });

    const [[row]] = await conn.query('SELECT * FROM stocks WHERE id = ? FOR UPDATE', [id]);
    if (!row) throw ApiError.notFound('Article introuvable');
    if (Number(row.location_id) === HOTEL_LOCATION_ID
      && [qty, threshold, maximum, initial].some((value) => value !== undefined && value !== null && !Number.isInteger(value))) {
      throw ApiError.badRequest('Les quantités du stock hôtel doivent être des nombres entiers');
    }

    const productFields = [];
    const productParams = [];
    if (nom !== undefined) {
      if (!String(nom).trim()) throw ApiError.badRequest('Le nom de l’article est requis');
      productFields.push('nom = ?'); productParams.push(String(nom).trim());
    }
    if (categorie !== undefined) {
      const categoryId = await resolveCategory(conn, categorie);
      if (categoryId) { productFields.push('category_id = ?'); productParams.push(categoryId); }
    }
    if (unite !== undefined) {
      productFields.push('unite = ?'); productParams.push(String(unite || '').trim() || 'unités');
    }
    if (purchasePrice !== undefined && purchasePrice !== null) {
      productFields.push('prix_achat = ?'); productParams.push(purchasePrice);
    }
    if (salePrice !== undefined && salePrice !== null) {
      productFields.push('prix_vente = ?'); productParams.push(salePrice);
    }
    if (description !== undefined) {
      productFields.push('description = ?'); productParams.push(String(description || '').trim() || null);
    }
    if (productFields.length) {
      await conn.query(`UPDATE products SET ${productFields.join(', ')} WHERE id = ?`, [...productParams, row.product_id]);
    }

    // La correction de quantité passe par un mouvement pour garder la trace de l'écart.
    if (qty !== null && qty !== undefined && qty !== Number(row.quantite || 0)) {
      const difference = qty - Number(row.quantite || 0);
      await recordMovement({
        productId: row.product_id,
        locationId: row.location_id,
        type: difference > 0 ? 'ENTREE' : 'SORTIE',
        quantite: Math.abs(difference),
        sourceModule: 'STOCK_MANUEL',
        motif: 'Modification depuis la page Stock',
        userId,
        allowNegative: false,
        conn,
      });
    }
    const fields = [];
    const params = [];
    if (threshold !== undefined && threshold !== null) { fields.push('seuil_minimum = ?'); params.push(threshold); }
    if (maximum !== undefined) { fields.push('seuil_maximum = ?'); params.push(maximum); }
    if (initial !== undefined) {
      fields.push('stock_initial = ?'); params.push(initial);
      fields.push('stock_initial_date = COALESCE(stock_initial_date, CURDATE())');
    }
    if (fields.length) {
      await conn.query(`UPDATE stocks SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
    }
    return { cle };
  });
}

async function deleteStockItem(cle, userId = null) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  return withTransaction(async (conn) => {
    if (kind === 'BAR') {
      const [[product]] = await conn.query('SELECT id, nom FROM bar_products WHERE id = ? FOR UPDATE', [id]);
      if (!product) throw ApiError.notFound('Article introuvable');
      // Un produit déjà vendu reste en base pour ne pas fausser l'historique des ventes.
      const [[sales]] = await conn.query('SELECT COUNT(*) AS total FROM bar_transactions WHERE product_id = ?', [id]);
      if (Number(sales.total) > 0) {
        throw ApiError.badRequest(`« ${product.nom} » a déjà été vendu : mettez sa quantité à 0 au lieu de le supprimer, pour conserver l'historique des ventes.`);
      }
      await conn.query('DELETE FROM bar_stock_movements WHERE product_id = ?', [id]);
      await conn.query('DELETE FROM bar_stock WHERE product_id = ?', [id]);
      await conn.query('DELETE FROM bar_products WHERE id = ?', [id]);
      return { cle };
    }

    if (kind === 'ING') {
      const [[ingredient]] = await conn.query(
        'SELECT id, nom FROM restaurant_ingredients WHERE id = ? AND actif = 1 FOR UPDATE',
        [id]
      );
      if (!ingredient) throw ApiError.notFound('Ingrédient introuvable');
      await conn.query('DELETE FROM recipe_items WHERE ingredient_id = ?', [id]);
      await conn.query(
        'DELETE r FROM recipes r LEFT JOIN recipe_items ri ON ri.recipe_id = r.id WHERE ri.id IS NULL'
      );
      const [[stock]] = await conn.query(
        'SELECT id, quantite FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ? FOR UPDATE',
        [id, locationId]
      );
      if (stock && Number(stock.quantite) > 0) {
        await recordIngredientMovement({
          ingredientId: id,
          locationId,
          type: 'SORTIE',
          quantite: Number(stock.quantite),
          sourceModule: 'STOCK_MANUEL',
          motif: 'Suppression depuis la page Stock',
          userId,
          allowNegative: false,
          conn,
        });
      }
      await conn.query(
        'DELETE FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ?',
        [id, locationId]
      );
      await conn.query('UPDATE restaurant_ingredients SET actif = 0 WHERE id = ?', [id]);
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

// --- Journal du Bar ---------------------------------------------------------
// bar_transactions reste la source de vérité des ventes. Le journal
// bar_stock_movements trace les entrées/sorties manuelles et reçoit une copie
// historisée des ventes (sans nouvelle décrémentation du stock).
async function recordBarMovement({
  productId,
  locationId = 3,
  type,
  quantite,
  sourceModule = 'STOCK_MANUEL',
  referenceId = null,
  motif = null,
  userId = null,
  allowNegative = false,
  dateOperation = null,
  referenceExterne = null,
  commentaire = null,
  supplierId = null,
  conn = null,
}) {
  if (!['ENTREE', 'SORTIE', 'AJUSTEMENT'].includes(type)) {
    throw ApiError.badRequest('Type de mouvement invalide');
  }
  const numericQuantity = Number(quantite);
  if (!Number.isFinite(numericQuantity) || numericQuantity === 0
    || (type !== 'AJUSTEMENT' && numericQuantity < 0)) {
    throw ApiError.badRequest('La quantité doit être un nombre strictement positif');
  }
  if (!Number.isInteger(Math.abs(numericQuantity))) {
    throw ApiError.badRequest('Les quantités du bar doivent être des nombres entiers');
  }

  const transactionFn = async (connection) => {
    const signed = signedQuantity(type, numericQuantity);
    const [[product]] = await connection.query(
      'SELECT id, nom FROM bar_products WHERE id = ? FOR UPDATE',
      [productId]
    );
    if (!product) throw ApiError.notFound('Article introuvable');
    const [[stock]] = await connection.query(
      'SELECT id, quantite FROM bar_stock WHERE product_id = ? FOR UPDATE',
      [productId]
    );
    const current = Number(stock?.quantite || 0);
    const next = current + signed;
    if (!allowNegative && next < 0) {
      throw ApiError.badRequest(
        `Stock insuffisant pour ${product.nom} : ${current} disponible(s), ${Math.abs(signed)} demandé(s).`
      );
    }
    if (stock) {
      await connection.query('UPDATE bar_stock SET quantite = ? WHERE id = ?', [next, stock.id]);
    } else {
      await connection.query(
        'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, unite) VALUES (?, ?, 5, ?)',
        [productId, next, 'unités']
      );
    }
    const [result] = await connection.query(
      `INSERT INTO bar_stock_movements
         (product_id, location_id, type_mouvement, quantite, source_module, reference_id,
          reference_externe, date_operation, created_at, stock_after, motif, commentaire, user_id, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), NOW(), ?, ?, ?, ?, ?)`,
      [
        productId, locationId, type, Math.abs(numericQuantity), sourceModule || null,
        referenceId || null, referenceExterne || null, dateOperation || null, next,
        motif || null, commentaire || null, userId || null, supplierId || null,
      ]
    );
    const [[row]] = await connection.query('SELECT * FROM bar_stock_movements WHERE id = ?', [result.insertId]);
    return row;
  };

  return conn ? transactionFn(conn) : withTransaction(transactionFn);
}

async function recordIngredientMovement({
  ingredientId,
  locationId = 2,
  type,
  quantite,
  sourceModule = 'STOCK_MANUEL',
  referenceId = null,
  motif = null,
  userId = null,
  allowNegative = false,
  dateOperation = null,
  referenceExterne = null,
  commentaire = null,
  supplierId = null,
  conn = null,
}) {
  if (!['ENTREE', 'SORTIE', 'AJUSTEMENT'].includes(type)) {
    throw ApiError.badRequest('Type de mouvement invalide');
  }
  const numericQuantity = Number(quantite);
  if (!Number.isFinite(numericQuantity) || numericQuantity === 0
    || (type !== 'AJUSTEMENT' && numericQuantity < 0)) {
    throw ApiError.badRequest('La quantité doit être un nombre strictement positif');
  }

  const transactionFn = async (connection) => {
    const signed = signedQuantity(type, numericQuantity);
    const [[ingredient]] = await connection.query(
      'SELECT id, nom FROM restaurant_ingredients WHERE id = ? AND actif = 1 FOR UPDATE',
      [ingredientId]
    );
    if (!ingredient) throw ApiError.notFound('Ingrédient introuvable');
    const [[stock]] = await connection.query(
      'SELECT id, quantite FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ? FOR UPDATE',
      [ingredientId, locationId]
    );
    const current = Number(stock?.quantite || 0);
    const next = current + signed;
    if (!allowNegative && next < 0) {
      throw ApiError.badRequest(
        `Stock insuffisant pour ${ingredient.nom} : ${current} disponible(s), ${Math.abs(signed)} demandé(s).`
      );
    }
    if (stock) {
      await connection.query('UPDATE restaurant_ingredient_stocks SET quantite = ? WHERE id = ?', [next, stock.id]);
    } else {
      await connection.query(
        'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite) VALUES (?, ?, ?)',
        [ingredientId, locationId, next]
      );
    }
    const [result] = await connection.query(
      `INSERT INTO restaurant_ingredient_stock_movements
         (ingredient_id, location_id, type_mouvement, quantite, source_module, reference_id,
          reference_externe, date_operation, created_at, stock_after, motif, commentaire, user_id, supplier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), NOW(), ?, ?, ?, ?, ?)`,
      [
        ingredientId, locationId, type, Math.abs(numericQuantity), sourceModule || null,
        referenceId || null, referenceExterne || null, dateOperation || null, next,
        motif || null, commentaire || null, userId || null, supplierId || null,
      ]
    );
    const [[row]] = await connection.query(
      'SELECT * FROM restaurant_ingredient_stock_movements WHERE id = ?',
      [result.insertId]
    );
    return row;
  };

  return conn ? transactionFn(conn) : withTransaction(transactionFn);
}

async function recordItemMovement(cle, payload = {}, userId = null) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  const type = String(payload.type || payload.type_mouvement || '').toUpperCase();
  if (!['ENTREE', 'SORTIE'].includes(type)) {
    throw ApiError.badRequest('Le type de mouvement doit être ENTREE ou SORTIE');
  }
  const quantite = Number(payload.quantite);
  if (!Number.isFinite(quantite) || quantite <= 0) {
    throw ApiError.badRequest('La quantité doit être strictement positive');
  }
  const options = {
    type,
    quantite,
    sourceModule: 'STOCK_MANUEL',
    motif: payload.motif ? String(payload.motif).trim() : null,
    userId,
    allowNegative: false,
    dateOperation: payload.date_operation || null,
    referenceExterne: payload.reference_externe ? String(payload.reference_externe).trim() : null,
    commentaire: payload.commentaire ? String(payload.commentaire).trim() : null,
  };

  if (kind === 'BAR') {
    if (!Number.isInteger(quantite)) {
      throw ApiError.badRequest('Les quantités du bar doivent être des nombres entiers');
    }
    return { cle, movement: await recordBarMovement({ ...options, productId: id, locationId: 3 }) };
  }
  if (kind === 'ING') {
    return { cle, movement: await recordIngredientMovement({ ...options, ingredientId: id, locationId }) };
  }
  const [[stock]] = await pool.query('SELECT product_id, location_id FROM stocks WHERE id = ?', [id]);
  if (!stock) throw ApiError.notFound('Article introuvable');
  return {
    cle,
    movement: await recordMovement({
      ...options,
      productId: stock.product_id,
      locationId: stock.location_id,
    }),
  };
}

// Copie historisée d'une vente Bar : le stock a déjà été décrémenté par la
// commande, on écrit uniquement la ligne de journal avec le solde résultant.
async function appendBarSaleMovements(conn, orderId, items) {
  const totals = new Map();
  for (const item of items || []) {
    const productId = Number(item.product_id ?? item.id);
    const quantity = Number(item.quantite || 1);
    if (!productId || quantity <= 0) continue;
    totals.set(productId, (totals.get(productId) || 0) + quantity);
  }
  for (const [productId, quantity] of totals) {
    const [[stock]] = await conn.query(
      'SELECT quantite FROM bar_stock WHERE product_id = ?',
      [productId]
    );
    await conn.query(
      `INSERT INTO bar_stock_movements
         (product_id, location_id, type_mouvement, quantite, source_module, reference_id,
          date_operation, created_at, stock_after, motif)
       VALUES (?, 3, 'SORTIE', ?, 'VENTE_BAR', ?, CURDATE(), NOW(), ?, ?)`,
      [productId, quantity, orderId, stock ? Number(stock.quantite) : null, `Vente – commande bar #${orderId}`]
    );
  }
}

async function removeBarSaleMovements(conn, orderId) {
  await conn.query(
    "DELETE FROM bar_stock_movements WHERE source_module = 'VENTE_BAR' AND reference_id = ?",
    [orderId]
  );
}

// --- Inventaires physiques --------------------------------------------------
async function createInventory(cle, payload = {}, userId = null) {
  const { kind, id, locationId } = parseOverviewKey(cle);
  const stockReel = Number(payload.stock_reel);
  if (!Number.isFinite(stockReel) || stockReel < 0) {
    throw ApiError.badRequest('Le stock réel doit être un nombre positif ou nul');
  }
  if ((kind === 'BAR' || (kind === 'STK' && locationId === HOTEL_LOCATION_ID))
    && !Number.isInteger(stockReel)) {
    throw ApiError.badRequest('Le stock réel doit être un nombre entier pour cet emplacement');
  }
  const regularise = payload.regularise === true || payload.regularise === 1 || payload.regularise === '1';

  return withTransaction(async (conn) => {
    let itemType;
    let theoretical;
    let movement = null;
    let resolvedLocationId = locationId;
    let inventoryProductId = kind === 'ING' ? null : id;

    if (kind === 'BAR') {
      itemType = 'BAR_PRODUCT';
      resolvedLocationId = 3;
      const [[product]] = await conn.query('SELECT id, nom FROM bar_products WHERE id = ? FOR UPDATE', [id]);
      if (!product) throw ApiError.notFound('Article introuvable');
      const [[stock]] = await conn.query('SELECT quantite FROM bar_stock WHERE product_id = ? FOR UPDATE', [id]);
      theoretical = Number(stock?.quantite || 0);
      if (regularise && stockReel !== theoretical) {
        movement = await recordBarMovement({
          productId: id,
          locationId: 3,
          type: stockReel > theoretical ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(stockReel - theoretical),
          sourceModule: 'INVENTAIRE',
          referenceId: null,
          motif: payload.motif ? String(payload.motif).trim() : 'Régularisation d’inventaire',
          commentaire: payload.commentaire || null,
          userId,
          allowNegative: true,
          dateOperation: payload.inventory_date || null,
          conn,
        });
      }
    } else if (kind === 'ING') {
      itemType = 'INGREDIENT';
      resolvedLocationId = locationId;
      const [[ingredient]] = await conn.query(
        'SELECT id, nom FROM restaurant_ingredients WHERE id = ? AND actif = 1 FOR UPDATE',
        [id]
      );
      if (!ingredient) throw ApiError.notFound('Ingrédient introuvable');
      const [[stock]] = await conn.query(
        'SELECT quantite FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ? FOR UPDATE',
        [id, locationId]
      );
      theoretical = Number(stock?.quantite || 0);
      if (regularise && stockReel !== theoretical) {
        movement = await recordIngredientMovement({
          ingredientId: id,
          locationId,
          type: stockReel > theoretical ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(stockReel - theoretical),
          sourceModule: 'INVENTAIRE',
          motif: payload.motif ? String(payload.motif).trim() : 'Régularisation d’inventaire',
          commentaire: payload.commentaire || null,
          userId,
          allowNegative: true,
          dateOperation: payload.inventory_date || null,
          conn,
        });
      }
    } else {
      itemType = 'PRODUCT';
      const [[row]] = await conn.query('SELECT * FROM stocks WHERE id = ? FOR UPDATE', [id]);
      if (!row) throw ApiError.notFound('Article introuvable');
      theoretical = Number(row.quantite);
      resolvedLocationId = row.location_id;
      inventoryProductId = row.product_id;
      if (regularise && stockReel !== theoretical) {
        movement = await recordMovement({
          productId: row.product_id,
          locationId: row.location_id,
          type: stockReel > theoretical ? 'ENTREE' : 'SORTIE',
          quantite: Math.abs(stockReel - theoretical),
          sourceModule: 'INVENTAIRE',
          motif: payload.motif ? String(payload.motif).trim() : 'Régularisation d’inventaire',
          commentaire: payload.commentaire || null,
          userId,
          allowNegative: true,
          dateOperation: payload.inventory_date || null,
          conn,
        });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO stock_inventories
         (item_type, product_id, ingredient_id, location_id, inventory_date,
          stock_theorique, stock_reel, ecart, motif, commentaire, user_id, regularise, movement_id)
       VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        itemType,
        inventoryProductId,
        kind === 'ING' ? id : null,
        resolvedLocationId,
        payload.inventory_date || null,
        theoretical,
        stockReel,
        stockReel - theoretical,
        payload.motif ? String(payload.motif).trim() : null,
        payload.commentaire ? String(payload.commentaire).trim() : null,
        userId,
        regularise ? 1 : 0,
        movement?.id || null,
      ]
    );
    const [[inventory]] = await conn.query('SELECT * FROM stock_inventories WHERE id = ?', [result.insertId]);
    return { inventory, theoretical, difference: stockReel - theoretical, regularise, movement };
  });
}

async function listInventories({ month = null, cle = null, limit = 100, offset = 0 } = {}) {
  const { start, endExclusive } = monthBounds(month);
  const params = [start, endExclusive];
  let filter = '';
  if (cle) {
    const { kind, id, locationId } = parseOverviewKey(cle);
    if (kind === 'BAR') {
      filter = " AND inv.item_type = 'BAR_PRODUCT' AND inv.product_id = ?";
      params.push(id);
    } else if (kind === 'ING') {
      filter = " AND inv.item_type = 'INGREDIENT' AND inv.ingredient_id = ? AND inv.location_id = ?";
      params.push(id, locationId);
    } else {
      const [[stock]] = await pool.query('SELECT product_id, location_id FROM stocks WHERE id = ?', [id]);
      if (!stock) return [];
      filter = " AND inv.item_type = 'PRODUCT' AND inv.product_id = ? AND inv.location_id = ?";
      params.push(stock.product_id, stock.location_id);
    }
  }
  const limitNum = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const offsetNum = Math.max(Number(offset) || 0, 0);
  const [rows] = await pool.query(
    `SELECT inv.*, COALESCE(bp.nom, p.nom, i.nom) AS article_nom,
            TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) AS user_nom
       FROM stock_inventories inv
       LEFT JOIN bar_products bp ON inv.item_type = 'BAR_PRODUCT' AND bp.id = inv.product_id
       LEFT JOIN products p ON inv.item_type = 'PRODUCT' AND p.id = inv.product_id
       LEFT JOIN restaurant_ingredients i ON inv.item_type = 'INGREDIENT' AND i.id = inv.ingredient_id
       LEFT JOIN users u ON u.id_admin = inv.user_id
      WHERE inv.inventory_date >= ? AND inv.inventory_date < ?${filter}
      ORDER BY inv.inventory_date DESC, inv.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limitNum, offsetNum]
  );
  return rows.map((row) => ({
    ...row,
    stock_theorique: Number(row.stock_theorique),
    stock_reel: Number(row.stock_reel),
    ecart: Number(row.ecart),
    regularise: Boolean(row.regularise),
  }));
}

// --- Création d'un article dans n'importe quel module -----------------------
async function createArticle(payload = {}, userId = null) {
  const moduleName = String(payload.module || '').toUpperCase();
  const nom = String(payload.nom || '').trim();
  const categorie = String(payload.categorie || '').trim();
  const unite = String(payload.unite || 'unités').trim() || 'unités';
  const seuilMinimum = optionalNumber(payload.seuil_minimum, 'Le seuil minimum') ?? 0;
  const seuilMaximum = optionalNumber(payload.seuil_maximum, 'Le seuil maximum');
  const quantite = optionalNumber(payload.quantite, 'La quantité') ?? 0;
  const prixAchat = optionalNumber(payload.prix_achat, 'Le prix d’achat') ?? 0;
  const prixVente = optionalNumber(payload.prix_vente, 'Le prix de vente') ?? 0;
  const description = String(payload.description || '').trim() || null;

  if (!nom) throw ApiError.badRequest('Le nom de l’article est requis');
  if (!['BAR', 'RESTAURANT', 'HOTEL', 'HEBERGEMENT', 'CASINO', 'STOCK'].includes(moduleName)) {
    throw ApiError.badRequest('Module de stock invalide');
  }

  return withTransaction(async (conn) => {
    if (moduleName === 'BAR') {
      if (![quantite, seuilMinimum, seuilMaximum ?? 0].every(Number.isInteger)) {
        throw ApiError.badRequest('Les quantités du bar doivent être des nombres entiers');
      }
      const [result] = await conn.query(
        `INSERT INTO bar_products (nom, ingredients, prix, prix_achat, categorie, alcool, type_produit, source_module, description)
         VALUES (?, '', ?, ?, ?, ?, 'PRODUIT_FINI', 'BAR', ?)`,
        [nom, prixVente, prixAchat, categorie || 'Bar', payload.alcool ? 1 : 0, description]
      );
      const productId = result.insertId;
      await conn.query(
        'INSERT INTO bar_stock (product_id, quantite, seuil_minimum, seuil_maximum, stock_initial, stock_initial_date, unite) VALUES (?, 0, ?, ?, ?, CURDATE(), ?)',
        [productId, seuilMinimum, seuilMaximum, quantite, unite]
      );
      if (quantite > 0) {
        await recordBarMovement({
          productId,
          locationId: 3,
          type: 'ENTREE',
          quantite,
          sourceModule: 'STOCK_MANUEL',
          motif: 'Stock initial',
          userId,
          allowNegative: false,
          conn,
        });
      }
      return { cle: `BAR-${productId}` };
    }

    if (moduleName === 'RESTAURANT') {
      const [result] = await conn.query(
        `INSERT INTO restaurant_ingredients (nom, unite, prix_achat, actif, description)
         VALUES (?, ?, ?, 1, ?)`,
        [nom, unite, prixAchat, description]
      );
      const ingredientId = result.insertId;
      await conn.query(
        'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite, seuil_minimum, seuil_maximum, stock_initial, stock_initial_date) VALUES (?, 2, 0, ?, ?, ?, CURDATE())',
        [ingredientId, seuilMinimum, seuilMaximum, quantite]
      );
      if (quantite > 0) {
        await recordIngredientMovement({
          ingredientId,
          locationId: 2,
          type: 'ENTREE',
          quantite,
          sourceModule: 'STOCK_MANUEL',
          motif: 'Stock initial',
          userId,
          allowNegative: false,
          conn,
        });
      }
      return { cle: `ING-${ingredientId}-2` };
    }

    const locationMap = { HEBERGEMENT: 1, HOTEL: 5, CASINO: 4, STOCK: Number(payload.location_id) || 5 };
    const locationId = Number(payload.location_id) || locationMap[moduleName] || 5;
    if (!Number.isInteger(locationId) || locationId <= 0) {
      throw ApiError.badRequest('Emplacement de stock invalide');
    }
    if (locationId === HOTEL_LOCATION_ID && ![quantite, seuilMinimum, seuilMaximum ?? 0].every(Number.isInteger)) {
      throw ApiError.badRequest('Les quantités du stock hôtel doivent être des nombres entiers');
    }
    const categoryId = await resolveCategory(conn, categorie || 'Divers');
    const sourceModule = locationId === 5 ? 'HOTEL' : locationId === 1 ? 'HEBERGEMENT' : locationId === 4 ? 'CASINO' : 'GENERAL';
    const code = String(payload.code || '').trim()
      || `${sourceModule.slice(0, 3)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const [productResult] = await conn.query(
      `INSERT INTO products (category_id, code, nom, unite, prix_achat, prix_vente, actif, type_produit, source_module, description)
       VALUES (?, ?, ?, ?, ?, ?, 1, 'CONSOMMABLE', ?, ?)`,
      [categoryId, code, nom, unite, prixAchat, prixVente, sourceModule, description]
    );
    const productId = productResult.insertId;
    const [stockResult] = await conn.query(
      'INSERT INTO stocks (product_id, location_id, quantite, seuil_minimum, seuil_maximum, stock_initial, stock_initial_date) VALUES (?, ?, 0, ?, ?, ?, CURDATE())',
      [productId, locationId, seuilMinimum, seuilMaximum, quantite]
    );
    if (quantite > 0) {
      await recordMovement({
        productId,
        locationId,
        type: 'ENTREE',
        quantite,
        sourceModule: 'STOCK_MANUEL',
        motif: 'Stock initial',
        userId,
        allowNegative: false,
        conn,
      });
    }
    return { cle: `STK-${stockResult.insertId}` };
  });
}

// --- Historique consolidé ---------------------------------------------------
async function listStockHistory({ month = null, cle = null, module = null, type = null, limit = 100, offset = 0 } = {}) {
  const { start, endExclusive } = monthBounds(month);
  const barParams = [start, endExclusive];
  const productParams = [start, endExclusive];
  const ingredientParams = [start, endExclusive];
  let barFilter = '';
  let productFilter = '';
  let ingredientFilter = '';

  if (cle) {
    const parsed = parseOverviewKey(cle);
    if (parsed.kind === 'BAR') {
      barFilter = ' AND m.product_id = ?'; barParams.push(parsed.id);
      productFilter = ' AND 1 = 0';
      ingredientFilter = ' AND 1 = 0';
    } else if (parsed.kind === 'ING') {
      ingredientFilter = ' AND m.ingredient_id = ? AND m.location_id = ?';
      ingredientParams.push(parsed.id, parsed.locationId);
      barFilter = ' AND 1 = 0';
      productFilter = ' AND 1 = 0';
    } else {
      const [[stock]] = await pool.query('SELECT product_id, location_id FROM stocks WHERE id = ?', [parsed.id]);
      if (!stock) return [];
      productFilter = ' AND m.product_id = ? AND m.location_id = ?';
      productParams.push(stock.product_id, stock.location_id);
      barFilter = ' AND 1 = 0';
      ingredientFilter = ' AND 1 = 0';
    }
  }

  const limitNum = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const offsetNum = Math.max(Number(offset) || 0, 0);
  const outer = [];
  const outerParams = [];
  if (module) { outer.push('h.module = ?'); outerParams.push(String(module).toUpperCase()); }
  if (type) { outer.push('h.type_mouvement = ?'); outerParams.push(String(type).toUpperCase()); }

  const [rows] = await pool.query(
    `SELECT * FROM (
       SELECT 'BAR' COLLATE utf8mb4_unicode_ci AS module, 'BAR_PRODUCT' COLLATE utf8mb4_unicode_ci AS item_type,
              m.product_id AS item_id, m.location_id,
              bp.nom COLLATE utf8mb4_unicode_ci AS article_nom, bs.unite COLLATE utf8mb4_unicode_ci AS unite,
              m.id, 'BAR_STOCK' COLLATE utf8mb4_unicode_ci AS source,
              m.date_operation, m.created_at, m.type_mouvement COLLATE utf8mb4_unicode_ci AS type_mouvement,
              m.quantite, m.stock_after,
              COALESCE(m.motif, m.source_module) COLLATE utf8mb4_unicode_ci AS motif,
              m.reference_externe COLLATE utf8mb4_unicode_ci AS reference_externe,
              m.commentaire COLLATE utf8mb4_unicode_ci AS commentaire,
              TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) COLLATE utf8mb4_unicode_ci AS user_nom,
              CASE WHEN m.source_module IN ('VENTE_BAR', 'VENTE') THEN 1 ELSE 0 END AS est_vente
         FROM bar_stock_movements m
         JOIN bar_products bp ON bp.id = m.product_id
         LEFT JOIN bar_stock bs ON bs.product_id = m.product_id
         LEFT JOIN users u ON u.id_admin = m.user_id
        WHERE COALESCE(m.date_operation, DATE(m.created_at)) >= ?
          AND COALESCE(m.date_operation, DATE(m.created_at)) < ?${barFilter}
       UNION ALL
       SELECT UPPER(COALESCE(p.source_module, sl.nom)) COLLATE utf8mb4_unicode_ci AS module,
              'PRODUCT' COLLATE utf8mb4_unicode_ci AS item_type,
              m.product_id AS item_id, m.location_id, p.nom COLLATE utf8mb4_unicode_ci AS article_nom,
              p.unite COLLATE utf8mb4_unicode_ci AS unite, m.id,
              'STOCK' COLLATE utf8mb4_unicode_ci AS source, m.date_operation, m.created_at,
              m.type_mouvement COLLATE utf8mb4_unicode_ci AS type_mouvement, m.quantite, m.stock_after,
              COALESCE(m.motif, m.source_module) COLLATE utf8mb4_unicode_ci AS motif,
              m.reference_externe COLLATE utf8mb4_unicode_ci AS reference_externe,
              m.commentaire COLLATE utf8mb4_unicode_ci AS commentaire,
              TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) COLLATE utf8mb4_unicode_ci AS user_nom,
              CASE WHEN m.source_module IN ('RESTAURANT', 'VENTE') THEN 1 ELSE 0 END AS est_vente
         FROM stock_movements m
         JOIN products p ON p.id = m.product_id
         LEFT JOIN stock_locations sl ON sl.id = m.location_id
         LEFT JOIN users u ON u.id_admin = m.user_id
        WHERE COALESCE(m.date_operation, DATE(m.created_at)) >= ?
          AND COALESCE(m.date_operation, DATE(m.created_at)) < ?${productFilter}
       UNION ALL
       SELECT 'RESTAURANT' COLLATE utf8mb4_unicode_ci AS module,
              'INGREDIENT' COLLATE utf8mb4_unicode_ci AS item_type, m.ingredient_id AS item_id,
              m.location_id, i.nom COLLATE utf8mb4_unicode_ci AS article_nom,
              i.unite COLLATE utf8mb4_unicode_ci AS unite, m.id,
              'INGREDIENT' COLLATE utf8mb4_unicode_ci AS source,
              m.date_operation, m.created_at, m.type_mouvement COLLATE utf8mb4_unicode_ci AS type_mouvement,
              m.quantite, m.stock_after,
              COALESCE(m.motif, m.source_module) COLLATE utf8mb4_unicode_ci AS motif,
              m.reference_externe COLLATE utf8mb4_unicode_ci AS reference_externe,
              m.commentaire COLLATE utf8mb4_unicode_ci AS commentaire,
              TRIM(CONCAT(COALESCE(u.prenom, ''), ' ', COALESCE(u.nom, ''))) COLLATE utf8mb4_unicode_ci AS user_nom,
              CASE WHEN m.source_module IN ('RESTAURANT', 'VENTE') THEN 1 ELSE 0 END AS est_vente
         FROM restaurant_ingredient_stock_movements m
         JOIN restaurant_ingredients i ON i.id = m.ingredient_id
         LEFT JOIN users u ON u.id_admin = m.user_id
        WHERE COALESCE(m.date_operation, DATE(m.created_at)) >= ?
          AND COALESCE(m.date_operation, DATE(m.created_at)) < ?${ingredientFilter}
     ) h
     ${outer.length ? `WHERE ${outer.join(' AND ')}` : ''}
     ORDER BY COALESCE(h.date_operation, DATE(h.created_at)) DESC, h.created_at DESC, h.id DESC
     LIMIT ? OFFSET ?`,
    [...barParams, ...productParams, ...ingredientParams, ...outerParams, limitNum, offsetNum]
  );

  return rows.map((row) => ({
    ...row,
    quantite: Number(row.quantite),
    stock_after: row.stock_after === null ? null : Number(row.stock_after),
    est_vente: Boolean(row.est_vente),
  }));
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
  recordMovement, createPurchaseWithItems, lowStock, stockByProduct, stockOverview, stockItemDetails,
  updateStockItem, deleteStockItem, getProductsWithStock, consumePortion, getStockQuantity,
  recordBarMovement, recordIngredientMovement, recordItemMovement,
  appendBarSaleMovements, removeBarSaleMovements,
  createInventory, listInventories, createArticle, listStockHistory,
};
