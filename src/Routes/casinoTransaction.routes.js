// src/Routes/casinoTransaction.routes.js
const express = require('express');
const router = express.Router();
const casinoTransactionController = require('../Controllers/Casino/casinoTransaction.controller');
const { authenticateToken, requireRole } = require('../Middleware/auth.middleware');

// =============================================
// ROUTES PUBLIQUES (Lecture seule - Pas de token requis)
// =============================================

// Récupérer les statistiques
router.get('/stats', casinoTransactionController.getStats);

// Récupérer les transactions par type
router.get('/type/:type', casinoTransactionController.getTransactionsByType);

// Récupérer les transactions par moyen de paiement
router.get('/payment/:moyen', casinoTransactionController.getTransactionsByPaymentMethod);

// Récupérer les transactions par client
router.get('/client/:clientId', casinoTransactionController.getTransactionsByClient);

// Récupérer les transactions par session
router.get('/session/:sessionId', casinoTransactionController.getTransactionsBySession);

// Résumé d'une session
router.get('/session/:sessionId/summary', casinoTransactionController.getSessionSummary);

// Récupérer toutes les transactions
router.get('/', casinoTransactionController.getAllTransactions);

// Récupérer une transaction par ID
router.get('/:id', casinoTransactionController.getTransactionById);

// =============================================
// ROUTES PROTÉGÉES (Nécessite authentification)
// =============================================

// Appliquer le middleware d'authentification
router.use(authenticateToken);

// Créer une transaction (Admin, Manager, Super Admin)
router.post('/', requireRole(['admin', 'manager', 'super_admin']), casinoTransactionController.createTransaction);

// Mettre à jour une transaction (Admin, Manager, Super Admin)
router.put('/:id', requireRole(['admin', 'manager', 'super_admin']), casinoTransactionController.updateTransaction);

// Supprimer une transaction (Admin, Super Admin uniquement)
router.delete('/:id', requireRole(['admin', 'super_admin']), casinoTransactionController.deleteTransaction);

module.exports = router;