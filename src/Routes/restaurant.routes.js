// src/Routes/restaurant.routes.js
const express = require('express');
const router = express.Router();
const restaurantController = require('../Controllers/restaurant.controller');

// ==================== TABLES ====================

// GET /api/restaurant/tables - Liste des tables
router.get('/tables', restaurantController.getTables);

// GET /api/restaurant/tables/:id - Détail d'une table
router.get('/tables/:id', restaurantController.getTableById);

// POST /api/restaurant/tables - Créer une table
router.post('/tables', restaurantController.createTable);

// PUT /api/restaurant/tables/:id - Modifier une table
router.put('/tables/:id', restaurantController.updateTable);

// DELETE /api/restaurant/tables/:id - Supprimer une table
router.delete('/tables/:id', restaurantController.deleteTable);

// ==================== MENU & PRODUITS ====================

// GET /api/restaurant/menu - Menu complet
router.get('/menu', restaurantController.getMenu);

// GET /api/restaurant/products - Tous les produits
router.get('/products', restaurantController.getProducts);

// GET /api/restaurant/products/:id - Détail d'un produit
router.get('/products/:id', restaurantController.getProductById);

// ==================== RECETTES ====================

// POST /api/restaurant/recipes - Créer une recette
router.post('/recipes', restaurantController.createRecipe);

// GET /api/restaurant/recipes/:id - Détail d'une recette
router.get('/recipes/:id', restaurantController.getRecipeById);

// ==================== COMMANDES ====================

// GET /api/restaurant/orders - Liste des commandes
router.get('/orders', restaurantController.getOrders);

// GET /api/restaurant/orders/:id - Détail d'une commande
router.get('/orders/:id', restaurantController.getOrderById);

// POST /api/restaurant/orders - Créer une commande
router.post('/orders', restaurantController.createOrder);

// PUT /api/restaurant/orders/:id/status - Mettre à jour le statut
router.put('/orders/:id/status', restaurantController.updateOrderStatus);

// ==================== PAIEMENTS ====================

// POST /api/restaurant/payments - Effectuer un paiement
router.post('/payments', restaurantController.processPayment);

// POST /api/restaurant/bill-to-room - Facturer à la chambre
router.post('/bill-to-room', restaurantController.billToRoom);

// ==================== CAISSE ====================

// POST /api/restaurant/cashier/open - Ouvrir une caisse
router.post('/cashier/open', restaurantController.openCashier);

// POST /api/restaurant/cashier/close - Fermer une caisse
router.post('/cashier/close', restaurantController.closeCashier);

// GET /api/restaurant/cashier/status - Statut des caisses
router.get('/cashier/status', restaurantController.getCashierStatus);

// ==================== REPORTING ====================

// GET /api/restaurant/stats - Statistiques
router.get('/stats', restaurantController.getStats);

// ==================== STOCK (complété) ====================
router.get('/stock/locations', restaurantController.getStockLocations);
router.get('/stock', restaurantController.getStocks);
router.get('/stock/movements', restaurantController.getStockMovements);
router.post('/stock/adjust', restaurantController.adjustStock);

// ==================== PRODUITS ====================
router.post('/products', restaurantController.createProduct);
router.put('/products/:id', restaurantController.updateProduct);   // NOUVEAU

// ==================== FOURNISSEURS ====================
router.get('/suppliers', restaurantController.getSuppliers);       // NOUVEAU
router.post('/suppliers', restaurantController.createSupplier);    // NOUVEAU

// ==================== ACHATS ====================
router.get('/purchases', restaurantController.getPurchases);       // NOUVEAU
router.post('/purchases', restaurantController.createPurchase);    // NOUVEAU
router.get('/purchases/:id', restaurantController.getPurchaseById); // NOUVEAU

// ==================== RECETTES ====================
router.post('/recipes', restaurantController.createRecipe);
router.get('/recipes/:id', restaurantController.getRecipeById);
router.get('/recipes', restaurantController.getAllRecipes);         // NOUVEAU
router.put('/recipes/:id', restaurantController.updateRecipe);     // NOUVEAU
router.delete('/recipes/:id', restaurantController.deleteRecipe);  // NOUVEAU

// ==================== UNITÉS ====================
router.get('/units', restaurantController.getUnits);               // NOUVEAU

// ==================== TYPES DE PRODUITS ====================
router.get('/product-types', restaurantController.getProductTypes);

// ==================== CATÉGORIES ====================
router.get('/categories', restaurantController.getCategories);

module.exports = router;