const { syncRoomReservationStatuses } = require('../models/hebergementModel');

const TICK_MS = 60_000;
let timer = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await syncRoomReservationStatuses();
  } catch (error) {
    console.error('[room-status] Échec de la synchronisation des réservations :', error.message);
  } finally {
    running = false;
  }
}

function startRoomReservationStatusSync() {
  if (timer) return;
  void tick();
  timer = setInterval(() => { void tick(); }, TICK_MS);
  timer.unref?.();
}

function stopRoomReservationStatusSync() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startRoomReservationStatusSync, stopRoomReservationStatusSync };
