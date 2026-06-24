// src/Routes/admin.routes.js
const express = require('express');
const router = express.Router();
const adminController = require('../Controllers/admin.controller');
const { authenticateToken, requireRole } = require('../Middleware/auth.middleware');

// =============================================
// ROUTES PUBLIQUES (Pas de token requis)
// =============================================

// Créer un administrateur - PUBLIC (pas de token requis)
router.post('/', adminController.createAdmin);

// Vérifier si des admins existent - PUBLIC
router.get('/check', adminController.checkAdminsExist);

// =============================================
// ROUTES PROTÉGÉES (Token admin requis)
// =============================================

// Appliquer les middlewares pour toutes les routes suivantes
router.use(authenticateToken);
router.use(requireRole(['admin', 'super_admin']));

// Routes protégées
router.get('/', adminController.getAllAdmins);
router.get('/:id', adminController.getAdminById);
router.put('/:id', adminController.updateAdmin);
router.delete('/:id', adminController.deleteAdmin);
router.patch('/:id/status', adminController.changeAdminStatus);
router.post('/:id/reset-password', adminController.resetPassword);

module.exports = router;