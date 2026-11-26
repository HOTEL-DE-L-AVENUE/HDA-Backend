const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { currentSequence, subscribe } = require('../services/realtimeEvents');

const router = express.Router();

router.get('/events', requireAuth, (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  const unsubscribe = subscribe((event) => {
    res.write(`id: ${event.id}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`);
  });
  res.write(`id: ${currentSequence()}\nevent: resync\ndata: {}\n\n`);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);
  heartbeat.unref();

  res.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

module.exports = router;
