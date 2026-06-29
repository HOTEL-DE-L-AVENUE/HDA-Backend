// src/Routes/casinoRoom.routes.js
const express = require('express');
const router = express.Router();
const casinoRoomController = require('../Controllers/Casino/casinoRoom.controller');
const { authenticateToken, requireRole } = require('../Middleware/auth.middleware');

// =============================================
// ROUTES PUBLIQUES (Lecture seule - Pas de token requis)
// =============================================

// Récupérer les statistiques
router.get('/stats', casinoRoomController.getStats);

// Récupérer les salles par type
router.get('/type/:type', casinoRoomController.getRoomsByType);

// Récupérer les salles par statut
router.get('/status/:statut', casinoRoomController.getRoomsByStatus);

// Récupérer toutes les salles
router.get('/', casinoRoomController.getAllRooms);

// Récupérer une salle par ID
router.get('/:id', casinoRoomController.getRoomById);

// =============================================
// ROUTES PROTÉGÉES (Nécessite authentification)
// =============================================

// Appliquer le middleware d'authentification pour les routes suivantes
router.use(authenticateToken);

// Créer une salle (Admin, Manager, Super Admin uniquement)
router.post('/', requireRole(['admin', 'manager', 'super_admin']), casinoRoomController.createRoom);

// Mettre à jour une salle (Admin, Manager, Super Admin uniquement)
router.put('/:id', requireRole(['admin', 'manager', 'super_admin']), casinoRoomController.updateRoom);

// Changer le statut (Admin, Manager, Super Admin uniquement)
router.patch('/:id/status', requireRole(['admin', 'manager', 'super_admin']), casinoRoomController.changeRoomStatus);

// Supprimer une salle (Admin, Super Admin uniquement)
router.delete('/:id', requireRole(['admin', 'super_admin']), casinoRoomController.deleteRoom);

module.exports = router;