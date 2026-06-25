const express = require('express');
const router = express.Router();
const reservationController = require('../Controllers/reservation.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, reservationController.getReservations);
router.get('/:id', authenticateToken, reservationController.getReservationById);
router.post('/', authenticateToken, reservationController.createReservation);
router.put('/:id', authenticateToken, reservationController.updateReservation);
router.put('/:id/status', authenticateToken, reservationController.updateReservationStatus);
router.delete('/:id', authenticateToken, reservationController.deleteReservation);
router.get('/stats', authenticateToken, reservationController.getReservationStats);

module.exports = router;