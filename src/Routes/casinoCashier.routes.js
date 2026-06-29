// src/Routes/casinoCashier.routes.js
const express = require('express');
const router = express.Router();
const casinoCashierController = require('../Controllers/Casino/casinoCashier.controller');
const { authenticateToken, requireRole } = require('../Middleware/auth.middleware');

// =============================================
// ROUTES PUBLIQUES (Lecture seule - Pas de token requis)
// =============================================

// Récupérer les statistiques
router.get('/stats', casinoCashierController.getStats);

// Récupérer les caissiers par statut
router.get('/status/:statut', casinoCashierController.getCashiersByStatus);

// Récupérer les caissiers par salle
router.get('/room/:roomId', casinoCashierController.getCashiersByRoom);

// Récupérer tous les caissiers
router.get('/', casinoCashierController.getAllCashiers);

// Récupérer un caissier par ID
router.get('/:id', casinoCashierController.getCashierById);

// =============================================
// ROUTES PROTÉGÉES (Nécessite authentification)
// =============================================

// Appliquer le middleware d'authentification pour les routes suivantes
router.use(authenticateToken);

// Créer un caissier (Admin, Manager, Super Admin uniquement)
router.post('/', requireRole(['admin', 'manager', 'super_admin']), casinoCashierController.createCashier);

// Mettre à jour un caissier (Admin, Manager, Super Admin uniquement)
router.put('/:id', requireRole(['admin', 'manager', 'super_admin']), casinoCashierController.updateCashier);

// Changer le statut (Admin, Manager, Super Admin uniquement)
router.patch('/:id/status', requireRole(['admin', 'manager', 'super_admin']), casinoCashierController.changeCashierStatus);

// Supprimer un caissier (Admin, Super Admin uniquement)
router.delete('/:id', requireRole(['admin', 'super_admin']), casinoCashierController.deleteCashier);

module.exports = router;