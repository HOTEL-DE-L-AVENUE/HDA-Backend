const express = require('express');
const router = express.Router();
const minibarController = require('../Controllers/roomMinibar.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, minibarController.getRoomMinibars);
router.get('/alerts', authenticateToken, minibarController.getMinibarAlerts);
router.get('/stats', authenticateToken, minibarController.getRoomMinibarStats);
router.get('/room/:roomId', authenticateToken, minibarController.getRoomMinibarByRoom);
router.get('/:id', authenticateToken, minibarController.getRoomMinibarById);
router.post('/', authenticateToken, minibarController.createRoomMinibar);
router.put('/:id', authenticateToken, minibarController.updateRoomMinibar);
router.put('/:id/quantity', authenticateToken, minibarController.updateMinibarQuantity);
router.delete('/:id', authenticateToken, minibarController.deleteRoomMinibar);

module.exports = router;