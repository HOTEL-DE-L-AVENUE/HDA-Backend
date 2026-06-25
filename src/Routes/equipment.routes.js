const express = require('express');
const router = express.Router();
const equipmentController = require('../Controllers/equipment.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes publiques
router.get('/categories', equipmentController.getEquipmentCategories);
router.get('/stats', equipmentController.getEquipmentStats);

// Routes protégées (authentification uniquement)
router.get('/', equipmentController.getEquipments);
router.get('/code/:code', equipmentController.getEquipmentByCode);
router.get('/:id', equipmentController.getEquipmentById);
router.post('/', equipmentController.createEquipment);
router.put('/:id', equipmentController.updateEquipment);
router.delete('/:id', equipmentController.deleteEquipment);

module.exports = router;