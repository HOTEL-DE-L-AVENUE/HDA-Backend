const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ingredientNeeds,
  consumeRestaurantRecipeIngredients,
} = require('../models/restaurantModel');

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

test('le calcul legacy inclut le plat suivi en stock et les quantités converties de sa recette', async () => {
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

test('une commande ne déduit pas une seconde fois les ingrédients déjà sortis à la création de la recette', async () => {
  const needs = await ingredientNeeds(createConnection(), [{ product_id: 100, quantite: 2 }], {
    includeRecipeIngredients: false,
  });

  assert.deepEqual([...needs.entries()], [['product:100', 2]]);
});

test('la création de recette déduit les quantités demandées du stock cuisine', async () => {
  let quantity = 10;
  const movements = [];
  const connection = {
    query: async (sql, params) => {
      if (sql.includes('SELECT quantite FROM restaurant_ingredient_stocks')) {
        return [[{ quantite: quantity }], []];
      }
      if (sql.includes('SELECT id, quantite') && sql.includes('restaurant_ingredient_stocks')) {
        return [[{ id: 1, quantite: quantity }], []];
      }
      if (sql.includes('UPDATE restaurant_ingredient_stocks SET quantite')) {
        quantity = Number(params[0]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('INSERT INTO restaurant_ingredient_stock_movements')) {
        movements.push(params);
        return [{ insertId: movements.length }, []];
      }
      throw new Error(`Unexpected query in recipe stock test: ${sql}`);
    },
  };

  await consumeRestaurantRecipeIngredients(connection, {
    ingredients: [{
      ingredientId: 200,
      quantity: 5,
      unit: 'KG',
      stockUnit: 'KG',
      name: 'Farine',
    }],
    productId: 100,
    productName: 'Pizza',
    userId: 1,
  });

  assert.equal(quantity, 5);
  assert.equal(movements.length, 1);
  assert.equal(movements[0][2], 'SORTIE');
  assert.equal(movements[0][3], 5);
});

test('la création de recette est refusée si le stock cuisine est insuffisant', async () => {
  let movementCreated = false;
  const connection = {
    query: async (sql) => {
      if (sql.includes('SELECT quantite FROM restaurant_ingredient_stocks')) {
        return [[{ quantite: 4 }], []];
      }
      if (sql.includes('INSERT INTO restaurant_ingredient_stock_movements')) {
        movementCreated = true;
        return [{ insertId: 1 }, []];
      }
      throw new Error(`Unexpected query in insufficient recipe stock test: ${sql}`);
    },
  };

  await assert.rejects(
    consumeRestaurantRecipeIngredients(connection, {
      ingredients: [{
        ingredientId: 200,
        quantity: 5,
        unit: 'KG',
        stockUnit: 'KG',
        name: 'Farine',
      }],
      productId: 100,
      productName: 'Pizza',
    }),
    { status: 409, message: /Stock insuffisant pour Farine/ }
  );
  assert.equal(movementCreated, false);
});
