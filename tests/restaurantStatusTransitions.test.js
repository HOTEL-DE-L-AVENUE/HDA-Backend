const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedRestaurantStatusTransition } = require('../controllers/restaurantController');

test('allows only forward restaurant order transitions and cancellation', () => {
  assert.equal(isAllowedRestaurantStatusTransition('EN_ATTENTE', 'EN_COURS'), true);
  assert.equal(isAllowedRestaurantStatusTransition('EN_COURS', 'SERVIE'), true);
  assert.equal(isAllowedRestaurantStatusTransition('SERVIE', 'PAYEE'), true);
  assert.equal(isAllowedRestaurantStatusTransition('EN_COURS', 'ANNULEE'), true);
  assert.equal(isAllowedRestaurantStatusTransition('EN_ATTENTE', 'PAYEE'), false);
  assert.equal(isAllowedRestaurantStatusTransition('SERVIE', 'EN_COURS'), false);
  assert.equal(isAllowedRestaurantStatusTransition('PAYEE', 'ANNULEE'), false);
});

test('treats equivalent paid statuses and duplicate updates as idempotent', () => {
  assert.equal(isAllowedRestaurantStatusTransition('PAYE', 'PAYEE'), true);
  assert.equal(isAllowedRestaurantStatusTransition('SERVIE', 'SERVIE'), true);
});
