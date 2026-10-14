const ApiError = require('./ApiError');

function normalizeDate(value, label) {
  if (value === undefined || value === null || value === '') return null;

  const date = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw ApiError.badRequest(`${label} doit être au format AAAA-MM-JJ`);
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw ApiError.badRequest(`${label} n’est pas une date valide`);
  }
  return date;
}

function getRestaurantHistoryDateRange(query) {
  const dateFrom = normalizeDate(query.date_debut ?? query.dateFrom, 'La date de début');
  const dateTo = normalizeDate(query.date_fin ?? query.dateTo, 'La date de fin');

  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw ApiError.badRequest('La date de début doit être antérieure ou égale à la date de fin.');
  }
  return { dateFrom, dateTo };
}

function buildRestaurantHistoryResponse(paymentRows, itemRows) {
  const itemsByOrder = new Map();
  for (const item of itemRows) {
    const orderId = Number(item.order_id);
    const items = itemsByOrder.get(orderId) || [];
    items.push({
      id: Number(item.id),
      quantite: Number(item.quantite),
      prix_unitaire: Number(item.prix_unitaire),
      product_nom: item.product_nom || 'Produit indisponible',
      category_nom: item.category_nom || null,
    });
    itemsByOrder.set(orderId, items);
  }

  const paidOrders = paymentRows.map((payment) => ({
    payment_id: Number(payment.payment_id),
    order_id: Number(payment.order_id),
    date_paiement: payment.date_paiement,
    montant: Number(payment.montant || 0),
    moyen_paiement: payment.moyen_paiement || null,
    table_numero: payment.table_numero || null,
    items: itemsByOrder.get(Number(payment.order_id)) || [],
  }));

  return {
    total_payments: paidOrders.length,
    total_collected: paidOrders.reduce((total, payment) => total + payment.montant, 0),
    paid_orders: paidOrders,
  };
}

module.exports = { getRestaurantHistoryDateRange, buildRestaurantHistoryResponse };
