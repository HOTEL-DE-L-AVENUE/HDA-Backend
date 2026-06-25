const express = require('express');
const router = express.Router();
const roomController = require('../Controllers/room.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes publiques
router.get('/available', roomController.getAvailableRooms);
router.get('/stats', roomController.getRoomStats);

// Routes protégées
router.get('/', authenticateToken, roomController.getRooms);
router.get('/:id', authenticateToken, roomController.getRoomById);
router.post('/', authenticateToken, roomController.createRoom);
router.put('/:id', authenticateToken, roomController.updateRoom);
router.put('/:id/status', authenticateToken, roomController.updateRoomStatus);
router.delete('/:id', authenticateToken, roomController.deleteRoom);

module.exports = router;