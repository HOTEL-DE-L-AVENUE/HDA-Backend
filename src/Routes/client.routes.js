const express = require('express');
const router = express.Router();
const clientController = require('../Controllers/client.controller');
const { authenticateToken } = require('../Middleware/auth.middleware');

// Routes protégées
router.get('/', authenticateToken, clientController.getClients);
router.get('/:id', authenticateToken, clientController.getClientById);
router.post('/', authenticateToken, clientController.createClient);
router.put('/:id', authenticateToken, clientController.updateClient);
router.delete('/:id', authenticateToken, clientController.deleteClient);

module.exports = router;