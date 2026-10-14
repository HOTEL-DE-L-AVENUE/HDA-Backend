// controllers/restaurantController.js
const resto = require('../models/restaurantModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { convertQuantity } = require('../utils/unitConversion');
const { ok, created, noContent } = require('../utils/apiResponse');
const { pool, withTransaction } = require('../config/db');
const stock = require('../models/stockModel');
const PDFDocument = require('pdfkit');
const { getRestaurantReport, saveRestaurantReport } = require('../models/restaurantReport.model');
const { getProductHistory } = require('../models/restaurantProductHistory.model');
const { nextRestaurantProductCode: formatNextRestaurantProductCode } = require('../utils/restaurantProductCode');

// Simple HTML escaper for values interpolated into the invoice template
function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const tablesCrud = createCrudController(resto.TablesRestaurant, { filterable: ['statut'] });
const ordersCrud = createCrudController(resto.Orders, { filterable: ['client_id', 'statut', 'source_module'] });

async function getRestaurantReportHandler(req, res) {
  return ok(res, await getRestaurantReport(req.params.date));
}

async function saveRestaurantReportHandler(req, res) {
  const { reportDate, personnel, manual, metrics } = req.body || {};
  return ok(res, await saveRestaurantReport({
    reportDate,
    personnel,
    manual,
    metrics,
    createdBy: req.user?.id_admin ?? null,
  }));
}

async function getProductHistoryHandler(req, res) {
  const { dateFrom, dateTo, productName } = req.query;
  const history = await getProductHistory({ dateFrom, dateTo, productName });
  return ok(res, history);
}

const orderItemsCrud = createCrudController(resto.OrderItems, { filterable: ['order_id', 'product_id'] });
const cashiersCrud = createCrudController(resto.RestaurantCashiers, { filterable: ['statut'] });
const sessionsCrud = createCrudController(resto.RestaurantSessions, { filterable: ['cashier_id', 'user_id'] });

const normalizeRestaurantProductName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

async function saveRestaurantProductRecipe(conn, productId, productName, recipeIngredients, {
  consumeIngredients = false,
  userId = null,
} = {}) {
  const ingredients = [];
  const seenIds = new Set();

  for (const item of recipeIngredients) {
    const quantity = Number(item?.quantite);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw ApiError.badRequest('Chaque ingrédient doit avoir une quantité positive');
    }

    const ingredientId = Number(item?.ingredient_id);
    if (!ingredientId || !Number.isInteger(ingredientId)) {
      throw ApiError.badRequest('ingredient_id est requis et doit être un entier valide');
    }
    if (seenIds.has(ingredientId)) throw ApiError.badRequest('Un ingrédient ne peut apparaître qu\'une seule fois');

    const [[ingredient]] = await conn.query(
      'SELECT id, nom, unite FROM restaurant_ingredients WHERE id = ? AND actif = 1',
      [ingredientId]
    );
    if (!ingredient) throw ApiError.badRequest(`Ingrédient #${ingredientId} introuvable ou inactif`);

    const stockUnit = ingredient.unite;
    const recipeUnit = String(item?.unite || '').trim() || stockUnit;

    if (convertQuantity(1, recipeUnit, stockUnit) === null) {
      throw ApiError.badRequest(`Unité « ${recipeUnit} » incompatible avec l'unité de stock « ${stockUnit} » pour un ingrédient du plat`);
    }

    seenIds.add(ingredientId);
    ingredients.push({
      ingredientId,
      quantity,
      unit: recipeUnit,
      stockUnit,
      name: ingredient.nom,
    });
  }

  const [[productStock]] = await conn.query(
    'SELECT id FROM stocks WHERE product_id = ? AND location_id = 2 LIMIT 1',
    [productId]
  );
  if (!productStock) {
    await conn.query(
      'INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, 2, 0)',
      [productId]
    );
  }

  const [[recipe]] = await conn.query(
    'SELECT id FROM recipes WHERE product_id = ? ORDER BY id LIMIT 1 FOR UPDATE',
    [productId]
  );
  let recipeId = recipe?.id;
  if (recipeId) {
    await conn.query('UPDATE recipes SET nom = ? WHERE id = ?', [`Recette: ${productName}`, recipeId]);
    await conn.query('DELETE FROM recipe_items WHERE recipe_id = ?', [recipeId]);
  } else {
    const [createdRecipe] = await conn.query(
      'INSERT INTO recipes (product_id, nom) VALUES (?, ?)',
      [productId, `Recette: ${productName}`]
    );
    recipeId = createdRecipe.insertId;
  }

  for (const ingredient of ingredients) {
    await conn.query(
      'INSERT INTO recipe_items (recipe_id, ingredient_id, quantite, unite) VALUES (?, ?, ?, ?)',
      [recipeId, ingredient.ingredientId, ingredient.quantity, ingredient.unit]
    );
    const [[stockRow]] = await conn.query(
      'SELECT id FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = 2 LIMIT 1',
      [ingredient.ingredientId]
    );
    if (!stockRow) {
      await conn.query(
        'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite) VALUES (?, 2, 0)',
        [ingredient.ingredientId]
      );
    }
  }

  if (consumeIngredients && ingredients.length > 0) {
    await resto.consumeRestaurantRecipeIngredients(conn, {
      ingredients,
      productId,
      productName,
      userId,
    });
  }
}

async function nextRestaurantProductCode() {
  const year = new Date().getFullYear();
  const [rows] = await pool.query(
    `SELECT code
       FROM products
      WHERE source_module = 'RESTAURANT'
        AND code REGEXP ?`,
    [`^PLAT[0-9]+/${year}$`]
  );
  return formatNextRestaurantProductCode(rows.map((row) => row.code), year);
}

// Override productsCrud to only return menu items (PRODUIT_FINI) for restaurant
const productsCrud = {
  ...createCrudController(stock.Products, { filterable: ['category_id', 'subcategory_id', 'actif'] }),
  list: async (req, res) => {
    const { category_id, subcategory_id, actif } = req.query;
    let whereSql = "WHERE p.type_produit = 'PRODUIT_FINI' AND p.source_module = 'RESTAURANT'";
    const params = [];

    if (category_id) {
      whereSql += ' AND p.category_id = ?';
      params.push(category_id);
    }
    if (subcategory_id) {
      whereSql += ' AND p.subcategory_id = ?';
      params.push(subcategory_id);
    }
    if (actif !== undefined) {
      whereSql += ' AND p.actif = ?';
      params.push(actif);
    }

    const [rows] = await pool.query(
      `SELECT p.*, c.nom AS category_nom, sc.nom AS subcategory_nom 
       FROM products p 
       LEFT JOIN categories c ON c.id = p.category_id 
       LEFT JOIN subcategories sc ON sc.id = p.subcategory_id 
       ${whereSql} 
       ORDER BY c.nom, p.nom`,
      params
    );
    return ok(res, rows);
  },
  getOne: async (req, res) => {
    const product = await stock.Products.findById(req.params.id);
    if (!product || product.source_module !== 'RESTAURANT') {
      throw ApiError.notFound(`Produit restaurant #${req.params.id} introuvable`);
    }
    return ok(res, product);
  },
  nextCode: async (req, res) => ok(res, { code: await nextRestaurantProductCode() }),
  create: async (req, res) => {
    const productName = String(req.body?.nom || '').trim();
    if (!productName) throw ApiError.badRequest('Le nom du produit est requis');
    if (req.body?.ingredients !== undefined && !Array.isArray(req.body.ingredients)) {
      throw ApiError.badRequest('ingredients doit être une liste');
    }
    const normalizedName = normalizeRestaurantProductName(productName);
    const [restaurantProducts] = await pool.query(
      "SELECT nom FROM products WHERE source_module = 'RESTAURANT' AND actif = 1"
    );
    const duplicate = normalizedName && restaurantProducts.some(
      (product) => normalizeRestaurantProductName(product.nom) === normalizedName
    );
    if (duplicate) {
      throw ApiError.conflict(`Le produit « ${productName} » est déjà enregistré et ne peut pas être ajouté une deuxième fois.`);
    }

    const code = await nextRestaurantProductCode();
    await resto.ensureRestaurantSchema();
    const product = await withTransaction(async (conn) => {
      const productData = {
        ...req.body,
        nom: productName,
        code,
        type_produit: 'PRODUIT_FINI',
        source_module: 'RESTAURANT',
        prix_achat: 0,
      };
      const columns = stock.Products.fields.filter((field) => productData[field] !== undefined);
      const values = columns.map((field) => (
        typeof productData[field] === 'boolean' ? Number(productData[field]) : productData[field]
      ));
      const [result] = await conn.query(
        `INSERT INTO products (${columns.map((field) => `\`${field}\``).join(', ')})
         VALUES (${columns.map(() => '?').join(', ')})`,
        values
      );
      const productId = Number(result.insertId);
      const [[productStock]] = await conn.query(
        'SELECT id FROM stocks WHERE product_id = ? AND location_id = 2 LIMIT 1',
        [productId]
      );
      if (!productStock) {
        await conn.query(
          'INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, 2, 0)',
          [productId]
        );
      }
      if (Array.isArray(req.body?.ingredients)) {
        await saveRestaurantProductRecipe(conn, productId, productName, req.body.ingredients, {
          consumeIngredients: true,
          userId: req.user?.id_admin ?? null,
        });
      }
      const [[createdProduct]] = await conn.query('SELECT * FROM products WHERE id = ?', [productId]);
      return createdProduct;
    });
    return created(res, product);
  },
  update: async (req, res) => {
    const product = await stock.Products.findById(req.params.id);
    if (!product || product.source_module !== 'RESTAURANT') {
      throw ApiError.notFound(`Produit restaurant #${req.params.id} introuvable`);
    }
    return ok(res, await stock.Products.update(req.params.id, {
      ...req.body,
      type_produit: 'PRODUIT_FINI',
      source_module: 'RESTAURANT',
    }));
  },
  remove: async (req, res) => {
    const product = await stock.Products.findById(req.params.id);
    if (!product || product.source_module !== 'RESTAURANT') {
      throw ApiError.notFound(`Produit restaurant #${req.params.id} introuvable`);
    }
    // Keep historical links by archiving the product, but free its menu code.
    await stock.Products.update(req.params.id, { actif: false, code: null });
    return noContent(res);
  }
};

async function restaurantIngredientsHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const [rows] = await pool.query(
    `SELECT id, nom, NULL AS code, unite, prix_achat
       FROM restaurant_ingredients
      WHERE actif = 1
      ORDER BY nom`
  );
  return ok(res, rows);
}

async function createRestaurantIngredientHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const { nom, unite, prix_achat, quantite, location_id } = req.body;
  
  if (!nom || !nom.trim()) throw ApiError.badRequest('Le nom de l\'ingrédient est requis');
  if (!unite || !unite.trim()) throw ApiError.badRequest('L\'unité est requise');
  if (!quantite || Number(quantite) < 0) throw ApiError.badRequest('La quantité doit être positive');
  
  const locationId = Number(location_id) || 2;
  
  await withTransaction(async (conn) => {
    const [result] = await conn.query(
      `INSERT INTO restaurant_ingredients (nom, unite, prix_achat, actif)
       VALUES (?, ?, ?, 1)`,
      [nom.trim(), unite.trim(), Number(prix_achat) || 0]
    );
    const ingredientId = result.insertId;
    
    await conn.query(
      `INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite)
       VALUES (?, ?, ?)`,
      [ingredientId, locationId, Number(quantite)]
    );
    
    await conn.query(
      `INSERT INTO restaurant_ingredient_stock_movements (ingredient_id, location_id, type_mouvement, quantite, source_module, created_at, stock_after, motif)
       VALUES (?, ?, 'ENTREE', ?, 'MANUEL', NOW(), ?, ?)`,
      [ingredientId, locationId, Number(quantite), Number(quantite), 'Création ingrédient']
    );
    
    const [[ingredient]] = await conn.query(
      'SELECT * FROM restaurant_ingredients WHERE id = ?',
      [ingredientId]
    );
    return ingredient;
  });
  
  return created(res, { message: 'Ingrédient créé avec succès' });
}

async function updateRestaurantIngredientHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const ingredientId = Number(req.params.id);
  const { nom, unite, prix_achat, quantite, location_id } = req.body || {};

  if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
    throw ApiError.badRequest('Identifiant d’ingrédient invalide');
  }
  if (typeof nom !== 'string' || !nom.trim()) {
    throw ApiError.badRequest('Le nom de l’ingrédient est requis');
  }
  if (typeof unite !== 'string' || !unite.trim()) {
    throw ApiError.badRequest('L’unité est requise');
  }
  const price = Number(prix_achat);
  const quantity = Number(quantite);
  const locationId = Number(location_id);
  if (!Number.isFinite(price) || price < 0) {
    throw ApiError.badRequest('Le prix d’achat doit être un nombre positif ou nul');
  }
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw ApiError.badRequest('La quantité doit être un nombre positif ou nul');
  }
  if (!Number.isInteger(locationId) || locationId <= 0) {
    throw ApiError.badRequest('Emplacement de stock invalide');
  }

  const updatedIngredient = await withTransaction(async (conn) => {
    const [[ingredient]] = await conn.query(
      'SELECT id, unite FROM restaurant_ingredients WHERE id = ? AND actif = 1 FOR UPDATE',
      [ingredientId]
    );
    if (!ingredient) throw ApiError.notFound(`Ingrédient #${ingredientId} introuvable`);

    const newUnit = unite.trim();
    if (newUnit !== ingredient.unite) {
      const [recipeUnits] = await conn.query(
        `SELECT ri.unite
           FROM recipe_items ri
           JOIN recipes r ON r.id = ri.recipe_id
          WHERE ri.ingredient_id = ?`,
        [ingredientId]
      );
      const incompatibleRecipe = recipeUnits.find(
        (recipe) => convertQuantity(1, recipe.unite || ingredient.unite, newUnit) === null
      );
      if (incompatibleRecipe) {
        throw ApiError.badRequest(
          `Impossible de modifier l’unité : elle est incompatible avec une unité utilisée dans les recettes (${incompatibleRecipe.unite || ingredient.unite}).`
        );
      }
    }

    const [[currentStock]] = await conn.query(
      `SELECT id, quantite FROM restaurant_ingredient_stocks
        WHERE ingredient_id = ? AND location_id = ? FOR UPDATE`,
      [ingredientId, locationId]
    );
    const previousQuantity = Number(currentStock?.quantite || 0);
    await conn.query(
      'UPDATE restaurant_ingredients SET nom = ?, unite = ?, prix_achat = ? WHERE id = ?',
      [nom.trim(), newUnit, price, ingredientId]
    );
    if (currentStock) {
      await conn.query(
        'UPDATE restaurant_ingredient_stocks SET quantite = ? WHERE id = ?',
        [quantity, currentStock.id]
      );
    } else {
      await conn.query(
        'INSERT INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite) VALUES (?, ?, ?)',
        [ingredientId, locationId, quantity]
      );
    }

    const unitChanged = newUnit !== ingredient.unite;
    const delta = quantity - previousQuantity;
    if (unitChanged || delta !== 0) {
      const movementType = unitChanged ? 'AJUSTEMENT' : delta > 0 ? 'ENTREE' : 'SORTIE';
      const movementQuantity = unitChanged ? quantity : Math.abs(delta);
      const movementNote = unitChanged
        ? `Modification de l’unité (${ingredient.unite} → ${newUnit}) et du stock`
        : 'Modification de la quantité du stock';
      await conn.query(
        `INSERT INTO restaurant_ingredient_stock_movements
           (ingredient_id, location_id, type_mouvement, quantite, source_module,
            created_at, stock_after, motif, user_id)
         VALUES (?, ?, ?, ?, 'MANUEL', NOW(), ?, ?, ?)`,
        [
          ingredientId,
          locationId,
          movementType,
          movementQuantity,
          quantity,
          movementNote,
          req.user?.id_admin ?? null,
        ]
      );
    }

    return { id: ingredientId, nom: nom.trim(), unite: newUnit, prix_achat: price, quantite: quantity };
  });

  return ok(res, updatedIngredient);
}

async function listRestaurantRecipesHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const [rows] = await pool.query(
    `SELECT p.id AS product_id, p.nom AS product_nom, ri.ingredient_id, ri.quantite,
            COALESCE(ri.unite, ip.unite) AS unite, ip.nom AS ingredient_nom
       FROM recipes r
       JOIN products p ON p.id = r.product_id
       JOIN recipe_items ri ON ri.recipe_id = r.id
       JOIN restaurant_ingredients ip ON ip.id = ri.ingredient_id
      WHERE p.source_module = 'RESTAURANT' AND p.type_produit = 'PRODUIT_FINI' AND p.actif = 1
      ORDER BY p.nom, ip.nom`
  );
  return ok(res, rows);
}

async function getRestaurantProductRecipeHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const [[product]] = await pool.query(
    "SELECT id FROM products WHERE id = ? AND source_module = 'RESTAURANT' AND type_produit = 'PRODUIT_FINI'",
    [req.params.id]
  );
  if (!product) throw ApiError.notFound(`Plat restaurant #${req.params.id} introuvable`);

  const [rows] = await pool.query(
    `SELECT ri.ingredient_id, ri.quantite, COALESCE(ri.unite, p.unite) AS unite,
            p.nom AS ingredient_nom, NULL AS ingredient_code, p.unite AS ingredient_unite
       FROM recipes r
       JOIN recipe_items ri ON ri.recipe_id = r.id
       JOIN restaurant_ingredients p ON p.id = ri.ingredient_id
      WHERE r.product_id = ?
      ORDER BY ri.id`,
    [req.params.id]
  );
  return ok(res, rows);
}

async function saveRestaurantProductRecipeHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const [[product]] = await pool.query(
    "SELECT id, nom FROM products WHERE id = ? AND source_module = 'RESTAURANT' AND type_produit = 'PRODUIT_FINI'",
    [req.params.id]
  );
  if (!product) throw ApiError.notFound(`Plat restaurant #${req.params.id} introuvable`);
  if (!Array.isArray(req.body?.ingredients)) {
    throw ApiError.badRequest('ingredients doit être une liste');
  }

  await withTransaction((conn) => saveRestaurantProductRecipe(
    conn,
    Number(req.params.id),
    product.nom,
    req.body.ingredients
  ));

  return ok(res, { message: 'Recette enregistrée et ingrédients disponibles dans le stock Restaurant' });
}

async function createOrderHandler(req, res) {
  console.debug('[restaurant] createOrderHandler body:', JSON.stringify(req.body));
  const { client_id, table_id, items, notes, location_type, special_person_name } = req.body;
  if (!items || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');

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
    if (err instanceof ApiError) throw err;
    console.error('[restaurant] validation error', err);
    throw ApiError.badRequest('Données de référence invalides');
  }

  const order = await resto.createOrderWithItems({ clientId: client_id, tableId: table_id, items, notes, locationType: location_type, specialPersonName: special_person_name });
  return created(res, order);
}

async function updateOrderHandler(req, res) {
  const { client_id, table_id, items, notes, location_type, special_person_name } = req.body;
  if (!Array.isArray(items) || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');

  const productIds = items.map((item) => Number(item.product_id)).filter(Boolean);
  const placeholders = productIds.map(() => '?').join(',');
  const [foundProducts] = await pool.query(`SELECT id FROM products WHERE id IN (${placeholders})`, productIds);
  const foundIds = new Set(foundProducts.map((product) => Number(product.id)));
  const missing = productIds.filter((id) => !foundIds.has(id));
  if (missing.length) throw ApiError.badRequest(`product_id introuvable: ${missing.join(',')}`);

  const order = await resto.updateOrderWithItems({
    orderId: req.params.id,
    clientId: client_id,
    tableId: table_id,
    items,
    notes,
    locationType: location_type,
    specialPersonName: special_person_name,
  });
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, order);
}

async function orderDetailHandler(req, res) {
  const order = await resto.orderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, order);
}

async function orderInvoiceHandler(req, res) {
  const order = await resto.orderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);

  let client = null;
  if (order.client_id) {
    const [[c]] = await pool.query('SELECT * FROM clients WHERE id = ? LIMIT 1', [order.client_id]);
    client = c || null;
  }

  const rows = order.items || [];
  const total = Number(order.montant_total || rows.reduce((s, r) => s + Number(r.quantite) * Number(r.prix_unitaire || 0), 0));

  const date = order.created_at ? new Date(order.created_at).toLocaleString() : '';
  const tableNum = order.table_numero || '';

  const rowsHtml = rows
    .map((r, idx) => {
      const qty = Number(r.quantite || 0);
      const pu = Number(r.prix_unitaire || 0);
      const lineTotal = (qty * pu).toFixed(2);
      const cuisson = r.cuisson ? ` (${escapeHtml(r.cuisson)})` : '';
      return `
        <tr>
          <td class="cell-center">${idx + 1}</td>
          <td>${escapeHtml(r.product_nom || `#${r.product_id || ''}`)}${cuisson}</td>
          <td class="cell-center">${qty}</td>
          <td class="cell-right">${pu.toFixed(2)}</td>
          <td class="cell-right">${lineTotal}</td>
        </tr>`;
    })
    .join('');

  const clientBlock = client
    ? `<div class="client"><strong>Client</strong><div>${escapeHtml((client.nom || client.name || '') + (client.prenom ? ' ' + client.prenom : ''))}</div><div>${escapeHtml(client.telephone || client.phone || '')}</div><div>${escapeHtml(client.email || '')}</div></div>`
    : '';

  const notesBlock = order.notes
    ? `<div class="notes" style="margin-top:6px;padding:4px;background:#f9f9f9;border:1px solid #ddd;font-size:11px;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</div>`
    : '';

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>Facture #${order.id}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#000;margin:0;padding:12px}
        .invoice{max-width:380px;margin:0 auto;background:#fff;padding:8px}
        h2{margin:6px 0;font-size:16px;text-align:center}
        .meta{font-size:12px;margin-bottom:6px}
        .client{font-size:12px;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        thead th, tbody td{border:1px solid #000;padding:6px}
        thead th{background:#f0f0f0}
        .cell-right{text-align:right}
        .cell-center{text-align:center}
        .footer{margin-top:8px;font-size:11px;text-align:center;color:#444}
        @media print{body{padding:0} .invoice{box-shadow:none}}
      </style>
    </head>
    <body>
      <div class="invoice">
        <h2>Facture #${order.id}</h2>
        <div class="meta">
          <div>Date: ${date}</div>
          <div>Table: ${tableNum}</div>
        </div>
        ${clientBlock}
        ${notesBlock}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Article</th>
              <th>Qté</th>
              <th>P.U</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div style="text-align:right;margin-top:8px;font-weight:bold;font-size:14px">
          Total: ${total.toFixed(2)} MGA
        </div>
        <div class="footer">
          Merci de votre visite !
        </div>
      </div>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

async function orderInvoicePdfHandler(req, res) {
  const order = await resto.orderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);

  let client = null;
  if (order.client_id) {
    const [[c]] = await pool.query('SELECT * FROM clients WHERE id = ? LIMIT 1', [order.client_id]);
    client = c || null;
  }

  const rows = order.items || [];
  const total = Number(order.montant_total || rows.reduce((s, r) => s + Number(r.quantite) * Number(r.prix_unitaire || 0), 0));

  const date = order.created_at ? new Date(order.created_at).toLocaleString() : '';
  const tableNum = order.table_numero || '';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=facture_${order.id}.pdf`);

  const doc = new PDFDocument({ margin: 30, size: [200, 300] });
  doc.pipe(res);

  doc.fontSize(12).text(`Facture #${order.id}`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Date: ${date}`);
  doc.text(`Table: ${tableNum}`);
  doc.moveDown();

  if (client) {
    doc.text(`Client: ${client.nom || client.name || ''} ${client.prenom || ''}`);
    doc.text(`Tel: ${client.telephone || client.phone || ''}`);
    doc.moveDown();
  }

  if (order.notes) {
    doc.text(`Notes: ${order.notes}`);
    doc.moveDown();
  }

  doc.fontSize(9);
  const tableTop = doc.y;
  const headers = ['#', 'Article', 'Qté', 'P.U', 'Total'];
  const colWidths = [15, 60, 20, 25, 25];
  let x = 0;
  headers.forEach((header, i) => {
    doc.text(header, x, tableTop, { width: colWidths[i] });
    x += colWidths[i];
  });
  doc.moveDown();

  rows.forEach((r, idx) => {
    const qty = Number(r.quantite || 0);
    const pu = Number(r.prix_unitaire || 0);
    const lineTotal = qty * pu;
    x = 0;
    doc.text(`${idx + 1}`, x, doc.y, { width: colWidths[0] });
    x += colWidths[0];
    doc.text(r.product_nom || `#${r.product_id}`, x, doc.y, { width: colWidths[1] });
    x += colWidths[1];
    doc.text(qty.toString(), x, doc.y, { width: colWidths[2] });
    x += colWidths[2];
    doc.text(pu.toFixed(2), x, doc.y, { width: colWidths[3] });
    x += colWidths[3];
    doc.text(lineTotal.toFixed(2), x, doc.y, { width: colWidths[4] });
    doc.moveDown();
  });

  doc.moveDown();
  doc.fontSize(12).text(`Total: ${total.toFixed(2)} MGA`, { align: 'right' });
  doc.fontSize(9).text('Merci de votre visite !', { align: 'center' });

  doc.end();
}

async function ordersInProgressHandler(req, res) {
  const [rows] = await pool.query(
    `SELECT o.*, c.nom as client_nom, c.prenom as client_prenom, t.numero as table_numero
       FROM orders o
       LEFT JOIN clients c ON c.id = o.client_id
       LEFT JOIN tables_restaurant t ON t.id = o.table_id
      WHERE o.source_module = 'RESTAURANT' AND o.statut != 'ANNULEE' AND o.statut != 'PAYEE'
      ORDER BY o.created_at ASC`
  );
  return ok(res, rows);
}

async function closeAllRestaurantOrdersHandler(req, res) {
  const [result] = await pool.query(
    `UPDATE orders
       SET statut = 'PAYEE', cloturee = 1, cloture_at = NOW()
      WHERE source_module = 'RESTAURANT'
        AND statut = 'EN_COURS'`
  );
  return ok(res, { message: `${result.affectedRows} commandes clôturées` });
}

async function restaurantStockHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const locationId = Number(req.query.location_id) || 2;
  const [rows] = await pool.query(
    `SELECT 'INGREDIENT' AS item_type, i.id AS ingredient_id, NULL AS product_id,
            i.nom AS product_nom, i.unite, s.quantite, s.location_id,
            l.nom AS location_nom, NULL AS type_produit, i.prix_achat
       FROM restaurant_ingredients i
       LEFT JOIN restaurant_ingredient_stocks s ON s.ingredient_id = i.id AND s.location_id = ?
       LEFT JOIN stock_locations l ON l.id = s.location_id
      WHERE i.actif = 1
      ORDER BY product_nom`,
    [locationId]
  );
  return ok(res, rows);
}

async function restaurantStockMovementsHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const locationId = Number(req.query.location_id) || 2;
  const [rows] = await pool.query(
    `SELECT 'INGREDIENT' AS item_type, m.ingredient_id, NULL AS product_id,
            i.nom AS product_nom, m.type_mouvement, m.quantite, m.created_at,
            m.stock_after, m.motif, u.nom AS user_nom
       FROM restaurant_ingredient_stock_movements m
       JOIN restaurant_ingredients i ON i.id = m.ingredient_id
       LEFT JOIN users u ON u.id_admin = m.user_id
      WHERE m.location_id = ?
      UNION ALL
      SELECT 'PRODUCT' AS item_type, NULL AS ingredient_id, m.product_id,
            p.nom AS product_nom, m.type_mouvement, m.quantite, m.created_at,
            m.stock_after, m.motif, u.nom AS user_nom
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id_admin = m.user_id
      WHERE m.location_id = ? AND p.source_module = 'RESTAURANT'
      ORDER BY created_at DESC, id DESC
      LIMIT 100`,
    [locationId, locationId]
  );
  return ok(res, rows);
}

async function adjustRestaurantStockHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const { ingredient_id, product_id, location_id, type_mouvement, quantite, source_module, motif } = req.query;
  
  if (!ingredient_id && !product_id) {
    throw ApiError.badRequest('ingredient_id ou product_id requis');
  }
  if (ingredient_id) {
    throw ApiError.badRequest('Modifiez un ingrédient depuis son action « Modifier » dans le stock Restaurant.');
  }
  if (!location_id) throw ApiError.badRequest('location_id requis');
  if (!type_mouvement || !['ENTREE', 'SORTIE', 'AJUSTEMENT'].includes(type_mouvement)) {
    throw ApiError.badRequest('type_mouvement doit être ENTREE, SORTIE ou AJUSTEMENT');
  }
  if (!quantite || Number(quantite) <= 0) throw ApiError.badRequest('quantite doit être positive');

  await stock.recordMovement({
    productId: Number(product_id),
    locationId: Number(location_id),
    type: type_mouvement,
    quantite: Number(quantite),
    sourceModule: source_module || 'MANUEL',
    motif,
    userId: req.user?.id_admin,
    allowNegative: true,
  });

  return ok(res, { message: 'Stock ajusté avec succès' });
}

async function removeRestaurantStockHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const { ingredient_id, product_id, location_id } = req.query;
  
  if (!ingredient_id && !product_id) {
    throw ApiError.badRequest('ingredient_id ou product_id requis');
  }
  const locationId = Number(location_id) || 2; // Restaurant location par défaut

  if (ingredient_id) {
    await withTransaction(async (conn) => {
      // Supprimer les références dans les recettes (cascade)
      await conn.query('DELETE FROM recipe_items WHERE ingredient_id = ?', [ingredient_id]);
      
      // Nettoyer les recettes vides
      await conn.query(
        'DELETE r FROM recipes r LEFT JOIN recipe_items ri ON ri.recipe_id = r.id WHERE ri.id IS NULL'
      );

      const [[stock]] = await conn.query(
        'SELECT quantite FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ?',
        [ingredient_id, locationId]
      );
      if (stock && Number(stock.quantite) > 0) {
        await resto.recordRestaurantIngredientMovement(conn, {
          ingredientId: Number(ingredient_id),
          locationId: locationId,
          type: 'SORTIE',
          quantite: Number(stock.quantite),
          sourceModule: 'MANUEL',
          motif: 'Suppression depuis la page Stock',
          userId: req.user?.id_admin,
        });
      }
      await conn.query(
        'DELETE FROM restaurant_ingredient_stocks WHERE ingredient_id = ? AND location_id = ?',
        [ingredient_id, locationId]
      );
      // Désactiver l'ingrédient au lieu de le supprimer (évite les contraintes legacy_product_id)
      await conn.query(
        'UPDATE restaurant_ingredients SET actif = 0 WHERE id = ?',
        [ingredient_id]
      );
    });
  } else {
    // Gestion directe pour les produits du restaurant
    await withTransaction(async (conn) => {
      const [[stockRow]] = await conn.query(
        'SELECT * FROM stocks WHERE product_id = ? AND location_id = ?',
        [product_id, locationId]
      );
      
      if (stockRow) {
        // Le stock existe, on peut le supprimer
        if (Number(stockRow.quantite) > 0) {
          await stock.recordMovement({
            productId: Number(product_id),
            locationId: locationId,
            type: 'SORTIE',
            quantite: Number(stockRow.quantite),
            sourceModule: 'MANUEL',
            motif: 'Suppression depuis la page Stock',
            userId: req.user?.id_admin,
            allowNegative: true,
            conn,
          });
        }
        await conn.query('DELETE FROM stocks WHERE id = ?', [stockRow.id]);
      }
      
      // Désactiver le produit dans la table products
      await conn.query(
        'UPDATE products SET actif = 0 WHERE id = ? AND source_module = "RESTAURANT"',
        [product_id]
      );
    });
  }

  return ok(res, { message: 'Article supprimé du stock' });
}

async function consumeRestaurantPortionHandler(req, res) {
  const { product_id, location_id, portion_size, portion_unit } = req.body;
  if (!product_id || !location_id || !portion_size) {
    throw ApiError.badRequest('product_id, location_id et portion_size requis');
  }
  const result = await stock.consumePortion({
    productId: Number(product_id),
    locationId: Number(location_id),
    portionSize: Number(portion_size),
    portionUnit: portion_unit || 'g',
  });
  return ok(res, result);
}

async function getRestaurantPurchasesHandler(req, res) {
  const locationId = Number(req.query.location_id) || 2;
  const [rows] = await pool.query(
    `SELECT p.id, s.nom AS supplier_nom, p.montant_total, p.statut, p.created_at
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.statut = 'RECU'
      ORDER BY p.created_at DESC
      LIMIT 50`
  );
  return ok(res, rows);
}

async function getRestaurantPurchaseByIdHandler(req, res) {
  const [[purchase]] = await pool.query(
    `SELECT p.*, s.nom AS supplier_nom
       FROM purchases p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.id = ?`,
    [req.params.id]
  );
  if (!purchase) throw ApiError.notFound(`Achat #${req.params.id} introuvable`);

  const [items] = await pool.query(
    `SELECT pi.*, pr.nom AS product_nom, pr.unite
       FROM purchase_items pi
       JOIN products pr ON pr.id = pi.product_id
      WHERE pi.purchase_id = ?`,
    [req.params.id]
  );

  return ok(res, { ...purchase, items });
}

async function createRestaurantPurchaseHandler(req, res) {
  const { supplier_id, location_id, items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('items requis');
  }
  const result = await stock.createPurchaseWithItems({
    supplierId: supplier_id,
    locationId: location_id || 2,
    items,
    sourceModule: 'RESTAURANT',
  });
  return created(res, result);
}

async function menuHandler(req, res) {
  await resto.ensureRestaurantSchema();
  const [rows] = await pool.query(
    `SELECT p.*, c.nom AS category_nom
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.source_module = 'RESTAURANT' AND p.type_produit = 'PRODUIT_FINI' AND p.actif = 1
      ORDER BY c.nom, p.nom`
  );
  return ok(res, rows);
}

async function updateOrderStatusHandler(req, res) {
  const { statut } = req.body;
  if (!statut || !['EN_ATTENTE', 'EN_COURS', 'PRETE', 'SERVIE', 'PAYEE', 'ANNULEE'].includes(statut)) {
    throw ApiError.badRequest('statut invalide');
  }

  await resto.ensureRestaurantSchema();
  await withTransaction(async (conn) => {
    const [[order]] = await conn.query(
      'SELECT * FROM orders WHERE id = ? AND source_module = "RESTAURANT" LIMIT 1 FOR UPDATE',
      [req.params.id]
    );
    if (!order) throw ApiError.notFound('Commande introuvable');
    
    // Si on annule une commande avec stock déduit, rétablir le stock
    if (statut === 'ANNULEE' && order.stock_deducted_at && order.statut !== 'ANNULEE') {
      const [orderItems] = await conn.query(
        'SELECT product_id, quantite FROM order_items WHERE order_id = ?',
        [req.params.id]
      );
      await resto.syncOrderIngredients(conn, {
        orderId: Number(req.params.id),
        fromItems: orderItems,
        toItems: [],
        motif: `Annulation commande restaurant #${req.params.id}`,
        includeRecipeIngredients: Boolean(order.order_ingredients_deducted),
      });
      await conn.query(
        'UPDATE orders SET stock_deducted_at = NULL, order_ingredients_deducted = 0 WHERE id = ?',
        [req.params.id]
      );
    }
    
    await conn.query(
      'UPDATE orders SET statut = ? WHERE id = ?',
      [statut, req.params.id]
    );
  });
  
  return ok(res, { message: 'Statut mis à jour' });
}

async function removeOrderHandler(req, res) {
  const deleted = await resto.Orders.remove(req.params.id);
  if (!deleted) throw ApiError.notFound('Commande introuvable');
  return noContent(res);
}

async function historyTotalHandler(req, res) {
  const { dateFrom, dateTo } = req.query;
  let whereSql = "WHERE source_module = 'RESTAURANT'";
  const params = [];
  if (dateFrom) {
    whereSql += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereSql += ' AND created_at <= ?';
    params.push(dateTo);
  }
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total_orders, SUM(montant_total) AS total_amount
       FROM orders ${whereSql}`,
    params
  );
  return ok(res, row);
}

async function openCashierHandler(req, res) {
  const { cashier_id, fond_initial } = req.body;
  const [result] = await pool.query(
    `INSERT INTO restaurant_sessions (cashier_id, user_id, ouverture_at, fond_initial)
     VALUES (?, ?, NOW(), ?)`,
    [cashier_id, req.user?.id_admin, fond_initial]
  );
  return created(res, result);
}

async function closeCashierHandler(req, res) {
  const { fond_final } = req.body;
  const [session] = await pool.query(
    'SELECT id FROM restaurant_sessions WHERE id = ? AND fermeture_at IS NULL',
    [req.params.id]
  );
  if (!session.length) throw ApiError.notFound('Session introuvable ou déjà fermée');

  const ecart = Number(fond_final) - Number(session[0].fond_initial);
  await pool.query(
    'UPDATE restaurant_sessions SET fermeture_at = NOW(), fond_final = ?, ecart = ? WHERE id = ?',
    [fond_final, ecart, req.params.id]
  );
  return ok(res, { message: 'Session fermée', ecart });
}

async function cashierStatusHandler(req, res) {
  const [[session]] = await pool.query(
    `SELECT s.*, c.nom AS cashier_nom
       FROM restaurant_sessions s
       LEFT JOIN restaurant_cashiers c ON c.id = s.cashier_id
      WHERE s.fermeture_at IS NULL
      ORDER BY s.ouverture_at DESC
      LIMIT 1`
  );
  return ok(res, session || null);
}

async function processPaymentHandler(req, res) {
  const { order_id, moyen_paiement, montant } = req.body;
  const [[order]] = await pool.query(
    'SELECT id, montant_total FROM orders WHERE id = ? AND source_module = "RESTAURANT"',
    [order_id]
  );
  if (!order) throw ApiError.notFound('Commande introuvable');

  const [result] = await pool.query(
    `INSERT INTO payments (order_id, moyen_paiement, montant, date_paiement)
     VALUES (?, ?, ?, NOW())`,
    [order_id, moyen_paiement, montant || order.montant_total]
  );

  await pool.query(
    'UPDATE orders SET statut = "PAYEE" WHERE id = ?',
    [order_id]
  );

  return created(res, result);
}

async function billToRoomHandler(req, res) {
  const { order_id, room_id } = req.body;
  const [[order]] = await pool.query(
    'SELECT id, montant_total FROM orders WHERE id = ? AND source_module = "RESTAURANT"',
    [order_id]
  );
  if (!order) throw ApiError.notFound('Commande introuvable');

  await pool.query(
    `INSERT INTO financial_transactions (module, type_flux, montant, reference_id, description, statut_sync, created_at)
     VALUES ('HOTEL', 'SORTIE', ?, ?, ?, 'SYNCED', NOW())`,
    [order.montant_total, order_id, `Facture restaurant #${order_id} vers chambre #${room_id}`]
  );

  await pool.query(
    'UPDATE orders SET statut = "PAYEE" WHERE id = ?',
    [order_id]
  );

  return ok(res, { message: 'Facture transférée à la chambre' });
}

async function statsHandler(req, res) {
  const { dateFrom, dateTo } = req.query;
  let whereSql = "WHERE source_module = 'RESTAURANT'";
  const params = [];
  if (dateFrom) {
    whereSql += ' AND created_at >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereSql += ' AND created_at <= ?';
    params.push(dateTo);
  }

  const [[stats]] = await pool.query(
    `SELECT 
       COUNT(*) AS total_orders,
       SUM(montant_total) AS total_revenue,
       AVG(montant_total) AS avg_order_value
       FROM orders ${whereSql}`,
    params
  );

  const [[topItems]] = await pool.query(
    `SELECT oi.product_id, p.nom AS product_nom, SUM(oi.quantite) AS total_quantity
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
      WHERE o.source_module = 'RESTAURANT' ${dateFrom ? ' AND o.created_at >= ?' : ''} ${dateTo ? ' AND o.created_at <= ?' : ''}
      GROUP BY oi.product_id, p.nom
      ORDER BY total_quantity DESC
      LIMIT 10`,
    dateFrom && dateTo ? [dateFrom, dateTo] : []
  );

  return ok(res, { ...stats, topItems });
}

const listRestaurantPurchasesHandler = getRestaurantPurchasesHandler;
const restaurantPurchaseDetailHandler = getRestaurantPurchaseByIdHandler;

module.exports = {
  getRestaurantReportHandler, saveRestaurantReportHandler,
  getProductHistoryHandler,
  tablesCrud, ordersCrud, orderItemsCrud, cashiersCrud, sessionsCrud, productsCrud,
  createOrderHandler, updateOrderHandler, orderDetailHandler, orderInvoiceHandler, ordersInProgressHandler,
  orderInvoicePdfHandler, closeAllRestaurantOrdersHandler,
  restaurantStockHandler, restaurantStockMovementsHandler,
  restaurantIngredientsHandler, createRestaurantIngredientHandler, updateRestaurantIngredientHandler, listRestaurantRecipesHandler, getRestaurantProductRecipeHandler, saveRestaurantProductRecipeHandler,
  adjustRestaurantStockHandler, removeRestaurantStockHandler, consumeRestaurantPortionHandler,
  getRestaurantPurchasesHandler, getRestaurantPurchaseByIdHandler,
  listRestaurantPurchasesHandler, restaurantPurchaseDetailHandler, createRestaurantPurchaseHandler,
  menuHandler, updateOrderStatusHandler, removeOrderHandler, historyTotalHandler, openCashierHandler, closeCashierHandler,
  cashierStatusHandler, processPaymentHandler, billToRoomHandler, statsHandler,
};
