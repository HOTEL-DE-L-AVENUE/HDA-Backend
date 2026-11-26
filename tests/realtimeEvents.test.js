const test = require('node:test');
const assert = require('node:assert/strict');
const { moduleFromPath, publishChange, subscribe } = require('../services/realtimeEvents');

test('maps API route prefixes to realtime modules', () => {
  assert.equal(moduleFromPath('/restaurant/orders/12/status'), 'restaurant');
  assert.equal(moduleFromPath('/bar/orders'), 'bar');
  assert.equal(moduleFromPath('/stock/movements'), 'stock');
  assert.equal(moduleFromPath('/unmapped/path'), 'global');
});

test('publishes sequenced changes without request data', () => {
  let received;
  const unsubscribe = subscribe((event) => { received = event; });
  const published = publishChange({ module: 'restaurant', action: 'PUT' });
  unsubscribe();

  assert.deepEqual(received, published);
  assert.equal(received.module, 'restaurant');
  assert.equal(received.action, 'PUT');
  assert.equal(typeof received.id, 'number');
  assert.equal('body' in received, false);
});
