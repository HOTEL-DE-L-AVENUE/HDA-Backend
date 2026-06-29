// src/Routes/casinoSession.routes.js
const express = require('express');
const router = express.Router();
const casinoSessionController = require('../Controllers/Casino/casinoSession.controller');
const { authenticateToken, requireRole } = require('../Middleware/auth.middleware');

// =============================================
// ROUTES PUBLIQUES (Lecture seule - Pas de token requis)
// =============================================

// Récupérer les statistiques
router.get('/stats', casinoSessionController.getStats);

// Récupérer les sessions actives
router.get('/active', casinoSessionController.getActiveSessions);

// Récupérer les sessions fermées
router.get('/closed', casinoSessionController.getClosedSessions);

// Récupérer les sessions par caissier
router.get('/cashier/:cashierId', casinoSessionController.getSessionsByCashier);

// Récupérer les sessions par utilisateur
router.get('/user/:userId', casinoSessionController.getSessionsByUser);

// Récupérer toutes les sessions
router.get('/', casinoSessionController.getAllSessions);

// Récupérer une session par ID
router.get('/:id', casinoSessionController.getSessionById);

// =============================================
// ROUTES PROTÉGÉES (Nécessite authentification)
// =============================================

// Appliquer le middleware d'authentification
router.use(authenticateToken);

// Ouvrir une session (Admin, Manager, Super Admin)
router.post('/open', requireRole(['admin', 'manager', 'super_admin']), casinoSessionController.openSession);

// Fermer une session (Admin, Manager, Super Admin)
router.post('/:id/close', requireRole(['admin', 'manager', 'super_admin']), casinoSessionController.closeSession);

// Supprimer une session (Admin, Super Admin uniquement)
router.delete('/:id', requireRole(['admin', 'super_admin']), casinoSessionController.deleteSession);

module.exports = router;