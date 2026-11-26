const { EventEmitter } = require('events');

// This in-memory bus is process-local; multi-instance deployments need a shared pub/sub adapter.
const events = new EventEmitter();
events.setMaxListeners(0);

let sequence = 0;

function moduleFromPath(pathname = '') {
  const segment = String(pathname).split('/').filter(Boolean)[0] || 'global';
  const modules = {
    alcool: 'alcool',
    alchool: 'alcool',
    bar: 'bar',
    casino: 'casino',
    clients: 'clients',
    'caisse-transfers': 'finance',
    finance: 'finance',
    finances: 'finance',
    hebergement: 'hotel',
    hotel: 'hotel',
    planning: 'planning',
    restaurant: 'restaurant',
    rh: 'rh',
    stock: 'stock',
    admin: 'admin',
    auth: 'auth',
    signatures: 'rh',
    uploads: 'global',
  };
  return modules[segment] || 'global';
}

function publishChange(change) {
  const event = {
    id: ++sequence,
    module: change.module || 'global',
    action: change.action || 'UPDATE',
    occurredAt: new Date().toISOString(),
  };
  events.emit('change', event);
  return event;
}

function subscribe(listener) {
  events.on('change', listener);
  return () => events.off('change', listener);
}

function currentSequence() {
  return sequence;
}

module.exports = { currentSequence, moduleFromPath, publishChange, subscribe };
