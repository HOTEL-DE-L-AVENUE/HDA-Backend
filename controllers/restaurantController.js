// controllers/restaurantController.js
const resto = require('../models/restaurantModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created, noContent } = require('../utils/apiResponse');
const { pool, withTransaction } = require('../config/db');
const stock = require('../models/stockModel');
const PDFDocument = require('pdfkit');

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
const orderItemsCrud = createCrudController(resto.OrderItems, { filterable: ['order_id', 'product_id'] });
// Recipes removed: feature deprecated
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

// Return a simple printable HTML invoice for an order
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

  // Build a compact, table-focused HTML invoice (Bar-style)
  const rowsHtml = rows
    .map((r, idx) => {
      const qty = Number(r.quantite || 0);
      const pu = Number(r.prix_unitaire || 0);
      const lineTotal = (qty * pu).toFixed(2);
      return `
        <tr>
          <td class="cell-center">${idx + 1}</td>
          <td>${escapeHtml(r.product_nom || `#${r.product_id || ''}`)}</td>
          <td class="cell-center">${qty}</td>
          <td class="cell-right">${pu.toFixed(2)}</td>
          <td class="cell-right">${lineTotal}</td>
        </tr>`;
    })
    .join('');

  const clientBlock = client
    ? `<div class="client"><strong>Client</strong><div>${escapeHtml((client.nom || client.name || '') + (client.prenom ? ' ' + client.prenom : ''))}</div><div>${escapeHtml(client.telephone || client.phone || '')}</div><div>${escapeHtml(client.email || '')}</div></div>`
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
        <div class="meta">Date: ${escapeHtml(date)}${tableNum ? ' • Table: ' + escapeHtml(String(tableNum)) : ''}</div>
        ${clientBlock}
        <table>
          <thead>
            <tr>
              <th style="width:30px">#</th>
              <th>Produit</th>
              <th style="width:50px">Qté</th>
              <th style="width:70px">PU</th>
              <th style="width:80px">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3"></td>
              <td class="cell-right">Total</td>
              <td class="cell-right">${Number(total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="footer">Imprimé depuis HDA — Hotel de L'avenue</div>
      </div>
    </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
}

// Generate and return PDF invoice for an order (attachment)
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

  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="facture_commande_${order.id}.pdf"`);
  doc.pipe(res);

  // Simple layout constants
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  let y = 40;

  // Header - company
  doc.font('Helvetica-Bold').fontSize(14).text("Hotel de L'avenue", left, y);
  // Invoice meta on the right
  doc.fontSize(10).fillColor('#000').text(`Facture #${order.id}`, right - 150, y, { width: 150, align: 'right' });
  doc.fontSize(9).fillColor('#444').text(`${date}`, right - 150, y + 16, { width: 150, align: 'right' });
  y += 36;

  // Draw a thin separator
  doc.moveTo(left, y).lineTo(right, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
  y += 8;

  // Client block
  if (client) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('Client:', left, y);
    doc.font('Helvetica').fontSize(9).fillColor('#000').text(`${client.nom || client.name || ''} ${client.prenom || ''}`, left + 50, y);
    if (client.telephone) doc.text(`${client.telephone}`, left + 50, y + 12);
    if (client.email) doc.text(`${client.email}`, left + 50, y + 24);
  } else {
    doc.font('Helvetica').fontSize(9).fillColor('#000').text('Client: (non renseigné)', left, y);
  }
  // Order status on right of client block
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text('Statut:', right - 150, y);
  doc.font('Helvetica').fontSize(9).fillColor('#000').text(`${order.statut || ''}`, right - 90, y);
  y += 40;

  // Table header
  const col = {
    no: left + 2,
    desc: left + 40,
    qty: left + 260,
    pu: left + 320,
    amount: right - 80,
  };
  const rowHeight = 20;

  // Header background
  doc.rect(left, y - 4, right - left, rowHeight).fill('#f3f4f6').fillColor('#000');
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#000');
  doc.text('#', col.no, y, { width: 30, align: 'left' });
  doc.text('Produit', col.desc, y, { width: 200, align: 'left' });
  doc.text('Qté', col.qty, y, { width: 40, align: 'right' });
  doc.text('PU', col.pu, y, { width: 60, align: 'right' });
  doc.text('Montant', col.amount, y, { width: 80, align: 'right' });
  y += rowHeight + 2;

  doc.font('Helvetica').fontSize(9).fillColor('#000');
  // Rows with separators
  rows.forEach((r, idx) => {
    const qty = Number(r.quantite || 0);
    const pu = Number(r.prix_unitaire || 0);
    const lineTotal = (qty * pu).toFixed(2);

    // Check for page break
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }

    doc.text(String(idx + 1), col.no, y, { width: 30, align: 'left' });
    doc.text(String(r.product_nom || `#${r.product_id || ''}`), col.desc, y, { width: 220, align: 'left' });
    doc.text(String(qty), col.qty, y, { width: 40, align: 'right' });
    doc.text(pu.toFixed(2), col.pu, y, { width: 60, align: 'right' });
    doc.text(lineTotal, col.amount, y, { width: 80, align: 'right' });

    // separator line
    y += rowHeight - 4;
    doc.moveTo(left, y).lineTo(right, y).lineWidth(0.4).strokeColor('#e2e8f0').stroke();
    y += 6;
  });

  // Totals box (right aligned)
  if (y > doc.page.height - 120) {
    doc.addPage();
    y = 40;
  }
  y += 6;
  const totalsBoxWidth = 200;
  const totalsX = right - totalsBoxWidth;
  doc.rect(totalsX, y, totalsBoxWidth, 56).lineWidth(0.6).strokeColor('#cbd5e1').stroke();
  doc.font('Helvetica').fontSize(10).text('Total', totalsX + 8, y + 8, { width: 120, align: 'left' });
  doc.font('Helvetica-Bold').fontSize(12).text(Number(total).toFixed(2), totalsX + 8, y + 26, { width: 120, align: 'left' });

  y += 76;
  doc.fontSize(9).fillColor('#666').text('Imprimé depuis le système HDA — Hotel de L\'avenue', left, y);

  doc.end();
}

async function ordersInProgressHandler(req, res) {
  const rows = await resto.ordersByTable(req.query.statut || 'EN_COURS');
  return ok(res, rows);
}

// Recipe handlers removed

async function restaurantStockHandler(req, res) {
  const [rows] = await pool.query(
    `SELECT s.id, p.id AS product_id, sl.id AS location_id, COALESCE(s.quantite, 0) AS quantite,
            p.nom AS product_nom, p.unite, p.code, p.type_produit,
            p.prix_achat, p.prix_vente, p.category_id, p.subcategory_id,
            c.nom AS category_nom, sc.nom AS subcategory_nom,
            p.portion_size, p.portion_unite,
            sl.nom AS location_nom
     FROM stocks s
     JOIN products p ON p.id = s.product_id
     JOIN stock_locations sl ON sl.id = s.location_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN subcategories sc ON sc.id = p.subcategory_id
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

async function getRestaurantPurchasesHandler(req, res) {
  const [rows] = await pool.query(
    `SELECT pu.id, pu.supplier_id, pu.montant_total, pu.statut, s.nom AS supplier_nom
     FROM purchases pu
     LEFT JOIN suppliers s ON s.id = pu.supplier_id
     ORDER BY pu.id DESC`
  );
  return ok(res, rows);
}

async function getRestaurantPurchaseByIdHandler(req, res) {
  const { id } = req.params;
  const [[purchase]] = await pool.query(
    `SELECT pu.id, pu.supplier_id, pu.montant_total, pu.statut, s.nom AS supplier_nom
     FROM purchases pu
     LEFT JOIN suppliers s ON s.id = pu.supplier_id
     WHERE pu.id = ?`,
    [id]
  );

  if (!purchase) {
    throw ApiError.notFound(`Achat #${id} introuvable`);
  }

  const [items] = await pool.query(
    `SELECT pi.id, pi.purchase_id, pi.product_id, pi.quantite, pi.prix_unitaire,
            p.nom AS product_nom, p.unite
     FROM purchase_items pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = ?`,
    [id]
  );

  return ok(res, { ...purchase, items });
}

async function createRestaurantPurchaseHandler(req, res) {
  const { supplier_id, items } = req.body || {};
  if (!supplier_id || !Array.isArray(items) || !items.length) {
    throw ApiError.badRequest('supplier_id et au moins une ligne d’achat sont requis');
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

    if (total > 0) {
      await conn.query(
        `INSERT INTO financial_transactions (module, type_flux, montant, reference_id, description, created_at)
         VALUES ('RESTAURANT', 'SORTIE', ?, ?, ?, NOW())`,
        [total, purchaseId, `Achat stock restaurant #${purchaseId}`]
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
  let { order_id, montant, moyen_paiement, client_id } = req.body;
  if (!order_id) {
    throw ApiError.badRequest('order_id est requis');
  }
  const paymentMethod = moyen_paiement || 'ESPECES';

  let finalMontant = Number(montant || 0);
  let finalClientId = client_id || null;
  let tableId = null;

  const [[orderRow]] = await pool.query(
    'SELECT id, client_id, table_id, montant_total FROM orders WHERE id = ? LIMIT 1',
    [order_id]
  );

  if (orderRow) {
    if (finalMontant <= 0) {
      finalMontant = Number(orderRow.montant_total || 0);
    }
    if (!finalClientId) {
      finalClientId = orderRow.client_id || null;
    }
    tableId = orderRow.table_id || null;
  }

  if (finalMontant <= 0) {
    throw ApiError.badRequest(`Le montant de la commande #${order_id} est invalide (${finalMontant})`);
  }
  
  const [result] = await pool.query(
    'INSERT INTO payments (order_id, montant, moyen_paiement, client_id, date_paiement) VALUES (?, ?, ?, ?, NOW())',
    [order_id, finalMontant, paymentMethod, finalClientId]
  );
  
  await pool.query(
    'UPDATE orders SET statut = "PAYEE" WHERE id = ?',
    [order_id]
  );

  if (tableId) {
    await pool.query('UPDATE tables_restaurant SET statut = "LIBRE" WHERE id = ?', [tableId]);
  }

  // Mirror the receipt in the consolidated Finance ledger.
  await pool.query(
    `INSERT INTO financial_transactions
       (client_id, module, type_flux, montant, reference_id, description, statut_sync, created_at)
     VALUES (?, 'RESTAURANT', 'ENTREE', ?, ?, ?, 'SYNCED', NOW())`,
    [finalClientId, finalMontant, order_id, `Paiement commande restaurant #${order_id}`]
  );

  return created(res, { payment_id: result.insertId, montant: finalMontant });
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

async function consumeRestaurantPortionHandler(req, res, next) {
  try {
    const { product_id, location_id, portion_size, portion_unit, reference_id } = req.body;

    if (!product_id || !location_id || portion_size === undefined) {
      throw ApiError.badRequest('product_id, location_id et portion_size sont requis');
    }

    if (isNaN(portion_size) || Number(portion_size) <= 0) {
      throw ApiError.badRequest('La portion doit être un nombre positif');
    }

    const result = await stock.consumePortion({
      productId: product_id,
      locationId: location_id,
      portionSize: Number(portion_size),
      portionUnit: portion_unit || 'g',
      referenceId: reference_id || null,
      sourceModule: 'RESTAURANT',
    });

    return created(res, result);
  } catch (err) {
    next(err);
  }
}

async function closeAllRestaurantOrdersHandler(req, res) {
  const { order_ids } = req.body || {};
  if (order_ids !== undefined && !Array.isArray(order_ids)) {
    throw ApiError.badRequest('order_ids doit être un tableau');
  }
  const result = await resto.closeAllRestaurantOrders(order_ids || []);
  return ok(res, result);
}

const listRestaurantPurchasesHandler = getRestaurantPurchasesHandler;
const restaurantPurchaseDetailHandler = getRestaurantPurchaseByIdHandler;

module.exports = {
  tablesCrud, ordersCrud, orderItemsCrud, cashiersCrud, sessionsCrud,
  createOrderHandler, orderDetailHandler, orderInvoiceHandler, ordersInProgressHandler,
  orderInvoicePdfHandler, closeAllRestaurantOrdersHandler,
  restaurantStockHandler, restaurantStockMovementsHandler,
  adjustRestaurantStockHandler, removeRestaurantStockHandler, consumeRestaurantPortionHandler,
  getRestaurantPurchasesHandler, getRestaurantPurchaseByIdHandler,
  listRestaurantPurchasesHandler, restaurantPurchaseDetailHandler, createRestaurantPurchaseHandler,
  menuHandler, updateOrderStatusHandler, openCashierHandler, closeCashierHandler,
  cashierStatusHandler, processPaymentHandler, billToRoomHandler, statsHandler,
};
