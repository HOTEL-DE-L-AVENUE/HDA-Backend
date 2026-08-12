// controllers/stockController.js
const stock = require('../models/stockModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

// CRUD génériques générés par le controllerFactory
const categoriesCrud = createCrudController(stock.Categories, {});
const productTypesCrud = createCrudController(stock.ProductTypes, { filterable: ['actif'] });
const unitsCrud = createCrudController(stock.Units, {});
const productsCrud = createCrudController(stock.Products, { filterable: ['category_id', 'actif', 'type_produit'] });
const stockLocationsCrud = createCrudController(stock.StockLocations, {});
const stocksCrud = createCrudController(stock.Stocks, { filterable: ['product_id', 'location_id'] });
const stockMovementsCrud = createCrudController(stock.StockMovements, { filterable: ['product_id', 'location_id', 'type_mouvement', 'source_module'] });
const suppliersCrud = createCrudController(stock.Suppliers, {});
const purchasesCrud = createCrudController(stock.Purchases, { filterable: ['supplier_id', 'statut'] });
const purchaseItemsCrud = createCrudController(stock.PurchaseItems, { filterable: ['purchase_id'] });

/**
 * Enregistre un mouvement de stock manuel ou provenant d'un module tiers
 */
async function movementHandler(req, res, next) {
  try {
    const { product_id, location_id, type, quantite, source_module, reference_id } = req.body;

    if (!product_id || !location_id || !type || quantite === undefined) {
      throw ApiError.badRequest('product_id, location_id, type et quantite sont requis');
    }

    if (isNaN(quantite) || Number(quantite) <= 0) {
      throw ApiError.badRequest('La quantité doit être un nombre positif supérieur à 0');
    }

    const movement = await stock.recordMovement({
      productId: product_id,
      locationId: location_id,
      type,
      quantite: Number(quantite),
      sourceModule: source_module,
      referenceId: reference_id,
    });

    return created(res, movement);
  } catch (err) {
    next(err);
  }
}

/**
 * Crée un bon d'achat avec ses articles associés
 */
async function createPurchaseHandler(req, res, next) {
  try {
    const { supplier_id, location_id, items } = req.body;

    if (!supplier_id || !location_id || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('supplier_id, location_id et un tableau items non vide sont requis');
    }

    const purchase = await stock.createPurchaseWithItems({
      supplierId: supplier_id,
      locationId: location_id,
      items,
    });

    return created(res, purchase);
  } catch (err) {
    next(err);
  }
}

/**
 * Récupère les produits sous le seuil de stock minimal
 */
async function lowStockHandler(req, res, next) {
  try {
    const threshold = Math.max(0, Number(req.query.threshold) || 10);
    const rows = await stock.lowStock(threshold);
    return ok(res, rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Récupère l'état des stocks d'un produit spécifique
 */
async function stockByProductHandler(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      throw ApiError.badRequest('L\'ID du produit est requis');
    }
    const rows = await stock.stockByProduct(id);
    return ok(res, rows);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  categoriesCrud,
  productTypesCrud,
  unitsCrud,
  productsCrud,
  stockLocationsCrud,
  stocksCrud,
  stockMovementsCrud,
  suppliersCrud,
  purchasesCrud,
  purchaseItemsCrud,
  movementHandler,
  createPurchaseHandler,
  lowStockHandler,
  stockByProductHandler,
};