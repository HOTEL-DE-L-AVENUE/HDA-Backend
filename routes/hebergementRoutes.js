// routes/hebergementRoutes.js
const express = require('express');
const ctrl = require('../controllers/hebergementController');
const { createCrudRouter } = require('./routeFactory');
const { requireAuth } = require('../middlewares/auth');

const router = express.Router();
router.use(requireAuth);

router.put('/room-types/:id', ctrl.updateRoomTypeHandler);
router.use('/room-types', createCrudRouter(ctrl.roomTypesCrud));

router.get('/rooms/available', ctrl.availableRoomsHandler);              // GET /api/hebergement/rooms/available
router.get('/rooms/availability', ctrl.availabilityHandler);             // GET /api/hebergement/rooms/availability?room_id=&date_arrivee=&date_depart=
router.get('/rooms/stats', ctrl.roomStatsHandler);                       // GET /api/hebergement/rooms/stats
router.put('/rooms/:id/status', ctrl.updateRoomStatusHandler);           // PUT /api/hebergement/rooms/:id/status
router.put('/rooms/:id', ctrl.updateRoomHandler);
router.use('/rooms', createCrudRouter(ctrl.roomsCrud));

router.get('/equipments/categories', ctrl.equipmentCategoriesHandler);   // GET /api/hebergement/equipments/categories
router.get('/equipments/stats', ctrl.equipmentStatsHandler);             // GET /api/hebergement/equipments/stats
router.get('/equipments/code/:code', ctrl.equipmentByCodeHandler);       // GET /api/hebergement/equipments/code/:code
router.use('/equipments', createCrudRouter(ctrl.equipmentsCrud));
router.put('/room-equipments/:id/status', ctrl.updateRoomEquipmentStatusHandler); // PUT /api/hebergement/room-equipments/:id/status
router.use('/room-equipments', createCrudRouter(ctrl.roomEquipmentsCrud));
router.get('/room-maintenance/stats', ctrl.maintenanceStatsHandler);            // GET /api/hebergement/room-maintenance/stats
router.put('/room-maintenance/:id/status', ctrl.updateMaintenanceStatusHandler); // PUT /api/hebergement/room-maintenance/:id/status
router.post('/room-maintenance', ctrl.createMaintenanceHandler);
router.use('/room-maintenance', createCrudRouter(ctrl.roomMaintenanceCrud));
router.use('/maintenance-workers', createCrudRouter(ctrl.maintenanceWorkersCrud));
router.use('/room-minibar', createCrudRouter(ctrl.roomMinibarCrud));
router.use('/room-status-history', createCrudRouter(ctrl.roomStatusHistoryCrud));

router.post('/reservations', ctrl.createReservationHandler);             // POST /api/hebergement/reservations (avec accompagnants)
router.post('/reservations/:id/validate-discount', ctrl.validateReservationDiscountHandler);
router.get('/reservations/stats', ctrl.reservationStatsHandler);         // GET /api/hebergement/reservations/stats
router.use('/reservations', createCrudRouter(ctrl.reservationsCrud));
router.use('/reservation-guests', createCrudRouter(ctrl.reservationGuestsCrud));

router.post('/stays/check-in/:reservationId', ctrl.checkInHandler);      // POST /api/hebergement/stays/check-in/:reservationId
router.post('/stays/check-out/:stayId', ctrl.checkOutHandler);           // POST /api/hebergement/stays/check-out/:stayId
router.use('/stays', createCrudRouter(ctrl.staysCrud));

router.get('/housekeeping/stats', ctrl.housekeepingStatsHandler);            // GET /api/hebergement/housekeeping/stats
router.put('/housekeeping/:id/status', ctrl.updateHousekeepingStatusHandler); // PUT /api/hebergement/housekeeping/:id/status
router.use('/housekeeping', createCrudRouter(ctrl.housekeepingCrud));
router.use('/lost-and-found', createCrudRouter(ctrl.lostAndFoundCrud));
router.use('/minibar-consumptions', createCrudRouter(ctrl.minibarConsumptionsCrud));

// Minibar stock management routes
router.post('/minibar/transfer-stock', ctrl.transferStockToMinibarHandler);     // POST /api/hebergement/minibar/transfer-stock
router.post('/minibar/consume', ctrl.handleMinibarConsumptionHandler);          // POST /api/hebergement/minibar/consume
router.get('/minibar/alerts', ctrl.getMinibarWithAlertsHandler);                // GET /api/hebergement/minibar/alerts
router.get('/minibar/low-stock', ctrl.getLowStockMinibarHandler);               // GET /api/hebergement/minibar/low-stock
router.post('/minibar/restock', ctrl.restockMinibarHandler);                    // POST /api/hebergement/minibar/restock

// Accommodation stock management routes
router.get('/stock', ctrl.getHebergementStockHandler);                           // GET /api/hebergement/stock
router.post('/stock', ctrl.addHebergementStockHandler);                          // POST /api/hebergement/stock
router.put('/stock/:id', ctrl.updateHebergementStockHandler);                    // PUT /api/hebergement/stock/:id
router.delete('/stock/:id', ctrl.deleteHebergementStockHandler);                 // DELETE /api/hebergement/stock/:id

module.exports = router;