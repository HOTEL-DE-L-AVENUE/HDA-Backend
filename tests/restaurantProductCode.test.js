const test = require('node:test');
const assert = require('node:assert/strict');
const { nextRestaurantProductCode } = require('../utils/restaurantProductCode');

test('product code numbering starts at 01 when no codes are in use', () => {
  assert.equal(nextRestaurantProductCode([], 2026), 'PLAT01/2026');
});

test('product code numbering reuses the first available number', () => {
  assert.equal(
    nextRestaurantProductCode(['PLAT01/2026', 'PLAT03/2026', 'PLAT04/2026'], 2026),
    'PLAT02/2026'
  );
});

test('product code numbering ignores codes from other years', () => {
  assert.equal(nextRestaurantProductCode(['PLAT01/2025'], 2026), 'PLAT01/2026');
});
