const express = require('express');
const router = express.Router();
const equipmentController = require('../Controllers/roomEquipment.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, equipmentController.getRoomEquipments);
router.get('/stats', authenticateToken, equipmentController.getRoomEquipmentStats);
router.get('/room/:roomId', authenticateToken, equipmentController.getRoomEquipmentsByRoom);
router.get('/:id', authenticateToken, equipmentController.getRoomEquipmentById);
router.post('/', authenticateToken, equipmentController.createRoomEquipment);
router.put('/:id', authenticateToken, equipmentController.updateRoomEquipment);
router.put('/:id/status', authenticateToken, equipmentController.updateRoomEquipmentStatus);
router.delete('/:id', authenticateToken, equipmentController.deleteRoomEquipment);

module.exports = router;