// controllers/restaurantController.js
const resto = require('../models/restaurantModel');
const { createCrudController } = require('./controllerFactory');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');

const tablesCrud = createCrudController(resto.TablesRestaurant, { filterable: ['statut'] });
const ordersCrud = createCrudController(resto.Orders, { filterable: ['client_id', 'statut', 'source_module'] });
const orderItemsCrud = createCrudController(resto.OrderItems, { filterable: ['order_id', 'product_id'] });
const recipesCrud = createCrudController(resto.Recipes, { filterable: ['product_id'] });
const recipeItemsCrud = createCrudController(resto.RecipeItems, { filterable: ['recipe_id'] });
const cashiersCrud = createCrudController(resto.RestaurantCashiers, { filterable: ['statut'] });
const sessionsCrud = createCrudController(resto.RestaurantSessions, { filterable: ['cashier_id', 'user_id'] });

async function createOrderHandler(req, res) {
  const { client_id, items } = req.body;
  if (!items || !items.length) throw ApiError.badRequest('items requis (au moins une ligne)');
  const order = await resto.createOrderWithItems({ clientId: client_id, items });
  return created(res, order);
}

async function orderDetailHandler(req, res) {
  const order = await resto.orderWithItems(req.params.id);
  if (!order) throw ApiError.notFound(`Commande #${req.params.id} introuvable`);
  return ok(res, order);
}

async function ordersInProgressHandler(req, res) {
  const rows = await resto.ordersByTable(req.query.statut || 'EN_COURS');
  return ok(res, rows);
}

async function recipeRequirementsHandler(req, res) {
  const portions = Number(req.query.portions) || 1;
  const rows = await resto.recipeRequirements(req.params.id, portions);
  return ok(res, rows);
}

module.exports = {
  tablesCrud, ordersCrud, orderItemsCrud, recipesCrud, recipeItemsCrud, cashiersCrud, sessionsCrud,
  createOrderHandler, orderDetailHandler, ordersInProgressHandler, recipeRequirementsHandler,
};
