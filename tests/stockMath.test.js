// tests/stockMath.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  monthBounds,
  signedQuantity,
  isSaleSource,
  aggregateMovements,
  openingStock,
  computeStockStatus,
} = require('../utils/stockMath');

test('monthBounds accepte un mois valide et calcule les bornes', () => {
  assert.deepEqual(monthBounds('2026-02'), {
    month: '2026-02',
    start: '2026-02-01',
    end: '2026-02-28',
    endExclusive: '2026-03-01',
  });
  assert.deepEqual(monthBounds('2026-12'), {
    month: '2026-12',
    start: '2026-12-01',
    end: '2026-12-31',
    endExclusive: '2027-01-01',
  });
  assert.equal(monthBounds('2024-02').end, '2024-02-29');
});

test('monthBounds rejette un format ou un mois invalide', () => {
  assert.throws(() => monthBounds('2026-13'));
  assert.throws(() => monthBounds('10-2026'));
  assert.throws(() => monthBounds('2026-1'));
});

test('signedQuantity porte le signe du type et refuse une quantité nulle', () => {
  assert.equal(signedQuantity('ENTREE', 5), 5);
  assert.equal(signedQuantity('SORTIE', 5), -5);
  assert.equal(signedQuantity('AJUSTEMENT', -3), -3);
  assert.throws(() => signedQuantity('ENTREE', 0));
  assert.throws(() => signedQuantity('SORTIE', -2));
  assert.throws(() => signedQuantity('INCONNU', 2));
});

test('aggregateMovements sépare les ventes des sorties manuelles', () => {
  const totals = aggregateMovements([
    { type_mouvement: 'ENTREE', quantite: 10, source_module: 'STOCK_MANUEL' },
    { type_mouvement: 'SORTIE', quantite: 3, source_module: 'STOCK_MANUEL' },
    { type_mouvement: 'SORTIE', quantite: 4, source_module: 'RESTAURANT' },
    { type_mouvement: 'ENTREE', quantite: 1, source_module: 'RESTAURANT' },
    { type_mouvement: 'SORTIE', quantite: 2, source_module: 'VENTE_BAR' },
  ]);
  assert.deepEqual(totals, { entrees: 10, sorties: 3, ventes: 5 });
});

test('aggregateMovements peut ignorer les ventes du journal et déduire les retours', () => {
  assert.deepEqual(
    aggregateMovements(
      [
        { type_mouvement: 'ENTREE', quantite: 5, source_module: 'STOCK_MANUEL' },
        { type_mouvement: 'SORTIE', quantite: 2, source_module: 'VENTE_BAR' },
      ],
      { salesFromLedger: false },
    ),
    { entrees: 5, sorties: 0, ventes: 0 },
  );
  assert.deepEqual(
    aggregateMovements([
      { type_mouvement: 'SORTIE', quantite: 10, source_module: 'RESTAURANT' },
      { type_mouvement: 'ENTREE', quantite: 2, source_module: 'RESTAURANT' },
    ]),
    { entrees: 0, sorties: 0, ventes: 8 },
  );
});

test('openingStock reconstitue le stock de début de mois', () => {
  assert.equal(openingStock(100, { entrees: 30, sorties: 10, ventes: 25 }), 105);
  assert.equal(openingStock(0, { entrees: 0, sorties: 0, ventes: 0 }), 0);
  assert.equal(openingStock(5.5, { entrees: 1.25, sorties: 0.5, ventes: 0 }), 4.75);
});

test('computeStockStatus applique rupture, faible, élevé puis ok', () => {
  assert.equal(computeStockStatus({ quantite: 0, seuilMinimum: 5 }), 'rupture');
  assert.equal(computeStockStatus({ quantite: -2, seuilMinimum: 0 }), 'rupture');
  assert.equal(computeStockStatus({ quantite: 5, seuilMinimum: 5 }), 'faible');
  assert.equal(computeStockStatus({ quantite: 6, seuilMinimum: 5 }), 'ok');
  assert.equal(computeStockStatus({ quantite: 20, seuilMinimum: 5, seuilMaximum: 10 }), 'eleve');
  assert.equal(computeStockStatus({ quantite: 20, seuilMinimum: 5, seuilMaximum: 0 }), 'ok');
  assert.equal(computeStockStatus({ quantite: 20, seuilMinimum: 5, seuilMaximum: null }), 'ok');
});

test('isSaleSource reconnaît les sources de vente', () => {
  assert.equal(isSaleSource('RESTAURANT'), true);
  assert.equal(isSaleSource('vente_bar'), true);
  assert.equal(isSaleSource('STOCK_MANUEL'), false);
  assert.equal(isSaleSource(null), false);
});
