// src/Controllers/restaurant.controller.js
const RestaurantModel = require("../Models/restaurant.model");

// ==================== GESTION TABLES ====================

const createTable = async (req, res) => {
  try {
    const { numero, capacite } = req.body;

    if (!numero || !capacite) {
      return res.status(400).json({
        success: false,
        message: "Le numéro et la capacité sont requis",
      });
    }

    const tableId = await RestaurantModel.createTable(req.body);
    const table = await RestaurantModel.findTableById(tableId);

    res.status(201).json({
      success: true,
      message: "Table créée avec succès",
      data: table,
    });
  } catch (error) {
    console.error("❌ [createTable] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de la table",
      error: error.message,
    });
  }
};

const getTables = async (req, res) => {
  try {
    const tables = await RestaurantModel.findAllTables(req.query);
    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error) {
    console.error("❌ [getTables] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des tables",
    });
  }
};

const getTableById = async (req, res) => {
  try {
    const table = await RestaurantModel.findTableById(req.params.id);
    if (!table) {
      return res.status(404).json({
        success: false,
        message: "Table non trouvée",
      });
    }
    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error) {
    console.error("❌ [getTableById] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la table",
    });
  }
};

const updateTable = async (req, res) => {
  try {
    const updated = await RestaurantModel.updateTable(req.params.id, req.body);
    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Aucune modification apportée",
      });
    }
    const table = await RestaurantModel.findTableById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Table mise à jour avec succès",
      data: table,
    });
  } catch (error) {
    console.error("❌ [updateTable] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour de la table",
    });
  }
};

const deleteTable = async (req, res) => {
  try {
    const deleted = await RestaurantModel.deleteTable(req.params.id);
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: "Erreur lors de la suppression",
      });
    }
    res.status(200).json({
      success: true,
      message: "Table supprimée avec succès",
    });
  } catch (error) {
    console.error("❌ [deleteTable] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression de la table",
    });
  }
};

// ==================== MENUS & PRODUITS ====================

const getMenu = async (req, res) => {
  try {
    const menuItems = await RestaurantModel.getMenuItems();
    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (error) {
    console.error("❌ [getMenu] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du menu",
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await RestaurantModel.findAllProducts(req.query);
    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("❌ [getProducts] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des produits",
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await RestaurantModel.findProductById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produit non trouvé",
      });
    }
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("❌ [getProductById] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du produit",
    });
  }
};

// ==================== RECETTES ====================

const createRecipe = async (req, res) => {
  try {
    const { product_id, nom, ingredients } = req.body;

    if (!product_id || !nom) {
      return res.status(400).json({
        success: false,
        message: "Le produit et le nom de la recette sont requis",
      });
    }

    const recipeId = await RestaurantModel.createRecipe({ product_id, nom });

    if (ingredients && ingredients.length > 0) {
      for (const ingredient of ingredients) {
        await RestaurantModel.addRecipeIngredient({
          recipe_id: recipeId,
          ingredient_id: ingredient.ingredient_id,
          quantite: ingredient.quantite,
        });
      }
    }

    const recipe = await RestaurantModel.getRecipeWithIngredients(recipeId);

    res.status(201).json({
      success: true,
      message: "Recette créée avec succès",
      data: recipe,
    });
  } catch (error) {
    console.error("❌ [createRecipe] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de la recette",
      error: error.message,
    });
  }
};

const getRecipeById = async (req, res) => {
  try {
    const recipe = await RestaurantModel.getRecipeWithIngredients(
      req.params.id,
    );
    if (!recipe) {
      return res.status(404).json({
        success: false,
        message: "Recette non trouvée",
      });
    }
    res.status(200).json({
      success: true,
      data: recipe,
    });
  } catch (error) {
    console.error("❌ [getRecipeById] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la recette",
    });
  }
};

// ==================== COMMANDES ====================

const createOrder = async (req, res) => {
  try {
    const { client_id, table_id, items } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Au moins un article est requis",
      });
    }

    // Créer la commande
    const orderId = await RestaurantModel.createOrder({
      client_id,
      source_module: "RESTAURANT",
    });

    // Ajouter les items
    for (const item of items) {
      await RestaurantModel.addOrderItem({
        order_id: orderId,
        product_id: item.product_id,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
      });
    }

    // Mettre à jour le total
    await RestaurantModel.updateOrderTotal(orderId);

    // Déduire le stock automatiquement
    await RestaurantModel.deduireStock(orderId);

    // Récupérer la commande complète
    const order = await RestaurantModel.findOrderById(orderId);

    res.status(201).json({
      success: true,
      message: "Commande créée avec succès",
      data: order,
    });
  } catch (error) {
    console.error("❌ [createOrder] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la création de la commande",
      error: error.message,
    });
  }
};

const getOrders = async (req, res) => {
  try {
    const orders = await RestaurantModel.findAllOrders(req.query);
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error("❌ [getOrders] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des commandes",
    });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await RestaurantModel.findOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("❌ [getOrderById] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération de la commande",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { statut } = req.body;
    const updated = await RestaurantModel.updateOrderStatus(
      req.params.id,
      statut,
    );

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: "Erreur lors de la mise à jour du statut",
      });
    }

    const order = await RestaurantModel.findOrderById(req.params.id);
    res.status(200).json({
      success: true,
      message: "Statut mis à jour avec succès",
      data: order,
    });
  } catch (error) {
    console.error("❌ [updateOrderStatus] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour du statut",
    });
  }
};

// ==================== PAIEMENTS ====================

const processPayment = async (req, res) => {
  try {
    const { order_id, montant, moyen_paiement, client_id } = req.body;

    if (!order_id || !montant || !moyen_paiement) {
      return res.status(400).json({
        success: false,
        message: "La commande, le montant et le moyen de paiement sont requis",
      });
    }

    // Récupérer la commande
    const order = await RestaurantModel.findOrderById(order_id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Commande non trouvée",
      });
    }

    // Créer le paiement
    const paymentId = await RestaurantModel.createPayment({
      client_id: client_id || order.client_id,
      montant,
      moyen_paiement,
    });

    // Mettre à jour le statut de la commande
    await RestaurantModel.updateOrderStatus(order_id, "PAYEE");

    res.status(201).json({
      success: true,
      message: "Paiement effectué avec succès",
      data: { payment_id: paymentId },
    });
  } catch (error) {
    console.error("❌ [processPayment] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors du traitement du paiement",
      error: error.message,
    });
  }
};

// ==================== FACTURATION CHAMBRE ====================

const billToRoom = async (req, res) => {
  try {
    const { order_id, room_id } = req.body;

    if (!order_id || !room_id) {
      return res.status(400).json({
        success: false,
        message: "La commande et la chambre sont requis",
      });
    }

    const invoiceId = await RestaurantModel.facturerChambre(order_id, room_id);

    res.status(200).json({
      success: true,
      message: "Commande facturée à la chambre avec succès",
      data: { invoice_id: invoiceId },
    });
  } catch (error) {
    console.error("❌ [billToRoom] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la facturation à la chambre",
      error: error.message,
    });
  }
};

// ==================== CAISSE ====================

const openCashier = async (req, res) => {
  try {
    const { nom, user_id, fond_initial } = req.body;

    const cashierId = await RestaurantModel.createCashier({ nom });
    const sessionId = await RestaurantModel.openSession({
      cashier_id: cashierId,
      user_id,
      fond_initial,
    });

    res.status(201).json({
      success: true,
      message: "Caisse ouverte avec succès",
      data: {
        cashier_id: cashierId,
        session_id: sessionId,
      },
    });
  } catch (error) {
    console.error("❌ [openCashier] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'ouverture de la caisse",
      error: error.message,
    });
  }
};

const closeCashier = async (req, res) => {
  try {
    const { session_id, fond_final } = req.body;

    const closed = await RestaurantModel.closeSession(session_id, fond_final);

    if (!closed) {
      return res.status(400).json({
        success: false,
        message: "Erreur lors de la fermeture de la session",
      });
    }

    res.status(200).json({
      success: true,
      message: "Caisse fermée avec succès",
    });
  } catch (error) {
    console.error("❌ [closeCashier] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la fermeture de la caisse",
      error: error.message,
    });
  }
};

const getCashierStatus = async (req, res) => {
  try {
    const cashiers = await RestaurantModel.findAllCashiers();

    for (const cashier of cashiers) {
      cashier.current_session = await RestaurantModel.getCurrentSession(
        cashier.id,
      );
    }

    res.status(200).json({
      success: true,
      data: cashiers,
    });
  } catch (error) {
    console.error("❌ [getCashierStatus] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération du statut des caisses",
    });
  }
};

// ==================== REPORTING ====================

const getStats = async (req, res) => {
  try {
    const { date_debut, date_fin } = req.query;

    if (!date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        message: "Les dates de début et de fin sont requises",
      });
    }

    const stats = await RestaurantModel.getRestaurantStats(
      date_debut,
      date_fin,
    );
    const topProducts = await RestaurantModel.getTopProducts(
      date_debut,
      date_fin,
    );
    const salesByCategory = await RestaurantModel.getSalesByCategory(
      date_debut,
      date_fin,
    );

    res.status(200).json({
      success: true,
      data: {
        general: stats,
        top_products: topProducts,
        ventes_par_categorie: salesByCategory,
      },
    });
  } catch (error) {
    console.error("❌ [getStats] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des statistiques",
    });
  }
};

// --- STOCK ---

const getStockLocations = async (req, res) => {
  try {
    const locations = await RestaurantModel.getStockLocations();
    res.status(200).json({ success: true, data: locations });
  } catch (error) {
    console.error("❌ [getStockLocations]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStocks = async (req, res) => {
  try {
    const stocks = await RestaurantModel.getStocks(req.query);
    res.status(200).json({ success: true, data: stocks });
  } catch (error) {
    console.error("❌ [getStocks]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStockMovements = async (req, res) => {
  try {
    const movements = await RestaurantModel.getStockMovements(req.query);
    res.status(200).json({ success: true, data: movements });
  } catch (error) {
    console.error("❌ [getStockMovements]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const adjustStock = async (req, res) => {
  try {
    const result = await RestaurantModel.adjustStock(req.body);
    res
      .status(200)
      .json({ success: true, data: result, message: "Stock mis à jour" });
  } catch (error) {
    console.error("❌ [adjustStock]", error);
    res.status(400).json({ success: false, message: error.message });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      nom,
      unite,
      type_produit,
      code,
      prix_achat,
      prix_vente,
      category_id,
    } = req.body;
    if (!nom || !unite) {
      return res
        .status(400)
        .json({ success: false, message: "Nom et unité requis" });
    }
    const productId = await RestaurantModel.createProduct({
      nom,
      unite,
      type_produit,
      code,
      prix_achat,
      prix_vente,
      category_id,
    });
    const newProduct = await RestaurantModel.findProductById(productId);
    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    console.error("❌ [createProduct]", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== PRODUITS ====================

const updateProduct = async (req, res) => {
  try {
    const updated = await RestaurantModel.updateProduct(
      req.params.id,
      req.body,
    );
    if (!updated)
      return res
        .status(400)
        .json({ success: false, message: "Aucune modification" });
    const product = await RestaurantModel.findProductById(req.params.id);
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== FOURNISSEURS ====================

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await RestaurantModel.getSuppliers();
    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const { nom, telephone, email } = req.body;
    if (!nom)
      return res.status(400).json({ success: false, message: "Nom requis" });
    const id = await RestaurantModel.createSupplier({ nom, telephone, email });
    const supplier = await RestaurantModel.findSupplierById(id);
    res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== ACHATS ====================

const getPurchases = async (req, res) => {
  try {
    const purchases = await RestaurantModel.findAllPurchases();
    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPurchase = async (req, res) => {
  try {
    const { supplier_id, items } = req.body;
    if (!supplier_id || !items?.length) {
      return res
        .status(400)
        .json({ success: false, message: "Fournisseur et articles requis" });
    }
    const purchaseId = await RestaurantModel.createPurchase({
      supplier_id,
      items,
    });
    const purchase = await RestaurantModel.findPurchaseById(purchaseId);
    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPurchaseById = async (req, res) => {
  try {
    const purchase = await RestaurantModel.findPurchaseById(req.params.id);
    if (!purchase)
      return res
        .status(404)
        .json({ success: false, message: "Achat non trouvé" });
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== RECETTES ====================

const getAllRecipes = async (req, res) => {
  try {
    const recipes = await RestaurantModel.getAllRecipes();
    res.json({ success: true, data: recipes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateRecipe = async (req, res) => {
  try {
    await RestaurantModel.updateRecipe(req.params.id, req.body);
    const recipe = await RestaurantModel.getRecipeWithIngredients(
      req.params.id,
    );
    res.json({ success: true, data: recipe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteRecipe = async (req, res) => {
  try {
    const deleted = await RestaurantModel.deleteRecipe(req.params.id);
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Recette non trouvée" });
    res.json({ success: true, message: "Recette supprimée" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== UNITÉS ====================

const getUnits = async (req, res) => {
  try {
    const units = await RestaurantModel.getUnits();
    res.json({ success: true, data: units });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==================== TYPES DE PRODUITS ====================

const getProductTypes = async (req, res) => {
  try {
    const types = await RestaurantModel.getProductTypes();
    res.status(200).json({
      success: true,
      data: types,
    });
  } catch (error) {
    console.error("❌ [getProductTypes] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des types de produits",
    });
  }
};

// ==================== CATÉGORIES ====================

const getCategories = async (req, res) => {
  try {
    const categories = await RestaurantModel.getCategories();
    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error("❌ [getCategories] Erreur:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des catégories",
    });
  }
};

module.exports = {
  // Tables
  createTable,
  getTables,
  getTableById,
  updateTable,
  deleteTable,

  // Menu & Produits
  getMenu,
  getProducts,
  getProductById,

  // Recettes
  createRecipe,
  getRecipeById,

  // Commandes
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,

  // Paiements
  processPayment,
  billToRoom,

  // Caisse
  openCashier,
  closeCashier,
  getCashierStatus,

  // Reporting
  getStats,

  getStockLocations,
  getStocks,
  getStockMovements,
  adjustStock,
  createProduct,

  updateProduct, 
  getSuppliers,
  createSupplier,
  getPurchases, 
  createPurchase, 
  getPurchaseById,
  getAllRecipes, 
  updateRecipe, 
  deleteRecipe, 
  getUnits,

  getProductTypes,

  getCategories
};
