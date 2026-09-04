// controllers/stockController.js
const stock = require('../models/stockModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

// CRUD génériques générés par le controllerFactory
const categoriesCrud = createCrudController(stock.Categories, {});
const subcategoriesCrud = createCrudController(stock.Subcategories, { filterable: ['category_id'] });
const productTypesCrud = createCrudController(stock.ProductTypes, { filterable: ['actif'] });
const unitsCrud = createCrudController(stock.Units, {});
const productsCrud = createCrudController(stock.Products, { filterable: ['category_id', 'subcategory_id', 'actif', 'type_produit'] });
const stockLocationsCrud = createCrudController(stock.StockLocations, {});
const stocksCrud = createCrudController(stock.Stocks, { filterable: ['product_id', 'location_id'] });
const stockMovementsCrud = createCrudController(stock.StockMovements, { filterable: ['product_id', 'location_id', 'type_mouvement', 'source_module'] });
const suppliersCrud = createCrudController(stock.Suppliers, {});
const purchasesCrud = createCrudController(stock.Purchases, { filterable: ['supplier_id', 'statut'] });
const purchaseItemsCrud = createCrudController(stock.PurchaseItems, { filterable: ['purchase_id'] });

function validateStockPayload(body) {
  if (body.quantite !== undefined && (!Number.isFinite(Number(body.quantite)) || Number(body.quantite) < 0)) {
    throw ApiError.badRequest('La quantité de stock doit être positive ou nulle');
  }
  if (body.seuil_minimum !== undefined && (!Number.isFinite(Number(body.seuil_minimum)) || Number(body.seuil_minimum) < 0)) {
    throw ApiError.badRequest('Le seuil minimum doit être positif ou nul');
  }
}

async function createStockHandler(req, res) {
  validateStockPayload(req.body);
  return created(res, await stock.Stocks.create(req.body));
}

async function updateStockHandler(req, res) {
  validateStockPayload(req.body);
  const existing = await stock.Stocks.findById(req.params.id);
  if (!existing) throw ApiError.notFound(`stocks #${req.params.id} introuvable`);
  return ok(res, await stock.Stocks.update(req.params.id, req.body));
}

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
    const { supplier_id, location_id, items, source_module } = req.body;

    if (!supplier_id || !location_id || !Array.isArray(items) || items.length === 0) {
      throw ApiError.badRequest('supplier_id, location_id et un tableau items non vide sont requis');
    }

    const purchase = await stock.createPurchaseWithItems({
      supplierId: supplier_id,
      locationId: location_id,
      items,
      sourceModule: source_module || 'GENERAL',
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

/**
 * Récupère les stocks avec informations produits
 */
async function getProductsWithStockHandler(req, res, next) {
  try {
    const location_id = req.query.location_id ? Number(req.query.location_id) : null;
    const rows = await stock.getProductsWithStock(location_id);
    return ok(res, rows);
  } catch (err) {
    next(err);
  }
}

/**
 * Consomme une portion d'un produit (stock basé sur les portions)
 */
async function consumePortionHandler(req, res, next) {
  try {
    const { product_id, location_id, portion_size, portion_unit, reference_id, source_module } = req.body;

    if (!product_id || !location_id || portion_size === undefined) {
      throw ApiError.badRequest('product_id, location_id et portion_size sont requis');
    }

    if (isNaN(portion_size) || Number(portion_size) <= 0) {
      throw ApiError.badRequest('La portion doit être un nombre positif');
    }

    const result = await stock.consumePortion({
      productId: product_id,
      locationId: location_id,
      portionSize: Number(portion_size),
      portionUnit: portion_unit || 'g',
      referenceId: reference_id || null,
      sourceModule: source_module || 'RESTAURANT',
    });

    return created(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  categoriesCrud,
  subcategoriesCrud,
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
  getProductsWithStockHandler,
  createStockHandler,
  updateStockHandler,
  consumePortionHandler,
};
