// controllers/restaurantController.js
const resto = require('../models/restaurantModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');
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
  const { client_id, table_id, items } = req.body;
  if (!items || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');
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
     FROM products p
     JOIN stock_locations sl ON sl.id = ?
     LEFT JOIN stocks s ON s.product_id = p.id AND s.location_id = sl.id
     WHERE p.actif = 1${req.query.type_produit ? ' AND p.type_produit = ?' : ''}
     ORDER BY p.nom ASC`,
    [req.query.location_id, ...(req.query.type_produit ? [req.query.type_produit] : [])]
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
  const { order_id, montant, moyen_paiement, client_id } = req.body;
  if (!order_id || !montant || !moyen_paiement) {
    throw ApiError.badRequest('order_id, montant et moyen_paiement sont requis');
  }
  
  const [result] = await pool.query(
    'INSERT INTO payments (order_id, montant, moyen_paiement, client_id, date_paiement) VALUES (?, ?, ?, ?, NOW())',
    [order_id, montant, moyen_paiement, client_id || null]
  );
  
  await pool.query(
    'UPDATE orders SET statut = "PAYE" WHERE id = ?',
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
  restaurantStockHandler, restaurantStockMovementsHandler, adjustRestaurantStockHandler,
  listRestaurantPurchasesHandler, restaurantPurchaseDetailHandler, createRestaurantPurchaseHandler,
  menuHandler, updateOrderStatusHandler, openCashierHandler, closeCashierHandler,
  cashierStatusHandler, processPaymentHandler, billToRoomHandler, statsHandler,
};
