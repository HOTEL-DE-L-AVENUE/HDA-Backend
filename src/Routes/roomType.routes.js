const express = require('express');
const router = express.Router();
const roomTypeController = require('../Controllers/roomType.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, roomTypeController.getRoomTypes);
router.get('/:id', authenticateToken, roomTypeController.getRoomTypeById);
router.post('/', authenticateToken, roomTypeController.createRoomType);
router.put('/:id', authenticateToken, roomTypeController.updateRoomType);
router.delete('/:id', authenticateToken, roomTypeController.deleteRoomType);

module.exports = router;