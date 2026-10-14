const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getRestaurantHistoryDateRange,
  buildRestaurantHistoryResponse,
} = require('../utils/restaurantOrderHistory');

test('lit les dates envoyées par l’interface et accepte les alias historiques', () => {
  assert.deepEqual(
    getRestaurantHistoryDateRange({ date_debut: '2026-10-01', date_fin: '2026-10-14' }),
    { dateFrom: '2026-10-01', dateTo: '2026-10-14' }
  );
  assert.deepEqual(
    getRestaurantHistoryDateRange({ dateFrom: '2026-10-01', dateTo: '2026-10-14' }),
    { dateFrom: '2026-10-01', dateTo: '2026-10-14' }
  );
});

test('rejette une plage de dates inversée ou une date invalide', () => {
  assert.throws(
    () => getRestaurantHistoryDateRange({ date_debut: '2026-10-15', date_fin: '2026-10-14' }),
    { status: 400 }
  );
  assert.throws(
    () => getRestaurantHistoryDateRange({ date_debut: '2026-02-30' }),
    { status: 400 }
  );
});

test('construit le total et rattache les détails aux commandes encaissées', () => {
  const response = buildRestaurantHistoryResponse([
    {
      payment_id: 21,
      order_id: 8,
      date_paiement: '2026-10-14 10:00:00',
      montant: '15000',
      moyen_paiement: 'ESPECES',
      table_numero: 'T1',
    },
    {
      payment_id: 22,
      order_id: 9,
      date_paiement: '2026-10-14 11:00:00',
      montant: '5000',
      moyen_paiement: null,
      table_numero: null,
    },
  ], [{
    id: 31,
    order_id: 8,
    quantite: '2',
    prix_unitaire: '7500',
    product_nom: 'Pizza',
    category_nom: 'Pizza',
  }]);

  assert.equal(response.total_payments, 2);
  assert.equal(response.total_collected, 20000);
  assert.equal(response.paid_orders[0].items[0].product_nom, 'Pizza');
  assert.equal(response.paid_orders[0].items[0].quantite, 2);
  assert.deepEqual(response.paid_orders[1].items, []);
});
