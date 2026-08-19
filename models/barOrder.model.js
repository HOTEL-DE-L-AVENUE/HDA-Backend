const { pool, withTransaction } = require('../config/db');
const { createOrder, ensureBarTransactionsSchema } = require('./barTransaction.model');
const ApiError = require('../utils/ApiError');

async function findOrCreateClient(name, connection) {
  const clientName = String(name || '').trim();
  if (!clientName) return null;
  const [existing] = await connection.query('SELECT id FROM bar_clients WHERE nom = ? ORDER BY id ASC LIMIT 1', [clientName]);
  if (existing.length) return existing[0].id;
  const [result] = await connection.query("INSERT INTO bar_clients (nom, statut) VALUES (?, 'ACTIF')", [clientName]);
  return result.insertId;
}

async function ensureBarOrderTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bar_orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      client_name VARCHAR(150) DEFAULT NULL,
      table_id BIGINT UNSIGNED DEFAULT NULL,
      statut VARCHAR(30) DEFAULT 'EN_ATTENTE',
      montant_total DECIMAL(10,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_bar_orders_table_id (table_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bar_order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id BIGINT UNSIGNED NOT NULL,
      nom VARCHAR(150) DEFAULT NULL,
      quantite INT DEFAULT 1,
      prix DECIMAL(10,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_bar_order_items_order_id (order_id),
      CONSTRAINT fk_bar_order_items_order FOREIGN KEY (order_id) REFERENCES bar_orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function listBarOrders() {
  await ensureBarOrderTables();
  const [orders] = await pool.query('SELECT * FROM bar_orders ORDER BY created_at DESC');
  const orderIds = orders.map((order) => order.id);
  if (!orderIds.length) return [];

  const [items] = await pool.query(
    'SELECT * FROM bar_order_items WHERE order_id IN (?) ORDER BY id ASC',
    [orderIds]
  );

  const grouped = {};
  for (const item of items || []) {
    const orderId = item.order_id;
    if (!grouped[orderId]) grouped[orderId] = [];
    grouped[orderId].push(item);
  }

  return orders.map((order) => ({
    id: order.id,
    client: order.client_name,
    table: Number(order.table_id),
    statut: order.statut,
    total: Number(order.montant_total || 0),
    created_at: order.created_at,
    items: (grouped[order.id] || []).map((item) => ({
      nom: item.nom,
      quantite: Number(item.quantite || 1),
      prix: Number(item.prix || 0),
    })),
  }));
}

async function createBarOrder({ clientName, tableId, items }) {
  await ensureBarOrderTables();
  await ensureBarTransactionsSchema();

  return withTransaction(async (conn) => {
    // Lock and validate each requested stock row before creating the order.
    // The stock decrement and order creation therefore succeed or fail together.
    const requestedQuantities = new Map();
    for (const item of items || []) {
      const productId = Number(item.product_id ?? item.id);
      const quantity = Number(item.quantite);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
        throw ApiError.badRequest('Chaque article doit avoir un produit et une quantité positive.');
      }
      requestedQuantities.set(productId, (requestedQuantities.get(productId) || 0) + quantity);
    }

    for (const [productId, quantity] of requestedQuantities) {
      const [stocks] = await conn.query(
        `SELECT bs.quantite, bp.nom
         FROM bar_stock bs
         JOIN bar_products bp ON bp.id = bs.product_id
         WHERE bs.product_id = ? FOR UPDATE`,
        [productId]
      );
      if (!stocks.length) throw ApiError.badRequest(`Stock introuvable pour le produit #${productId}.`);
      if (Number(stocks[0].quantite) < quantity) {
        throw ApiError.badRequest(`Stock insuffisant pour ${stocks[0].nom}. Disponible : ${stocks[0].quantite}.`);
      }
    }

    const clientId = await findOrCreateClient(clientName, conn);
    const total = (items || []).reduce((sum, item) => sum + Number(item.quantite || 1) * Number(item.prix || 0), 0);

    const [result] = await conn.query(
      'INSERT INTO bar_orders (client_name, table_id, statut, montant_total, created_at) VALUES (?, ?, ?, ?, NOW())',
      [clientName || null, tableId || null, 'EN_ATTENTE', total]
    );

    const orderId = result.insertId;

    for (const [productId, quantity] of requestedQuantities) {
      await conn.query(
        'UPDATE bar_stock SET quantite = quantite - ? WHERE product_id = ?',
        [quantity, productId]
      );
    }

    const transactionItems = (items || []).map((item) => ({
      product_id: item.product_id ?? item.id,
      quantite: Number(item.quantite || 1),
      prix_unitaire: Number(item.prix_unitaire ?? item.prix ?? 0),
    })).filter((item) => item.product_id);

    const transactionResult = await createOrder({
      client_id: clientId,
      table_id: tableId || null,
      order_id: orderId,
      items: transactionItems,
      session_id: null,
      connection: conn,
    });

    for (const item of items || []) {
      await conn.query(
        'INSERT INTO bar_order_items (order_id, nom, quantite, prix, created_at) VALUES (?, ?, ?, ?, NOW())',
        [orderId, item.nom || null, Number(item.quantite || 1), Number(item.prix || 0)]
      );
    }

    return {
      id: orderId,
      client: clientName,
      table: Number(tableId),
      statut: 'EN_ATTENTE',
      total,
      items: (items || []).map((item) => ({
        nom: item.nom,
        quantite: Number(item.quantite || 1),
        prix: Number(item.prix || 0),
      })),
      transaction_ids: transactionResult.ids,
      client_id: clientId,
    };
  });
}

async function deleteBarOrder(id) {
  await ensureBarOrderTables();
  await ensureBarTransactionsSchema();

  return withTransaction(async (conn) => {
    const [orders] = await conn.query('SELECT id FROM bar_orders WHERE id = ? FOR UPDATE', [id]);
    if (!orders.length) return false;

    const [transactions] = await conn.query(
      'SELECT product_id, quantite FROM bar_transactions WHERE order_id = ?',
      [id]
    );
    for (const transaction of transactions) {
      await conn.query(
        'UPDATE bar_stock SET quantite = quantite + ? WHERE product_id = ?',
        [transaction.quantite, transaction.product_id]
      );
    }
    await conn.query('DELETE FROM bar_transactions WHERE order_id = ?', [id]);
    await conn.query(
      `DELETE FROM financial_transactions
       WHERE module = 'BAR' AND ref_flux_global = ?`,
      [`BAR-ORDER-${id}`]
    );
    await conn.query('DELETE FROM bar_orders WHERE id = ?', [id]);
    return true;
  });
}

async function updateBarOrderStatus(id, statut) {
  await ensureBarOrderTables();
  const allowedTransitions = {
    EN_ATTENTE: 'EN_PREPARATION',
    EN_PREPARATION: 'SERVIE',
    SERVIE: 'ENCAISSEE',
  };

  return withTransaction(async (conn) => {
    const [orders] = await conn.query(
      'SELECT id, statut FROM bar_orders WHERE id = ? FOR UPDATE',
      [id]
    );
    if (!orders.length) return null;

    const currentStatus = orders[0].statut;
    if (allowedTransitions[currentStatus] !== statut) {
      throw ApiError.badRequest('Transition de statut de commande invalide.');
    }

    await conn.query('UPDATE bar_orders SET statut = ? WHERE id = ?', [statut, id]);
    if (statut === 'ENCAISSEE') {
      const [[order]] = await conn.query(
        'SELECT montant_total, client_name FROM bar_orders WHERE id = ?',
        [id]
      );
      const [[existingTransaction]] = await conn.query(
        `SELECT id FROM financial_transactions
         WHERE module = 'BAR' AND ref_flux_global = ? LIMIT 1`,
        [`BAR-ORDER-${id}`]
      );
      if (!existingTransaction) {
        await conn.query(
          `INSERT INTO financial_transactions
             (module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
           VALUES ('BAR', 'ENTREE', ?, ?, ?, ?, 'SYNCED', NOW())`,
          [order.montant_total, id, `BAR-ORDER-${id}`, `Encaissement commande bar #${id}`]
        );
      }
    }
    return { id: Number(id), statut };
  });
}
module.exports = {
  listBarOrders,
  createBarOrder,
  deleteBarOrder,
  updateBarOrderStatus,
};
