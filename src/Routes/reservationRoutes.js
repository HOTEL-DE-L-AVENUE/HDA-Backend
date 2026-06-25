const express = require('express');
const router = express.Router();
const reservationController = require('../Controllers/reservationController');

// ============================================
// ROUTES - Version simplifiée (sans auth pour tester)
// ============================================

/**
 * @route GET /api/reservations
 * @desc Récupérer toutes les réservations
 */
router.get('/', reservationController.getReservations);

/**
 * @route GET /api/reservations/:id
 * @desc Récupérer une réservation par ID
 */
router.get('/:id', reservationController.getReservationById);

/**
 * @route POST /api/reservations
 * @desc Créer une nouvelle réservation
 */
router.post('/', reservationController.createReservation);

/**
 * @route PUT /api/reservations/:id
 * @desc Mettre à jour une réservation
 */
router.put('/:id', reservationController.updateReservation);

/**
 * @route PUT /api/reservations/:id/status
 * @desc Mettre à jour le statut d'une réservation
 */
router.put('/:id/status', reservationController.updateReservationStatus);

/**
 * @route DELETE /api/reservations/:id
 * @desc Supprimer une réservation
 */
router.delete('/:id', reservationController.deleteReservation);

/**
 * @route GET /api/reservations/stats
 * @desc Récupérer les statistiques
 */
router.get('/stats', reservationController.getReservationStats);

module.exports = router;