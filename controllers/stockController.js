// controllers/stockController.js
const stock = require('../models/stockModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

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

async function movementHandler(req, res) {
  const { product_id, location_id, type, quantite, source_module, reference_id } = req.body;
  if (!product_id || !location_id || !type || !quantite) {
    throw ApiError.badRequest('product_id, location_id, type et quantite sont requis');
  }
  const movement = await stock.recordMovement({
    productId: product_id, locationId: location_id, type, quantite, sourceModule: source_module, referenceId: reference_id,
  });
  return created(res, movement);
}

async function createPurchaseHandler(req, res) {
  const { supplier_id, location_id, items } = req.body;
  if (!supplier_id || !location_id || !items || !items.length) {
    throw ApiError.badRequest('supplier_id, location_id et items sont requis');
  }
  const purchase = await stock.createPurchaseWithItems({ supplierId: supplier_id, locationId: location_id, items });
  return created(res, purchase);
}

async function lowStockHandler(req, res) {
  const rows = await stock.lowStock(Number(req.query.threshold) || 10);
  return ok(res, rows);
}

async function stockByProductHandler(req, res) {
  const rows = await stock.stockByProduct(req.params.id);
  return ok(res, rows);
}

module.exports = {
  categoriesCrud, productTypesCrud, unitsCrud, productsCrud, stockLocationsCrud, stocksCrud,
  stockMovementsCrud, suppliersCrud, purchasesCrud, purchaseItemsCrud,
  movementHandler, createPurchaseHandler, lowStockHandler, stockByProductHandler,
};
