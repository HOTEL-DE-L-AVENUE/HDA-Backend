// routes/casinoRoutes.js
const express = require('express');
const ctrl = require('../controllers/casinoController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

// --- Tableau de bord ---------------------------------------------------------
router.get('/dashboard', ctrl.dashboardHandler);                        // GET /api/casino/dashboard

// --- Salles & caisses ---------------------------------------------------------
router.use('/rooms', createCrudRouter(ctrl.roomsCrud));                 // /api/casino/rooms
router.use('/cashiers', createCrudRouter(ctrl.cashiersCrud));           // /api/casino/cashiers

// --- Sessions de caisse ---------------------------------------------------------
router.get('/sessions/active', ctrl.activeSessionsHandler);             // GET  /api/casino/sessions/active
router.post('/sessions/open', ctrl.openSessionHandler);                 // POST /api/casino/sessions/open
router.post('/sessions/:id/close', ctrl.closeSessionHandler);           // POST /api/casino/sessions/:id/close
router.get('/sessions/:id/transactions', ctrl.sessionTransactionsHandler); // GET /api/casino/sessions/:id/transactions
router.use('/sessions', createCrudRouter(ctrl.sessionsCrud));           // /api/casino/sessions (CRUD générique)

// --- Cartes de fidélité ---------------------------------------------------------
router.get('/cards/by-client/:clientId', ctrl.cardByClientHandler);     // GET  /api/casino/cards/by-client/:clientId
router.post('/cards/:id/points', ctrl.addPointsHandler);                // POST /api/casino/cards/:id/points
router.use('/cards', createCrudRouter(ctrl.cardsCrud));                 // /api/casino/cards

// --- Crédits ---------------------------------------------------------
router.post('/credits/grant', ctrl.grantCreditHandler);                 // POST /api/casino/credits/grant
router.post('/credits/:id/repay', ctrl.repayCreditHandler);             // POST /api/casino/credits/:id/repay
router.post('/credits/:id/draw', ctrl.drawCreditHandler);               // POST /api/casino/credits/:id/draw
router.get('/credits/by-client/:clientId/active', ctrl.activeCreditsByClientHandler); // GET /api/casino/credits/by-client/:clientId/active
router.use('/credits', createCrudRouter(ctrl.creditsCrud));             // /api/casino/credits

// --- Scores / classement ---------------------------------------------------------
router.get('/scores/leaderboard', ctrl.leaderboardHandler);             // GET /api/casino/scores/leaderboard?categorie=&limit=
router.use('/scores', createCrudRouter(ctrl.scoresCrud));               // /api/casino/scores

// --- Jetons ---------------------------------------------------------
router.post('/chips/buy', ctrl.buyChipsHandler);                        // POST /api/casino/chips/buy
router.post('/chips/sell', ctrl.sellChipsHandler);                      // POST /api/casino/chips/sell
router.get('/chips/by-client/:clientId', ctrl.chipHistoryByClientHandler); // GET /api/casino/chips/by-client/:clientId
router.use('/chips', createCrudRouter(ctrl.chipTransactionsCrud));      // /api/casino/chips

// --- Visites de salle ---------------------------------------------------------
router.post('/visits/check-in', ctrl.checkInHandler);                   // POST /api/casino/visits/check-in
router.post('/visits/:id/check-out', ctrl.checkOutHandler);             // POST /api/casino/visits/:id/check-out
router.get('/visits/in-room/:roomId', ctrl.currentlyInRoomHandler);     // GET  /api/casino/visits/in-room/:roomId
router.use('/visits', createCrudRouter(ctrl.visitsCrud));               // /api/casino/visits

// --- Transactions financières ---------------------------------------------------------
router.post('/transactions/record', ctrl.recordTransactionHandler);     // POST /api/casino/transactions/record
router.use('/transactions', createCrudRouter(ctrl.transactionsCrud));   // /api/casino/transactions

module.exports = router;
