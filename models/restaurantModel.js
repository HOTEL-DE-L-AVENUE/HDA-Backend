// models/restaurantModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const stockModel = require('./stockModel');

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

      // Add cuisson column to order_items for cooking level customization
      const [orderItemColumns] = await pool.query('SHOW COLUMNS FROM order_items');
      if (!orderItemColumns.some((column) => column.Field === 'cuisson')) {
        await pool.query('ALTER TABLE order_items ADD COLUMN cuisson VARCHAR(50) NULL AFTER prix_unitaire');
      }
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
// Chaque plat du menu a une recette (recipes / recipe_items, voir
// Database/seedRestaurantIngredients.js). Une commande sort du stock du restaurant
// les ingrédients de ses plats ; un produit sans recette mais stocké au restaurant
// (boisson, dessert prêt…) sort lui-même du stock.
const RESTAURANT_LOCATION_ID = 2;

// Quantités d'ingrédients par product_id pour une liste de lignes de commande.
async function ingredientNeeds(conn, items) {
  const needs = new Map();
  const add = (productId, qty) => needs.set(productId, (needs.get(productId) || 0) + qty);
  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantite);
    if (!productId || !(quantity > 0)) continue;
    const [recipeItems] = await conn.query(
      `SELECT ri.ingredient_id, ri.quantite
         FROM recipes r JOIN recipe_items ri ON ri.recipe_id = r.id
        WHERE r.product_id = ?`,
      [productId]
    );
    if (recipeItems.length) {
      recipeItems.forEach((ri) => add(Number(ri.ingredient_id), Number(ri.quantite) * quantity));
      continue;
    }
    const [[stocked]] = await conn.query(
      'SELECT id FROM stocks WHERE product_id = ? AND location_id = ? LIMIT 1',
      [productId, RESTAURANT_LOCATION_ID]
    );
    if (stocked) add(productId, quantity);
  }
  return needs;
}

// Fait passer le stock de l'état « lignes `fromItems` déduites » à « lignes `toItems` déduites ».
// Le stock peut devenir négatif : le service en salle n'est jamais bloqué, l'article
// apparaît alors en rupture sur la page Stock.
async function syncOrderIngredients(conn, { orderId, fromItems, toItems, motif }) {
  const before = await ingredientNeeds(conn, fromItems);
  const after = await ingredientNeeds(conn, toItems);
  for (const productId of new Set([...before.keys(), ...after.keys()])) {
    const delta = Math.round(((after.get(productId) || 0) - (before.get(productId) || 0)) * 1000) / 1000;
    if (delta === 0) continue;
    await stockModel.recordMovement({
      productId,
      locationId: RESTAURANT_LOCATION_ID,
      type: delta > 0 ? 'SORTIE' : 'ENTREE',
      quantite: Math.abs(delta),
      sourceModule: 'RESTAURANT',
      referenceId: orderId,
      motif: delta > 0 ? motif : `${motif} (retour en stock)`,
      allowNegative: true,
      conn,
    });
  }
}

// Remet en stock les ingrédients d'une commande déjà déduite (annulation, suppression).
async function restoreOrderIngredients(conn, orderId, motif) {
  const [[order]] = await conn.query('SELECT stock_deducted_at FROM orders WHERE id = ? FOR UPDATE', [orderId]);
  if (!order?.stock_deducted_at) return;
  const [items] = await conn.query('SELECT product_id, quantite FROM order_items WHERE order_id = ?', [orderId]);
  await syncOrderIngredients(conn, { orderId, fromItems: items, toItems: [], motif });
  await conn.query('UPDATE orders SET stock_deducted_at = NULL WHERE id = ?', [orderId]);
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
      `INSERT INTO orders (client_id, table_id, source_module, montant_total, statut, created_at, notes, location_type, special_person_name)
      VALUES (?, ?, 'RESTAURANT', ?, 'EN_ATTENTE', NOW(), ?, ?, ?)`,
      [clientId, tableId, montantTotal, notes || null, locationType || null, specialPersonName || null]
    );
    const orderId = result.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantite, prix_unitaire, cuisson) VALUES (?, ?, ?, ?, ?)`,
        [orderId, it.product_id, it.quantite, it.prix_unitaire, it.cuisson || null]
      );
    }
    await syncOrderIngredients(conn, { orderId, fromItems: [], toItems: items, motif: `Commande restaurant #${orderId}` });
    await conn.query('UPDATE orders SET stock_deducted_at = NOW() WHERE id = ?', [orderId]);
    const [order] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    return order[0];
  });
}

async function updateOrderWithItems({ orderId, clientId, tableId, items, notes, locationType, specialPersonName }) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, item) => sum + Number(item.quantite) * Number(item.prix_unitaire), 0);
    const [existingRows] = await conn.query('SELECT id, statut, stock_deducted_at FROM orders WHERE id = ? LIMIT 1 FOR UPDATE', [orderId]);
    if (!existingRows[0]) return null;
    // Seul l'écart entre l'ancienne et la nouvelle commande passe dans le stock.
    const [previousItems] = await conn.query('SELECT product_id, quantite FROM order_items WHERE order_id = ?', [orderId]);
    const deducted = Boolean(existingRows[0].stock_deducted_at);
    if (deducted || existingRows[0].statut !== 'ANNULEE') {
      await syncOrderIngredients(conn, {
        orderId,
        fromItems: deducted ? previousItems : [],
        toItems: items,
        motif: `Commande restaurant #${orderId} modifiée`,
      });
      await conn.query('UPDATE orders SET stock_deducted_at = NOW() WHERE id = ?', [orderId]);
    }

    await conn.query(
      `UPDATE orders
       SET client_id = ?, table_id = ?, montant_total = ?, notes = ?, location_type = ?, special_person_name = ?
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
    const [orders] = await conn.query('SELECT id, table_id FROM orders WHERE id = ? LIMIT 1', [id]);
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

// Recipe helpers removed

module.exports = {
  TablesRestaurant, Orders, OrderItems,
  RestaurantCashiers, RestaurantSessions,
  createOrderWithItems, updateOrderWithItems, orderWithItems, ordersByTable, ensureRestaurantSchema,
  closeAllRestaurantOrders, updateOrderStatus,
};
