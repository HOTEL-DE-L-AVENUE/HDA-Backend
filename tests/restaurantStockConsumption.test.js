const test = require('node:test');
const assert = require('node:assert/strict');
const { ingredientNeeds } = require('../models/restaurantModel');

function createConnection({
  stockRow = true,
  isRestaurantDish = true,
  recipeItems = [],
} = {}) {
  return {
    query: async (sql, params) => {
      if (sql.includes('FROM products p') && sql.includes('LEFT JOIN stocks s')) {
        return [[{
          type_produit: isRestaurantDish ? 'PRODUIT_FINI' : 'MATIERE_PREMIERE',
          source_module: isRestaurantDish ? 'RESTAURANT' : 'GENERAL',
          stock_id: stockRow ? 1 : null,
        }], []];
      }
      if (sql.includes('SELECT ri.ingredient_id')) {
        return [recipeItems, []];
      }
      throw new Error(`Unexpected query in ingredientNeeds test: ${sql}`);
    },
  };
}

test('sale déduit le plat suivi en stock et les quantités converties de sa recette', async () => {
  const needs = await ingredientNeeds(createConnection({
    recipeItems: [{
      ingredient_id: 200,
      quantite: 0.25,
      recipe_unite: 'KG',
      stock_unite: 'G',
    }],
  }), [{ product_id: 100, quantite: 2 }]);

  assert.deepEqual([...needs.entries()], [['product:100', 2], ['ingredient:200', 500]]);
});

test('sale un produit suivi en stock même sans recette', async () => {
  const needs = await ingredientNeeds(createConnection(), [{ product_id: 100, quantite: 3 }]);

  assert.deepEqual([...needs.entries()], [['product:100', 3]]);
});

test('sale crée aussi la sortie du plat fini si sa ligne de stock est absente', async () => {
  const needs = await ingredientNeeds(createConnection({
    stockRow: false,
    recipeItems: [{
      ingredient_id: 200,
      quantite: 2,
      recipe_unite: 'PIECE',
      stock_unite: 'PIECE',
    }],
  }), [{ product_id: 100, quantite: 1 }]);

  assert.deepEqual([...needs.entries()], [['product:100', 1], ['ingredient:200', 2]]);
});

test('un produit non restaurant non suivi en stock reste exclu des sorties', async () => {
  const needs = await ingredientNeeds(createConnection({
    stockRow: false,
    isRestaurantDish: false,
  }), [{ product_id: 100, quantite: 1 }]);

  assert.deepEqual([...needs.entries()], []);
});

test('identifiants de plat et d’ingrédient identiques restent distincts', async () => {
  const needs = await ingredientNeeds(createConnection({
    recipeItems: [{
      ingredient_id: 100,
      quantite: 0.5,
      recipe_unite: 'KG',
      stock_unite: 'KG',
    }],
  }), [{ product_id: 100, quantite: 1 }]);

  assert.deepEqual([...needs.entries()], [['product:100', 1], ['ingredient:100', 0.5]]);
});
