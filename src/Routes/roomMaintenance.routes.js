const express = require('express');
const router = express.Router();
const maintenanceController = require('../Controllers/roomMaintenance.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken,maintenanceController.getMaintenances);
router.get('/stats', authenticateToken,maintenanceController.getMaintenanceStats);
router.get('/:id', authenticateToken,maintenanceController.getMaintenanceById);
router.post('/', authenticateToken,maintenanceController.createMaintenance);
router.put('/:id', authenticateToken,maintenanceController.updateMaintenance);
router.put('/:id/status', authenticateToken,maintenanceController.updateMaintenanceStatus);
router.delete('/:id', authenticateToken,maintenanceController.deleteMaintenance);

module.exports = router;