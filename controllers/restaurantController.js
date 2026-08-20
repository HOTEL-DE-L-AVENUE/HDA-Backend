// controllers/restaurantController.js
const resto = require('../models/restaurantModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created, noContent } = require('../utils/apiResponse');
const { pool, withTransaction } = require('../config/db');
const stock = require('../models/stockModel');

const tablesCrud = createCrudController(resto.TablesRestaurant, { filterable: ['statut'] });
const ordersCrud = createCrudController(resto.Orders, { filterable: ['client_id', 'statut', 'source_module'] });
const orderItemsCrud = createCrudController(resto.OrderItems, { filterable: ['order_id', 'product_id'] });
const recipesCrud = createCrudController(resto.Recipes, { filterable: ['product_id'] });
const recipeItemsCrud = createCrudController(resto.RecipeItems, { filterable: ['recipe_id'] });
const cashiersCrud = createCrudController(resto.RestaurantCashiers, { filterable: ['statut'] });
const sessionsCrud = createCrudController(resto.RestaurantSessions, { filterable: ['cashier_id', 'user_id'] });

async function createOrderHandler(req, res) {
  // Debug: log incoming payload to help diagnose 400 errors from frontend
  console.debug('[restaurant] createOrderHandler body:', JSON.stringify(req.body));
  const { client_id, table_id, items } = req.body;
  if (!items || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');

  // Validate referenced entities to return clearer 400 errors instead of DB foreign-key messages
  try {
    if (client_id) {
      const [[client]] = await pool.query('SELECT id FROM clients WHERE id = ? LIMIT 1', [client_id]);
      if (!client) throw ApiError.badRequest(`client_id ${client_id} introuvable`);
    }

    if (table_id) {
      const [[tableRow]] = await pool.query('SELECT id FROM tables_restaurant WHERE id = ? LIMIT 1', [table_id]);
      if (!tableRow) throw ApiError.badRequest(`table_id ${table_id} introuvable`);
    }

    const productIds = items.map((it) => Number(it.product_id)).filter(Boolean);
    if (!productIds.length) throw ApiError.badRequest('Chaque ligne doit contenir product_id valide');
    const placeholders = productIds.map(() => '?').join(',');
    const [foundProducts] = await pool.query(`SELECT id FROM products WHERE id IN (${placeholders})`, productIds);
    const foundIds = new Set(foundProducts.map((p) => Number(p.id)));
    const missing = productIds.filter((id) => !foundIds.has(id));
    if (missing.length) throw ApiError.badRequest(`product_id introuvable: ${missing.join(',')}`);
  } catch (err) {
    // If it's an ApiError, rethrow so middleware returns the proper 400
    if (err instanceof ApiError) throw err;
    // Log unexpected SQL errors and return a generic bad request
    console.error('[restaurant] validation error', err);
    throw ApiError.badRequest('Données de référence invalides');
  }

  const order = await resto.createOrderWithItems({ clientId: client_id, tableId: table_id, items });
  return created(res, order);
}

async function orderDetailHandler(req, res) {
  const order = await resto.orderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, order);
}

async function ordersInProgressHandler(req, res) {
  const rows = await resto.ordersByTable(req.query.statut || 'EN_COURS');
  return ok(res, rows);
}

async function recipeRequirementsHandler(req, res) {
  const portions = Number(req.query.portions) || 1;
  const rows = await resto.recipeRequirements(req.params.id, portions);
  return ok(res, rows);
}

async function listRestaurantRecipesHandler(req, res) {
  const rows = await resto.listRecipesWithProducts();
  return ok(res, rows);
}

async function recipeByIdHandler(req, res) {
  const recipe = await resto.recipeWithItems(req.params.id);
  if (!recipe) throw ApiError.notFound(`Recette #${req.params.id} introuvable`);
  return ok(res, recipe);
}

async function createRecipeHandler(req, res) {
  const { product_id, nom, ingredients } = req.body || {};
  if (!product_id || !nom || !String(nom).trim()) {
    throw ApiError.badRequest('product_id et nom sont requis');
  }
  if (!Array.isArray(ingredients)) {
    throw ApiError.badRequest('ingredients doit être un tableau');
  }

  const rows = await resto.createRecipeWithItems({
    product_id: Number(product_id),
    nom: String(nom).trim(),
    ingredients,
  });
  return created(res, rows);
}

async function updateRecipeHandler(req, res) {
  const { nom, ingredients } = req.body || {};
  const existing = await resto.recipeWithItems(req.params.id);
  if (!existing) throw ApiError.notFound(`Recette #${req.params.id} introuvable`);

  const next = await resto.updateRecipeWithItems(req.params.id, {
    ...(nom !== undefined ? { nom } : {}),
    ...(ingredients !== undefined ? { ingredients } : {}),
  });
  return ok(res, next);
}

async function deleteRecipeHandler(req, res) {
  const deleted = await resto.deleteRecipeWithItems(req.params.id);
  if (!deleted) throw ApiError.notFound(`Recette #${req.params.id} introuvable`);
  return noContent(res);
}

async function restaurantStockHandler(req, res) {
  const conditions = [];
  const values = [];
  if (req.query.location_id) {
    conditions.push('s.location_id = ?');
    values.push(req.query.location_id);
  }
  if (req.query.type_produit) {
    conditions.push('p.type_produit = ?');
    values.push(req.query.type_produit);
  }

  const [rows] = await pool.query(
    `SELECT s.id, p.id AS product_id, sl.id AS location_id, COALESCE(s.quantite, 0) AS quantite,
            p.nom AS product_nom, p.unite, p.code, p.type_produit,
            sl.nom AS location_nom
     FROM stocks s
     JOIN products p ON p.id = s.product_id
     JOIN stock_locations sl ON sl.id = s.location_id
     WHERE p.actif = 1${req.query.location_id ? ' AND s.location_id = ?' : ''}${req.query.type_produit ? ' AND p.type_produit = ?' : ''}
     ORDER BY p.nom ASC`,
    [...(req.query.location_id ? [req.query.location_id] : []), ...(req.query.type_produit ? [req.query.type_produit] : [])]
  );
  return ok(res, rows);
}

async function restaurantStockMovementsHandler(req, res) {
  const conditions = [];
  const values = [];
  if (req.query.location_id) {
    conditions.push('m.location_id = ?');
    values.push(req.query.location_id);
  }
  const [rows] = await pool.query(
    `SELECT m.*, p.nom AS product_nom, p.unite, sl.nom AS location_nom
     FROM stock_movements m
     JOIN products p ON p.id = m.product_id
     JOIN stock_locations sl ON sl.id = m.location_id
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY m.created_at DESC, m.id DESC LIMIT 100`,
    values
  );
  return ok(res, rows);
}

async function adjustRestaurantStockHandler(req, res) {
  const { product_id, location_id, type_mouvement, quantite, source_module, reference_id } = req.body || {};
  const quantity = Number(quantite);
  if (!product_id || !location_id || !['ENTREE', 'SORTIE'].includes(type_mouvement) || !Number.isFinite(quantity) || quantity <= 0) {
    throw ApiError.badRequest('product_id, location_id, type_mouvement et quantite positive sont requis');
  }

  await stock.recordMovement({
    productId: product_id,
    locationId: location_id,
    type: type_mouvement,
    quantite: quantity,
    sourceModule: source_module || 'MANUEL',
    referenceId: reference_id,
  });
  const [rows] = await pool.query(
    'SELECT quantite FROM stocks WHERE product_id = ? AND location_id = ?',
    [product_id, location_id]
  );
  return ok(res, { newQty: Number(rows[0].quantite) });
}

// Supprime une ligne de stock pour le restaurant. Accepte soit `id` (stocks.id),
// soit `product_id` + `location_id` pour supprimer la ligne correspondante.
async function removeRestaurantStockHandler(req, res) {
  const { id } = req.query || {};
  const productId = req.query && req.query.product_id ? Number(req.query.product_id) : null;
  const locationId = req.query && req.query.location_id ? Number(req.query.location_id) : null;

  if (!id && (!productId || !locationId)) {
    throw ApiError.badRequest('id ou product_id+location_id requis');
  }

  const where = id ? 'id = ?' : 'product_id = ? AND location_id = ?';
  const params = id ? [id] : [productId, locationId];

  const [result] = await pool.query(`DELETE FROM stocks WHERE ${where}`, params);
  if (result.affectedRows === 0) {
    throw ApiError.notFound('Ligne de stock introuvable');
  }

  return noContent(res);
}
async function listRestaurantPurchasesHandler(req, res) {
  const [rows] = await pool.query(
    `SELECT pu.*, s.nom AS supplier_nom
     FROM purchases pu
     LEFT JOIN suppliers s ON s.id = pu.supplier_id
     ORDER BY pu.id DESC`
  );
  return ok(res, rows);
}

async function restaurantPurchaseDetailHandler(req, res) {
  const [purchases] = await pool.query(
    `SELECT pu.*, s.nom AS supplier_nom
     FROM purchases pu LEFT JOIN suppliers s ON s.id = pu.supplier_id
     WHERE pu.id = ?`,
    [req.params.id]
  );
  if (!purchases.length) throw ApiError.notFound(`Achat #${req.params.id} introuvable`);

  const [items] = await pool.query(
    `SELECT pi.*, p.nom AS product_nom, p.unite
     FROM purchase_items pi JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = ? ORDER BY pi.id ASC`,
    [req.params.id]
  );
  return ok(res, { ...purchases[0], items });
}

async function createRestaurantPurchaseHandler(req, res) {
  const { supplier_id, items } = req.body || {};
  if (!supplier_id || !Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('supplier_id et au moins une ligne d�achat sont requis');
  }
  for (const item of items) {
    if (!item.product_id || !item.location_id || Number(item.quantite) <= 0 || Number(item.prix_unitaire) < 0) {
      throw ApiError.badRequest('Chaque ligne exige product_id, location_id, quantite et prix_unitaire valides');
    }
  }

  const purchase = await withTransaction(async (conn) => {
    const total = items.reduce((sum, item) => sum + Number(item.quantite) * Number(item.prix_unitaire), 0);
    const [result] = await conn.query(
      "INSERT INTO purchases (supplier_id, montant_total, statut) VALUES (?, ?, 'RECU')",
      [supplier_id, total]
    );
    const purchaseId = result.insertId;

    for (const item of items) {
      const quantity = Number(item.quantite);
      await conn.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)',
        [purchaseId, item.product_id, quantity, Number(item.prix_unitaire)]
      );
      const [stocks] = await conn.query(
        'SELECT id FROM stocks WHERE product_id = ? AND location_id = ? FOR UPDATE',
        [item.product_id, item.location_id]
      );
      if (stocks.length) {
        await conn.query('UPDATE stocks SET quantite = quantite + ? WHERE id = ?', [quantity, stocks[0].id]);
      } else {
        await conn.query('INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, ?, ?)', [item.product_id, item.location_id, quantity]);
      }
      await conn.query(
        `INSERT INTO stock_movements (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at)
         VALUES (?, ?, 'ENTREE', ?, 'ACHAT', ?, NOW())`,
        [item.product_id, item.location_id, quantity, purchaseId]
      );
    }
    const [[createdPurchase]] = await conn.query(
      `SELECT pu.*, s.nom AS supplier_nom FROM purchases pu LEFT JOIN suppliers s ON s.id = pu.supplier_id WHERE pu.id = ?`,
      [purchaseId]
    );
    return createdPurchase;
  });

  return created(res, purchase);
}

async function menuHandler(req, res) {
  const [rows] = await pool.query(
    `SELECT p.*, c.nom AS category_nom 
     FROM products p 
     LEFT JOIN categories c ON c.id = p.category_id 
     WHERE p.actif = 1 AND p.type_produit = 'MENU' 
     ORDER BY c.nom, p.nom`
  );
  return ok(res, rows);
}

async function updateOrderStatusHandler(req, res) {
  console.debug('[restaurant] updateOrderStatusHandler params:', req.params, 'body:', JSON.stringify(req.body));
  const { statut } = req.body;
  if (!statut) throw ApiError.badRequest('statut est requis');
  
  const [result] = await pool.query(
    'UPDATE orders SET statut = ? WHERE id = ?',
    [statut, req.params.id]
  );
  if (result.affectedRows === 0) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  return ok(res, order);
}

async function openCashierHandler(req, res) {
  const { nom, user_id, fond_initial } = req.body;
  if (!nom || !user_id || fond_initial === undefined) {
    throw ApiError.badRequest('nom, user_id et fond_initial sont requis');
  }
  
  const [cashierResult] = await pool.query(
    'INSERT INTO restaurant_cashiers (nom, statut) VALUES (?, "OUVERT")',
    [nom]
  );
  const cashierId = cashierResult.insertId;
  
  const [sessionResult] = await pool.query(
    'INSERT INTO restaurant_sessions (cashier_id, user_id, fond_initial, ouverture_at) VALUES (?, ?, ?, NOW())',
    [cashierId, user_id, fond_initial]
  );
  
  return created(res, { cashier_id: cashierId, session_id: sessionResult.insertId });
}

async function closeCashierHandler(req, res) {
  const { session_id, fond_final } = req.body;
  if (!session_id || fond_final === undefined) {
    throw ApiError.badRequest('session_id et fond_final sont requis');
  }
  
  const [result] = await pool.query(
    'UPDATE restaurant_sessions SET fond_final = ?, fermeture_at = NOW() WHERE id = ? AND fermeture_at IS NULL',
    [fond_final, session_id]
  );
  if (result.affectedRows === 0) throw ApiError.notFound('Session non trouvée ou déjà fermée');
  
  await pool.query(
    'UPDATE restaurant_cashiers SET statut = "FERME" WHERE id = (SELECT cashier_id FROM restaurant_sessions WHERE id = ?)',
    [session_id]
  );
  
  return ok(res, { message: 'Session fermée' });
}

async function cashierStatusHandler(req, res) {
  const [cashiers] = await pool.query(
    `SELECT c.*, 
            (SELECT s.id FROM restaurant_sessions s WHERE s.cashier_id = c.id AND s.fermeture_at IS NULL LIMIT 1) as current_session_id,
            (SELECT s.user_id FROM restaurant_sessions s WHERE s.cashier_id = c.id AND s.fermeture_at IS NULL LIMIT 1) as current_user_id
     FROM restaurant_cashiers c`
  );
  return ok(res, cashiers);
}

async function processPaymentHandler(req, res) {
  await resto.ensureRestaurantSchema();
  console.debug('[restaurant] processPaymentHandler body:', JSON.stringify(req.body));
  const { order_id, montant, moyen_paiement, client_id } = req.body;
  if (!order_id || !montant || !moyen_paiement) {
    throw ApiError.badRequest('order_id, montant et moyen_paiement sont requis');
  }
  
  const [result] = await pool.query(
    'INSERT INTO payments (order_id, montant, moyen_paiement, client_id, date_paiement) VALUES (?, ?, ?, ?, NOW())',
    [order_id, montant, moyen_paiement, client_id || null]
  );
  
  await pool.query(
    'UPDATE orders SET statut = "PAYEE" WHERE id = ?',
    [order_id]
  );

  // Mirror the receipt in the consolidated Finance ledger.
  await pool.query(
    `INSERT INTO financial_transactions
       (client_id, module, type_flux, montant, reference_id, description, statut_sync, created_at)
     VALUES (?, 'RESTAURANT', 'ENTREE', ?, ?, ?, 'SYNCED', NOW())`,
    [client_id || null, montant, order_id, `Paiement commande restaurant #${order_id}`]
  );

  return created(res, { payment_id: result.insertId });
}

async function billToRoomHandler(req, res) {
  const { order_id, room_id } = req.body;
  if (!order_id || !room_id) {
    throw ApiError.badRequest('order_id et room_id sont requis');
  }
  
  const [result] = await pool.query(
    'INSERT INTO invoices (client_id, montant_total, statut, date_facture) VALUES ((SELECT client_id FROM stays WHERE room_id = ? AND date_depart IS NULL LIMIT 1), (SELECT total FROM orders WHERE id = ?), "EMISE", NOW())',
    [room_id, order_id]
  );
  
  await pool.query(
    'UPDATE orders SET statut = "FACTURE" WHERE id = ?',
    [order_id]
  );
  
  return created(res, { invoice_id: result.insertId });
}

async function statsHandler(req, res) {
  const { date_debut, date_fin } = req.query;
  if (!date_debut || !date_fin) {
    throw ApiError.badRequest('date_debut et date_fin sont requis');
  }
  
  const [[ordersStats]] = await pool.query(
    `SELECT COUNT(*) as total_orders, SUM(total) as total_revenue 
     FROM orders 
     WHERE date_commande BETWEEN ? AND ?`,
    [date_debut, date_fin]
  );
  
  const [[paymentsStats]] = await pool.query(
    `SELECT COUNT(*) as total_payments, SUM(montant) as total_collected 
     FROM payments 
     WHERE date_paiement BETWEEN ? AND ?`,
    [date_debut, date_fin]
  );
  
  return ok(res, {
    orders: ordersStats,
    payments: paymentsStats
  });
}
module.exports = {
  tablesCrud, ordersCrud, orderItemsCrud, recipesCrud, recipeItemsCrud, cashiersCrud, sessionsCrud,
  createOrderHandler, orderDetailHandler, ordersInProgressHandler, recipeRequirementsHandler,
  listRestaurantRecipesHandler, recipeByIdHandler, createRecipeHandler, updateRecipeHandler,
  deleteRecipeHandler, restaurantStockHandler, restaurantStockMovementsHandler,
  adjustRestaurantStockHandler, removeRestaurantStockHandler,
  listRestaurantPurchasesHandler, restaurantPurchaseDetailHandler, createRestaurantPurchaseHandler,
  menuHandler, updateOrderStatusHandler, openCashierHandler, closeCashierHandler,
  cashierStatusHandler, processPaymentHandler, billToRoomHandler, statsHandler,
};
