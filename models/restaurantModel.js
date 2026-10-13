// models/restaurantModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const stockModel = require('./stockModel');
const { convertQuantity } = require('../utils/unitConversion');
const ApiError = require('../utils/ApiError');

let restaurantSchemaReady;

// Older installations used the generic orders/payments tables before the
// restaurant columns were introduced. Make the restaurant API self-healing so
// order creation/payment does not fail with "unknown column" errors.
async function ensureRestaurantSchema() {
  if (!restaurantSchemaReady) {
    restaurantSchemaReady = (async () => {
      const [orderColumns] = await pool.query('SHOW COLUMNS FROM orders');
      if (!orderColumns.some((column) => column.Field === 'table_id')) {
        await pool.query('ALTER TABLE orders ADD COLUMN table_id BIGINT UNSIGNED NULL AFTER client_id');
      }

      if (!orderColumns.some((column) => column.Field === 'cloturee')) {
        await pool.query('ALTER TABLE orders ADD COLUMN cloturee TINYINT(1) NOT NULL DEFAULT 0 AFTER statut');
      }
      if (!orderColumns.some((column) => column.Field === 'cloture_at')) {
        await pool.query('ALTER TABLE orders ADD COLUMN cloture_at DATETIME NULL AFTER cloturee');
      }

      const [paymentColumns] = await pool.query('SHOW COLUMNS FROM payments');
      if (!paymentColumns.some((column) => column.Field === 'order_id')) {
        await pool.query('ALTER TABLE payments ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER id');
      }
      if (!paymentColumns.some((column) => column.Field === 'date_paiement')) {
        await pool.query('ALTER TABLE payments ADD COLUMN date_paiement DATETIME NULL AFTER moyen_paiement');
      }

      const [ftColumns] = await pool.query('SHOW COLUMNS FROM financial_transactions');
      if (!ftColumns.some((column) => column.Field === 'cloturee')) {
        await pool.query('ALTER TABLE financial_transactions ADD COLUMN cloturee TINYINT(1) NOT NULL DEFAULT 0 AFTER statut_sync');
      }
      if (!ftColumns.some((column) => column.Field === 'cloture_at')) {
        await pool.query('ALTER TABLE financial_transactions ADD COLUMN cloture_at DATETIME NULL AFTER cloturee');
      }

      // Add notes column to orders for additional information
      if (!orderColumns.some((column) => column.Field === 'notes')) {
        await pool.query('ALTER TABLE orders ADD COLUMN notes TEXT NULL AFTER cloture_at');
      }
      if (!orderColumns.some((column) => column.Field === 'location_type')) {
        await pool.query('ALTER TABLE orders ADD COLUMN location_type VARCHAR(50) NULL AFTER notes');
      }
      if (!orderColumns.some((column) => column.Field === 'special_person_name')) {
        await pool.query('ALTER TABLE orders ADD COLUMN special_person_name VARCHAR(255) NULL AFTER location_type');
      }

      // Marque les commandes dont les ingrédients ont été sortis du stock (les anciennes
      // commandes, jamais déduites, ne doivent rien remettre en stock à l'annulation).
      if (!orderColumns.some((column) => column.Field === 'stock_deducted_at')) {
        await pool.query('ALTER TABLE orders ADD COLUMN stock_deducted_at DATETIME NULL');
      }
      if (!orderColumns.some((column) => column.Field === 'order_ingredients_deducted')) {
        await pool.query('ALTER TABLE orders ADD COLUMN order_ingredients_deducted TINYINT(1) NOT NULL DEFAULT 1');
      }

      // Add cuisson column to order_items for cooking level customization
      const [orderItemColumns] = await pool.query('SHOW COLUMNS FROM order_items');
      if (!orderItemColumns.some((column) => column.Field === 'cuisson')) {
        await pool.query('ALTER TABLE order_items ADD COLUMN cuisson VARCHAR(50) NULL AFTER prix_unitaire');
      }

      const [recipeItemColumns] = await pool.query('SHOW COLUMNS FROM recipe_items');
      if (!recipeItemColumns.some((column) => column.Field === 'unite')) {
        await pool.query('ALTER TABLE recipe_items ADD COLUMN unite VARCHAR(50) NULL AFTER quantite');
      }

      await pool.query(
        `CREATE TABLE IF NOT EXISTS restaurant_ingredients (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          nom VARCHAR(150) NOT NULL,
          unite VARCHAR(50) NOT NULL,
          prix_achat DECIMAL(15,2) NOT NULL DEFAULT 0,
          actif TINYINT(1) NOT NULL DEFAULT 1,
          legacy_product_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_restaurant_ingredients_legacy_product (legacy_product_id),
          KEY idx_restaurant_ingredients_nom (nom)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS restaurant_ingredient_stocks (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          ingredient_id BIGINT UNSIGNED NOT NULL,
          location_id BIGINT UNSIGNED NOT NULL,
          quantite DECIMAL(15,3) NOT NULL DEFAULT 0,
          PRIMARY KEY (id),
          UNIQUE KEY uq_restaurant_ingredient_stock_location (ingredient_id, location_id),
          CONSTRAINT fk_restaurant_ingredient_stock_ingredient
            FOREIGN KEY (ingredient_id) REFERENCES restaurant_ingredients (id),
          CONSTRAINT fk_restaurant_ingredient_stock_location
            FOREIGN KEY (location_id) REFERENCES stock_locations (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
      );
      await pool.query(
        `CREATE TABLE IF NOT EXISTS restaurant_ingredient_stock_movements (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          ingredient_id BIGINT UNSIGNED NOT NULL,
          location_id BIGINT UNSIGNED NOT NULL,
          type_mouvement VARCHAR(20) NOT NULL,
          quantite DECIMAL(15,3) NOT NULL,
          source_module VARCHAR(50) NULL,
          reference_id BIGINT UNSIGNED NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          stock_after DECIMAL(15,3) NULL,
          motif VARCHAR(255) NULL,
          user_id BIGINT UNSIGNED NULL,
          legacy_movement_id BIGINT UNSIGNED NULL,
          PRIMARY KEY (id),
          UNIQUE KEY uq_restaurant_ingredient_legacy_movement (legacy_movement_id),
          KEY idx_restaurant_ingredient_movement_date (ingredient_id, created_at),
          CONSTRAINT fk_restaurant_ingredient_movement_ingredient
            FOREIGN KEY (ingredient_id) REFERENCES restaurant_ingredients (id),
          CONSTRAINT fk_restaurant_ingredient_movement_location
            FOREIGN KEY (location_id) REFERENCES stock_locations (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
      );

      const [recipeForeignKeys] = await pool.query(
        `SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
           FROM information_schema.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'recipe_items'
            AND COLUMN_NAME = 'ingredient_id'
            AND REFERENCED_TABLE_NAME IS NOT NULL`
      );
      const recipesUseDedicatedIngredients = recipeForeignKeys.some(
        (key) => key.REFERENCED_TABLE_NAME === 'restaurant_ingredients'
      );

      if (!recipesUseDedicatedIngredients) {
        await pool.query(
          `INSERT IGNORE INTO restaurant_ingredients (nom, unite, prix_achat, actif, legacy_product_id)
           SELECT p.nom, COALESCE(NULLIF(p.unite, ''), 'PIECE'), COALESCE(p.prix_achat, 0), p.actif, p.id
             FROM products p
            WHERE p.type_produit = 'MATIERE_PREMIERE'
              AND (p.source_module = 'RESTAURANT'
                   OR EXISTS (SELECT 1 FROM recipe_items ri WHERE ri.ingredient_id = p.id))`
        );
        await pool.query(
          `INSERT IGNORE INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite)
           SELECT i.id, s.location_id, s.quantite
             FROM restaurant_ingredients i
             JOIN stocks s ON s.product_id = i.legacy_product_id
            WHERE i.legacy_product_id IS NOT NULL`
        );
        await pool.query(
          `INSERT IGNORE INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite)
           SELECT DISTINCT i.id, 2, 0
             FROM restaurant_ingredients i
             JOIN recipe_items ri ON ri.ingredient_id = i.legacy_product_id
            WHERE i.legacy_product_id IS NOT NULL`
        );
        await pool.query(
          `INSERT IGNORE INTO restaurant_ingredient_stock_movements
             (ingredient_id, location_id, type_mouvement, quantite, source_module,
              reference_id, created_at, stock_after, motif, user_id, legacy_movement_id)
           SELECT i.id, m.location_id, m.type_mouvement, m.quantite, m.source_module,
                  m.reference_id, m.created_at, m.stock_after, m.motif, m.user_id, m.id
             FROM restaurant_ingredients i
             JOIN stock_movements m ON m.product_id = i.legacy_product_id
            WHERE i.legacy_product_id IS NOT NULL`
        );
        // La clé vers `products` doit tomber avant la réécriture des ids, sinon
        // les nouveaux ids restaurant_ingredients sont refusés par l'ancienne FK.
        for (const key of recipeForeignKeys) {
          const constraintName = String(key.CONSTRAINT_NAME).replace(/`/g, '``');
          await pool.query(`ALTER TABLE recipe_items DROP FOREIGN KEY \`${constraintName}\``);
        }
        await pool.query(
          `UPDATE recipe_items ri
           JOIN restaurant_ingredients i ON i.legacy_product_id = ri.ingredient_id
              SET ri.ingredient_id = i.id`
        );
        await pool.query(
          `ALTER TABLE recipe_items
           ADD CONSTRAINT fk_recipe_items_restaurant_ingredient
           FOREIGN KEY (ingredient_id) REFERENCES restaurant_ingredients (id)`
        );
      }

      await pool.query(
        `UPDATE products p
         JOIN restaurant_ingredients i ON i.legacy_product_id = p.id
            SET p.actif = 0`
      );
    })().catch((error) => {
      restaurantSchemaReady = undefined;
      throw error;
    });
  }
  return restaurantSchemaReady;
}

const TablesRestaurant = createCrudModel({
  table: 'tables_restaurant', pk: 'id',
  fields: ['numero', 'capacite', 'statut'],
  sortable: ['id', 'numero', 'statut'],
});

const tablesRestaurantFindAll = TablesRestaurant.findAll;
TablesRestaurant.findAll = async function(options) {
  const tableRows = Array.from({ length: 16 }, (_, index) => [index + 1, String(index + 1), 4, 'LIBRE']);
  await pool.query(
    'INSERT INTO tables_restaurant (id, numero, capacite, statut) VALUES ? ON DUPLICATE KEY UPDATE id = id',
    [tableRows]
  );
  return tablesRestaurantFindAll.call(this, options);
};

// `orders` est une table générique partagée entre modules (source_module)
const Orders = createCrudModel({
  table: 'orders', pk: 'id',
  fields: ['client_id', 'table_id', 'source_module', 'montant_total', 'statut', 'created_at', 'notes'],
  sortable: ['id', 'created_at', 'montant_total', 'statut'],
});

const ordersFindAll = Orders.findAll;
const ordersCount = Orders.count;
const ordersFindById = Orders.findById;
const ordersCreate = Orders.create;
const ordersUpdate = Orders.update;

function restaurantOrderScope(whereSql = '') {
  const trimmed = String(whereSql || '').trim();
  if (!trimmed) return "WHERE source_module = 'RESTAURANT'";
  if (trimmed.toUpperCase().startsWith('WHERE')) return `${trimmed} AND source_module = 'RESTAURANT'`;
  return `source_module = 'RESTAURANT' AND (${trimmed})`;
}

const OrderItems = createCrudModel({
  table: 'order_items', pk: 'id',
  fields: ['order_id', 'product_id', 'quantite', 'prix_unitaire', 'cuisson'],
  sortable: ['id'],
});

// --- Stock des ingrédients ---------------------------------------------------
// Une commande sort du stock du restaurant pour les plats suivis en stock et
// pour chacun des ingrédients de leur recette.
const RESTAURANT_LOCATION_ID = 2;

// Calcule le stock des produits et, pour les commandes historiques, des ingrédients de recette.
async function ingredientNeeds(conn, items, { includeProductStock = true, includeRecipeIngredients = true } = {}) {
  const needs = new Map();
  const addProduct = (productId, qty) => {
    const key = `product:${productId}`;
    needs.set(key, (needs.get(key) || 0) + qty);
  };
  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantite);
    if (!productId || !(quantity > 0)) continue;
    if (includeProductStock) {
      const [[productStock]] = await conn.query(
        `SELECT p.type_produit, p.source_module, s.id AS stock_id
           FROM products p
           LEFT JOIN stocks s ON s.product_id = p.id AND s.location_id = ?
          WHERE p.id = ?
          LIMIT 1`,
        [RESTAURANT_LOCATION_ID, productId]
      );
      if (
        productStock?.stock_id
        || (productStock?.source_module === 'RESTAURANT' && productStock?.type_produit === 'PRODUIT_FINI')
      ) {
        addProduct(productId, quantity);
      }
    }

    if (!includeRecipeIngredients) continue;
    const [recipeItems] = await conn.query(
      `SELECT ri.ingredient_id, ri.quantite, ri.unite AS recipe_unite, i.unite AS stock_unite
         FROM recipes r
         JOIN recipe_items ri ON ri.recipe_id = r.id
         JOIN restaurant_ingredients i ON i.id = ri.ingredient_id
        WHERE r.product_id = ?`,
      [productId]
    );
    if (recipeItems.length) {
      recipeItems.forEach((ri) => {
        const recipeQuantity = Number(ri.quantite);
        const stockQuantity = convertQuantity(recipeQuantity, ri.recipe_unite || ri.stock_unite, ri.stock_unite);
        const ingredientId = Number(ri.ingredient_id);
        const key = `ingredient:${ingredientId}`;
        needs.set(key, (needs.get(key) || 0) + (stockQuantity ?? recipeQuantity) * quantity);
      });
    }
  }
  return needs;
}

async function consumeRestaurantRecipeIngredients(conn, { ingredients, productId, productName, userId }) {
  const requirements = ingredients
    .map((ingredient) => ({
      ...ingredient,
      quantityInStockUnit: convertQuantity(
        Number(ingredient.quantity),
        ingredient.unit,
        ingredient.stockUnit
      ),
    }))
    .sort((first, second) => Number(first.ingredientId) - Number(second.ingredientId));

  for (const ingredient of requirements) {
    if (ingredient.quantityInStockUnit === null) {
      throw ApiError.badRequest(
        `Unité « ${ingredient.unit} » incompatible avec l'unité de stock « ${ingredient.stockUnit} » pour ${ingredient.name}`
      );
    }
    const [[stock]] = await conn.query(
      `SELECT quantite FROM restaurant_ingredient_stocks
        WHERE ingredient_id = ? AND location_id = ? FOR UPDATE`,
      [ingredient.ingredientId, RESTAURANT_LOCATION_ID]
    );
    const available = Number(stock?.quantite || 0);
    if (available + 1e-9 < ingredient.quantityInStockUnit) {
      throw ApiError.conflict(
        `Stock insuffisant pour ${ingredient.name} : ${available} ${ingredient.stockUnit} disponible(s), ${ingredient.quantityInStockUnit} demandé(s).`
      );
    }
  }

  for (const ingredient of requirements) {
    await recordRestaurantIngredientMovement(conn, {
      ingredientId: ingredient.ingredientId,
      locationId: RESTAURANT_LOCATION_ID,
      type: 'SORTIE',
      quantite: ingredient.quantityInStockUnit,
      sourceModule: 'RESTAURANT',
      referenceId: productId,
      motif: `Ajout du plat « ${productName} »`,
      userId,
    });
  }
}

async function recordRestaurantIngredientMovement(conn, {
  ingredientId,
  locationId,
  type,
  quantite,
  sourceModule,
  referenceId,
  motif,
  userId,
}) {
  const signedQuantity = type === 'SORTIE' ? -Math.abs(Number(quantite)) : Math.abs(Number(quantite));
  const [[stock]] = await conn.query(
    `SELECT id, quantite
       FROM restaurant_ingredient_stocks
      WHERE ingredient_id = ? AND location_id = ?
      FOR UPDATE`,
    [ingredientId, locationId]
  );
  const newQuantity = Number(stock?.quantite || 0) + signedQuantity;
  if (stock) {
    await conn.query(
      'UPDATE restaurant_ingredient_stocks SET quantite = ? WHERE id = ?',
      [newQuantity, stock.id]
    );
  } else {
    await conn.query(
      'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite) VALUES (?, ?, ?)',
      [ingredientId, locationId, newQuantity]
    );
  }
  await conn.query(
    `INSERT INTO restaurant_ingredient_stock_movements
       (ingredient_id, location_id, type_mouvement, quantite, source_module,
        reference_id, created_at, stock_after, motif, user_id)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
    [
      ingredientId,
      locationId,
      type,
      Math.abs(Number(quantite)),
      sourceModule || 'RESTAURANT',
      referenceId || null,
      newQuantity,
      motif || null,
      userId || null,
    ]
  );
  return newQuantity;
}

// Ajuste le stock entre deux versions de commande ou restaure les mouvements historiques.
// Le stock des produits finis peut devenir négatif ; les commandes restent autorisées.
async function syncOrderIngredients(conn, {
  orderId,
  fromItems,
  toItems,
  motif,
  includeProductStock = true,
  includeRecipeIngredients = true,
}) {
  const needsOptions = { includeProductStock, includeRecipeIngredients };
  const before = await ingredientNeeds(conn, fromItems, needsOptions);
  const after = await ingredientNeeds(conn, toItems, needsOptions);
  for (const itemKey of new Set([...before.keys(), ...after.keys()])) {
    const delta = Math.round(((after.get(itemKey) || 0) - (before.get(itemKey) || 0)) * 1000) / 1000;
    if (delta === 0) continue;
    const isIngredient = itemKey.startsWith('ingredient:');
    const id = Number(itemKey.slice(itemKey.indexOf(':') + 1));
    const movement = {
      locationId: RESTAURANT_LOCATION_ID,
      type: delta > 0 ? 'SORTIE' : 'ENTREE',
      quantite: Math.abs(delta),
      sourceModule: 'RESTAURANT',
      referenceId: orderId,
      motif: delta > 0 ? motif : `${motif} (retour en stock)`,
    };
    if (isIngredient) {
      await recordRestaurantIngredientMovement(conn, {
        ...movement,
        ingredientId: id,
      });
    } else {
      await stockModel.recordMovement({
        ...movement,
        productId: id,
        allowNegative: true,
        conn,
      });
    }
  }
}

// Restaure le stock déduit pour une commande (annulation, suppression).
async function restoreOrderIngredients(conn, orderId, motif) {
  const [[order]] = await conn.query(
    'SELECT stock_deducted_at, order_ingredients_deducted FROM orders WHERE id = ? FOR UPDATE',
    [orderId]
  );
  if (!order?.stock_deducted_at) return;
  const [items] = await conn.query('SELECT product_id, quantite FROM order_items WHERE order_id = ?', [orderId]);
  await syncOrderIngredients(conn, {
    orderId,
    fromItems: items,
    toItems: [],
    motif,
    includeRecipeIngredients: Boolean(order.order_ingredients_deducted),
  });
  await conn.query(
    'UPDATE orders SET stock_deducted_at = NULL, order_ingredients_deducted = 0 WHERE id = ?',
    [orderId]
  );
}

const RestaurantCashiers = createCrudModel({
  table: 'restaurant_cashiers', pk: 'id',
  fields: ['nom', 'statut'],
  sortable: ['id', 'nom', 'statut'],
});

const RestaurantSessions = createCrudModel({
  table: 'restaurant_sessions', pk: 'id',
  fields: ['cashier_id', 'user_id', 'ouverture_at', 'fermeture_at', 'fond_initial', 'fond_final', 'ecart'],
  sortable: ['id', 'ouverture_at', 'fermeture_at'],
});

// --- Logique métier -------------------------------------------------------

// Crée une commande + ses lignes, calcule le montant_total automatiquement.
async function createOrderWithItems({ clientId, tableId, items, notes, locationType, specialPersonName }) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, it) => sum + Number(it.quantite) * Number(it.prix_unitaire), 0);

    const [result] = await conn.query(
      `INSERT INTO orders (client_id, table_id, source_module, montant_total, statut, created_at, notes, location_type, special_person_name, order_ingredients_deducted)
      VALUES (?, ?, 'RESTAURANT', ?, 'EN_ATTENTE', NOW(), ?, ?, ?, 0)`,
      [clientId, tableId, montantTotal, notes || null, locationType || null, specialPersonName || null]
    );
    const orderId = result.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantite, prix_unitaire, cuisson) VALUES (?, ?, ?, ?, ?)`,
        [orderId, it.product_id, it.quantite, it.prix_unitaire, it.cuisson || null]
      );
    }
    await syncOrderIngredients(conn, {
      orderId,
      fromItems: [],
      toItems: items,
      motif: `Commande restaurant #${orderId}`,
      includeRecipeIngredients: false,
    });
    await conn.query('UPDATE orders SET stock_deducted_at = NOW() WHERE id = ?', [orderId]);
    const [order] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    return order[0];
  });
}

async function updateOrderWithItems({ orderId, clientId, tableId, items, notes, locationType, specialPersonName }) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, item) => sum + Number(item.quantite) * Number(item.prix_unitaire), 0);
    const [existingRows] = await conn.query(
      'SELECT id, statut, stock_deducted_at, order_ingredients_deducted FROM orders WHERE id = ? LIMIT 1 FOR UPDATE',
      [orderId]
    );
    if (!existingRows[0]) return null;
    // Seul l'écart entre l'ancienne et la nouvelle commande passe dans le stock.
    const [previousItems] = await conn.query('SELECT product_id, quantite FROM order_items WHERE order_id = ?', [orderId]);
    const deducted = Boolean(existingRows[0].stock_deducted_at);
    if (deducted && Boolean(existingRows[0].order_ingredients_deducted)) {
      await syncOrderIngredients(conn, {
        orderId,
        fromItems: previousItems,
        toItems: [],
        motif: `Commande restaurant #${orderId} modifiée`,
        includeProductStock: false,
      });
    }
    if (deducted || existingRows[0].statut !== 'ANNULEE') {
      await syncOrderIngredients(conn, {
        orderId,
        fromItems: deducted ? previousItems : [],
        toItems: items,
        motif: `Commande restaurant #${orderId} modifiée`,
        includeRecipeIngredients: false,
      });
      await conn.query('UPDATE orders SET stock_deducted_at = NOW() WHERE id = ?', [orderId]);
    }

    await conn.query(
      `UPDATE orders
       SET client_id = ?, table_id = ?, montant_total = ?, notes = ?, location_type = ?, special_person_name = ?,
           order_ingredients_deducted = 0
       WHERE id = ?`,
      [clientId || null, tableId || null, montantTotal, notes || null, locationType || null, specialPersonName || null, orderId]
    );
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    for (const item of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantite, prix_unitaire, cuisson) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.quantite, item.prix_unitaire, item.cuisson || null]
      );
    }

    const [orders] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [orderItems] = await conn.query(
      `SELECT oi.*, p.nom AS product_nom FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    return { ...orders[0], items: orderItems };
  });
}

async function orderWithItems(orderId) {
  const [orderRows] = await pool.query(
    `SELECT o.*, t.numero AS table_numero
     FROM orders o
     LEFT JOIN tables_restaurant t ON t.id = o.table_id
     WHERE o.id = ?`,
    [orderId]
  );
  if (!orderRows[0]) return null;
  const [items] = await pool.query(
    `SELECT oi.*, p.nom AS product_nom FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  const [payments] = await pool.query(
    'SELECT moyen_paiement FROM payments WHERE order_id = ? ORDER BY date_paiement DESC, id DESC LIMIT 1',
    [orderId]
  );
  return { ...orderRows[0], moyen_paiement: payments[0]?.moyen_paiement || null, items };
}

Orders.findAll = async function(options) {
  await ensureRestaurantSchema();
  const opts = options ? { ...options } : {};
  opts.whereSql = restaurantOrderScope(opts.whereSql);
  if (!opts.include_closed) {
    if (!opts.whereSql) {
      opts.whereSql = 'WHERE (cloturee = 0 OR cloturee IS NULL)';
    } else if (!opts.whereSql.includes('cloturee')) {
      const trimmed = opts.whereSql.trim();
      if (trimmed.toUpperCase().startsWith('WHERE')) {
        opts.whereSql = trimmed.replace(/^WHERE/i, 'WHERE (cloturee = 0 OR cloturee IS NULL) AND (') + ')';
      } else {
        opts.whereSql = '(cloturee = 0 OR cloturee IS NULL) AND (' + trimmed + ')';
      }
    }
  }
  const rows = await ordersFindAll.call(this, opts);
  return Promise.all(rows.map((row) => orderWithItems(row.id)));
};

Orders.count = async function(options) {
  const opts = options ? { ...options } : {};
  opts.whereSql = restaurantOrderScope(opts.whereSql);
  return ordersCount.call(this, opts);
};

Orders.findById = orderWithItems;
Orders.create = async function(data) {
  const row = await ordersCreate.call(this, data);
  return orderWithItems(row.id);
};
Orders.update = async function(id, data) {
  await ordersUpdate.call(this, id, data);
  return orderWithItems(id);
};
Orders.remove = async function(id) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const [orders] = await conn.query(
      "SELECT id, table_id FROM orders WHERE id = ? AND source_module = 'RESTAURANT' LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!orders[0]) return false;

    await restoreOrderIngredients(conn, id, `Commande restaurant #${id} supprimée`);

    await conn.query('DELETE FROM payments WHERE order_id = ?', [id]);
    await conn.query(
      `DELETE FROM financial_transactions
       WHERE module = 'RESTAURANT' AND reference_id = ?`,
      [id]
    );
    await conn.query('DELETE FROM order_items WHERE order_id = ?', [id]);
    const [result] = await conn.query('DELETE FROM orders WHERE id = ?', [id]);
    if (orders[0].table_id) {
      const [[activeOrder]] = await conn.query(
        `SELECT COUNT(*) AS total FROM orders
         WHERE table_id = ? AND statut NOT IN ('PAYEE', 'PAYE', 'ANNULEE')`,
        [orders[0].table_id]
      );
      if (Number(activeOrder.total) === 0) {
        await conn.query('UPDATE tables_restaurant SET statut = "LIBRE" WHERE id = ?', [orders[0].table_id]);
      }
    }
    return result.affectedRows > 0;
  });
};

// Changement de statut : une commande annulée rend ses ingrédients au stock.
async function updateOrderStatus(orderId, statut) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const [[order]] = await conn.query('SELECT id FROM orders WHERE id = ? FOR UPDATE', [orderId]);
    if (!order) return null;
    if (statut === 'ANNULEE') {
      await restoreOrderIngredients(conn, orderId, `Commande restaurant #${orderId} annulée`);
    }
    await conn.query('UPDATE orders SET statut = ? WHERE id = ?', [statut, orderId]);
    const [[updated]] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    return updated;
  });
}

async function closeAllRestaurantOrders(orderIds = []) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const ids = [...new Set(orderIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    let affectedRows = 0;
    if (ids.length > 0) {
      const [res] = await conn.query(
        'UPDATE orders SET cloturee = 1, cloture_at = NOW() WHERE id IN (?) AND (cloturee = 0 OR cloturee IS NULL)',
        [ids]
      );
      affectedRows = res.affectedRows;
    } else {
      const [res] = await conn.query(
        "UPDATE orders SET cloturee = 1, cloture_at = NOW() WHERE (source_module = 'RESTAURANT' OR source_module IS NULL) AND (cloturee = 0 OR cloturee IS NULL)"
      );
      affectedRows = res.affectedRows;
    }

    await conn.query(
      "UPDATE financial_transactions SET cloturee = 1, cloture_at = NOW() WHERE UPPER(COALESCE(module, '')) = 'RESTAURANT' AND (cloturee = 0 OR cloturee IS NULL)"
    );

    return { closed_orders: affectedRows, hidden_from_daily_caisse: true };
  });
}

async function ordersByTable(statutFilter = 'EN_COURS') {
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE source_module = 'RESTAURANT' AND statut = ? AND (cloturee = 0 OR cloturee IS NULL) ORDER BY created_at DESC`,
    [statutFilter]
  );
  return rows;
}

module.exports = {
  TablesRestaurant, Orders, OrderItems,
  RestaurantCashiers, RestaurantSessions,
  createOrderWithItems, updateOrderWithItems, orderWithItems, ordersByTable, ensureRestaurantSchema, ingredientNeeds,
  recordRestaurantIngredientMovement, consumeRestaurantRecipeIngredients,
  closeAllRestaurantOrders, updateOrderStatus,
};
