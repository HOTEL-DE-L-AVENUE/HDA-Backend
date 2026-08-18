// models/restaurantModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

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

      const [paymentColumns] = await pool.query('SHOW COLUMNS FROM payments');
      if (!paymentColumns.some((column) => column.Field === 'order_id')) {
        await pool.query('ALTER TABLE payments ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER id');
      }
      if (!paymentColumns.some((column) => column.Field === 'date_paiement')) {
        await pool.query('ALTER TABLE payments ADD COLUMN date_paiement DATETIME NULL AFTER moyen_paiement');
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

// `orders` est une table générique partagée entre modules (source_module)
const Orders = createCrudModel({
  table: 'orders', pk: 'id',
  fields: ['client_id', 'table_id', 'source_module', 'montant_total', 'statut', 'created_at'],
  sortable: ['id', 'created_at', 'montant_total', 'statut'],
});

const OrderItems = createCrudModel({
  table: 'order_items', pk: 'id',
  fields: ['order_id', 'product_id', 'quantite', 'prix_unitaire'],
  sortable: ['id'],
});

const Recipes = createCrudModel({
  table: 'recipes', pk: 'id',
  fields: ['product_id', 'nom'],
  sortable: ['id', 'nom'],
});

const RecipeItems = createCrudModel({
  table: 'recipe_items', pk: 'id',
  fields: ['recipe_id', 'ingredient_id', 'quantite'],
  sortable: ['id'],
});

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
async function createOrderWithItems({ clientId, tableId, items }) {
  await ensureRestaurantSchema();
  return withTransaction(async (conn) => {
    const montantTotal = items.reduce((sum, it) => sum + Number(it.quantite) * Number(it.prix_unitaire), 0);

    const [result] = await conn.query(
      `INSERT INTO orders (client_id, table_id, source_module, montant_total, statut, created_at)
       VALUES (?, ?, 'RESTAURANT', ?, 'EN_COURS', NOW())`,
      [clientId, tableId, montantTotal]
    );
    const orderId = result.insertId;

    for (const it of items) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)`,
        [orderId, it.product_id, it.quantite, it.prix_unitaire]
      );
    }
    const [order] = await conn.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    return order[0];
  });
}

async function orderWithItems(orderId) {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!orderRows[0]) return null;
  const [items] = await pool.query(
    `SELECT oi.*, p.nom AS product_nom FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?`,
    [orderId]
  );
  return { ...orderRows[0], items };
}

async function ordersByTable(statutFilter = 'EN_COURS') {
  const [rows] = await pool.query(
    `SELECT * FROM orders WHERE source_module = 'RESTAURANT' AND statut = ? ORDER BY created_at DESC`,
    [statutFilter]
  );
  return rows;
}

// Décompose une recette en besoins de matières premières pour N portions
async function recipeRequirements(recipeId, portions = 1) {
  const [rows] = await pool.query(
    `SELECT ri.ingredient_id, p.nom, (ri.quantite * ?) AS quantite_necessaire, p.unite
     FROM recipe_items ri
     JOIN products p ON p.id = ri.ingredient_id
     WHERE ri.recipe_id = ?`,
    [portions, recipeId]
  );
  return rows;
}

module.exports = {
  TablesRestaurant, Orders, OrderItems, Recipes, RecipeItems,
  RestaurantCashiers, RestaurantSessions,
  createOrderWithItems, orderWithItems, ordersByTable, recipeRequirements, ensureRestaurantSchema,
};
