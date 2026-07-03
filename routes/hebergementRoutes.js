// routes/hebergementRoutes.js
const express = require('express');
const ctrl = require('../controllers/hebergementController');
const { createCrudRouter } = require('./routeFactory');

const router = express.Router();

router.use('/room-types', createCrudRouter(ctrl.roomTypesCrud));

router.get('/rooms/available', ctrl.availableRoomsHandler);              // GET /api/hebergement/rooms/available
router.get('/rooms/availability', ctrl.availabilityHandler);             // GET /api/hebergement/rooms/availability?room_id=&date_arrivee=&date_depart=
router.use('/rooms', createCrudRouter(ctrl.roomsCrud));

router.use('/equipments', createCrudRouter(ctrl.equipmentsCrud));
router.use('/room-equipments', createCrudRouter(ctrl.roomEquipmentsCrud));
router.use('/room-maintenance', createCrudRouter(ctrl.roomMaintenanceCrud));
router.use('/room-minibar', createCrudRouter(ctrl.roomMinibarCrud));
router.use('/room-status-history', createCrudRouter(ctrl.roomStatusHistoryCrud));

router.post('/reservations', ctrl.createReservationHandler);             // POST /api/hebergement/reservations (avec accompagnants)
router.use('/reservations', createCrudRouter(ctrl.reservationsCrud));
router.use('/reservation-guests', createCrudRouter(ctrl.reservationGuestsCrud));

router.post('/stays/check-in/:reservationId', ctrl.checkInHandler);      // POST /api/hebergement/stays/check-in/:reservationId
router.post('/stays/check-out/:stayId', ctrl.checkOutHandler);           // POST /api/hebergement/stays/check-out/:stayId
router.use('/stays', createCrudRouter(ctrl.staysCrud));

router.use('/housekeeping', createCrudRouter(ctrl.housekeepingCrud));
router.use('/lost-and-found', createCrudRouter(ctrl.lostAndFoundCrud));
router.use('/minibar-consumptions', createCrudRouter(ctrl.minibarConsumptionsCrud));

module.exports = router;
