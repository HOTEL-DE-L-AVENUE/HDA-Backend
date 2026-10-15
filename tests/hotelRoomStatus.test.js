const test = require('node:test');
const assert = require('node:assert/strict');
const hebergementModel = require('../models/hebergementModel');
const hebergementController = require('../controllers/hebergementController');
const { pool } = require('../config/db');

test('free reservations do not calculate accommodation or laundry charges', () => {
  assert.equal(hebergementController.calculateReservationGross({
    typeReservation: 'GRATUIT',
    manualPrice: 0,
    nights: 6,
    exchangeRate: 39.76,
    roomPrice: 450000,
    laundryIncluded: true,
    laundryPrice: 50000,
  }), 0);
});

test('room reservation status follows the arrival and departure dates', async (t) => {
  const originalGetConnection = pool.getConnection;
  const updates = [];
  const histories = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params = []) => {
      if (sql.startsWith('SELECT room.id')) {
        assert.match(sql, /reservation\.date_arrivee <= CURDATE\(\)/);
        assert.match(sql, /reservation\.date_depart > CURDATE\(\)/);
        return [[
          { id: 1, statut: 'LIBRE', has_active_reservation: 1 },
          { id: 2, statut: 'RESERVEE', has_active_reservation: 0 },
        ], []];
      }
      if (sql.startsWith('UPDATE rooms')) updates.push(params);
      if (sql.startsWith('INSERT INTO room_status_history')) histories.push(params);
      return [{ affectedRows: 1 }, []];
    },
  };
  pool.getConnection = async () => connection;
  t.after(() => { pool.getConnection = originalGetConnection; });

  const changed = await hebergementModel.syncRoomReservationStatuses();

  assert.equal(changed, 2);
  assert.deepEqual(updates, [['RESERVEE', 1], ['LIBRE', 2]]);
  assert.deepEqual(histories, [[1, 'LIBRE', 'RESERVEE'], [2, 'RESERVEE', 'LIBRE']]);
});
