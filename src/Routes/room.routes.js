const express = require('express');
const router = express.Router();

// Importer le contrôleur
const roomController = require('../Controllers/roomController');

// Vérifier que le contrôleur est bien chargé
console.log('🔍 roomController chargé:', Object.keys(roomController));

// ============================================
// ROUTES
// ============================================

// GET /api/rooms - Récupérer toutes les chambres
router.get('/', roomController.getRooms);

// GET /api/rooms/available - Chambres disponibles
router.get('/available', roomController.getAvailableRooms);

// GET /api/rooms/stats - Statistiques
router.get('/stats', roomController.getRoomStats);

// GET /api/rooms/:id - Récupérer une chambre
router.get('/:id', roomController.getRoomById);

// POST /api/rooms - Créer une chambre
router.post('/', roomController.createRoom);

// PUT /api/rooms/:id - Mettre à jour une chambre
router.put('/:id', roomController.updateRoom);

// PUT /api/rooms/:id/status - Mettre à jour le statut
router.put('/:id/status', roomController.updateRoomStatus);

// DELETE /api/rooms/:id - Supprimer une chambre
router.delete('/:id', roomController.deleteRoom);

module.exports = router;