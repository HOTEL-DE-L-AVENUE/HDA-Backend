const express = require('express');
const router = express.Router();
const maintenanceController = require('../Controllers/roomMaintenance.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', maintenanceController.getMaintenances);
router.get('/stats', maintenanceController.getMaintenanceStats);
router.get('/:id', maintenanceController.getMaintenanceById);
router.post('/', maintenanceController.createMaintenance);
router.put('/:id', maintenanceController.updateMaintenance);
router.put('/:id/status', maintenanceController.updateMaintenanceStatus);
router.delete('/:id', maintenanceController.deleteMaintenance);

module.exports = router;