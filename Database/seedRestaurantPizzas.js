// Database/seedRestaurantPizzas.js
const { pool } = require('../config/db');
const { ensureRestaurantSchema } = require('../models/restaurantModel');

/**
 * Seeder du menu Restaurant « Pizza Sélectionnée » (carte Le Point d'Exclamation).
 * Crée les plats (products, PRODUIT_FINI), leurs ingrédients (restaurant_ingredients),
 * le stock restaurant des ingrédients (à 0) et les recettes qui relient les deux : chaque
 * commande sort du stock restaurant les ingrédients de la recette × quantité
 * commandée (voir models/restaurantModel.js, syncOrderIngredients).
 *
 * Les quantités des recettes sont des portions estimées par pizza (unité de
 * l'ingrédient) : à ajuster selon les fiches techniques de la cuisine.
 */
class SeedRestaurantPizzas {
    async getOrCreateCategoryId(categoryName) {
        const [rows] = await pool.query('SELECT id FROM categories WHERE nom = ? LIMIT 1', [categoryName]);
        if (rows.length > 0) return rows[0].id;

        const [result] = await pool.query('INSERT INTO categories (nom) VALUES (?)', [categoryName]);
        console.log(`📂 Catégorie "${categoryName}" créée (ID: ${result.insertId})`);
        return result.insertId;
    }

    async run() {
        try {
            console.log('🚀 Début du seeder des pizzas du restaurant...');

            // Garantit les tables restaurant_ingredients* et la FK recipe_items -> restaurant_ingredients
            await ensureRestaurantSchema();

            const pizzaCategoryId = await this.getOrCreateCategoryId('Pizza');

            // 1. Ingrédients (texte jaune de la carte)
            const ingredients = [
                { code: 'ING_COULIS_TOMATE', nom: 'Coulis de tomate', unite: 'L' },
                { code: 'ING_FROMAGE', nom: 'Fromage', unite: 'kg' },
                { code: 'ING_MOZZARELLA', nom: 'Mozzarella', unite: 'kg' },
                { code: 'ING_RICOTTA', nom: 'Ricotta', unite: 'kg' },
                { code: 'ING_CHEDDAR', nom: 'Cheddar', unite: 'kg' },
                { code: 'ING_CAMEMBERT', nom: 'Camembert', unite: 'kg' },
                { code: 'ING_CREME', nom: 'Crème', unite: 'L' },
                { code: 'ING_BASILIC', nom: 'Basilic', unite: 'kg' },
                { code: 'ING_ORIGAN', nom: 'Origan', unite: 'kg' },
                { code: 'ING_POIVRE', nom: 'Poivre', unite: 'kg' },
                { code: 'ING_CHAMPIGNONS', nom: 'Champignons', unite: 'kg' },
                { code: 'ING_OLIVES', nom: 'Olives', unite: 'kg' },
                { code: 'ING_ARTICHAUTS', nom: 'Artichauts', unite: 'kg' },
                { code: 'ING_POIVRONS', nom: 'Poivrons', unite: 'kg' },
                { code: 'ING_MAIS', nom: 'Maïs', unite: 'kg' },
                { code: 'ING_OIGNONS', nom: 'Oignons', unite: 'kg' },
                { code: 'ING_OIGNONS_ROUGES', nom: 'Oignons rouges', unite: 'kg' },
                { code: 'ING_CAPRES', nom: 'Câpres', unite: 'kg' },
                { code: 'ING_THON', nom: 'Thon', unite: 'kg' },
                { code: 'ING_CREVETTES', nom: 'Crevettes', unite: 'kg' },
                { code: 'ING_CALMARS', nom: 'Calmars', unite: 'kg' },
                { code: 'ING_PEPPERONI_BOEUF', nom: 'Pepperoni bœuf', unite: 'kg' },
                { code: 'ING_MIEL', nom: 'Miel', unite: 'kg' },
                { code: 'ING_HUILE_OLIVE', nom: "Huile d'olive", unite: 'L' },
            ];

            // 2. Menu (texte blanc) et prix (texte bleu), avec la recette de chaque pizza
            const pizzas = [
                {
                    code: 'PIZZA_MARGUERITA', nom: 'Marguerita', prix_vente: 35000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_FROMAGE', 0.05], ['ING_MOZZARELLA', 0.12], ['ING_BASILIC', 0.005], ['ING_ORIGAN', 0.002]],
                },
                {
                    code: 'PIZZA_QUATRE_SAISONS', nom: 'Quatre Saisons', prix_vente: 38000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_MOZZARELLA', 0.1], ['ING_FROMAGE', 0.04], ['ING_CHAMPIGNONS', 0.04], ['ING_OLIVES', 0.02], ['ING_ARTICHAUTS', 0.04], ['ING_ORIGAN', 0.002], ['ING_POIVRONS', 0.03], ['ING_MAIS', 0.03]],
                },
                {
                    code: 'PIZZA_THON', nom: 'Thon', prix_vente: 38000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_MOZZARELLA', 0.1], ['ING_THON', 0.08], ['ING_CAPRES', 0.01], ['ING_OIGNONS_ROUGES', 0.03], ['ING_ORIGAN', 0.002]],
                },
                {
                    code: 'PIZZA_QUATRE_FROMAGES', nom: 'Quatre Fromages', prix_vente: 40000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_RICOTTA', 0.05], ['ING_MOZZARELLA', 0.06], ['ING_CHEDDAR', 0.05], ['ING_CAMEMBERT', 0.05]],
                },
                {
                    code: 'PIZZA_NEW_YORK_SICILIENNE', nom: 'New York Sicilienne', prix_vente: 40000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_MOZZARELLA', 0.1], ['ING_FROMAGE', 0.04], ['ING_POIVRONS', 0.04], ['ING_PEPPERONI_BOEUF', 0.06]],
                },
                {
                    code: 'PIZZA_FLOCON_DE_NEIGE', nom: 'Flocon de Neige', prix_vente: 40000,
                    recette: [['ING_CREME', 0.06], ['ING_MOZZARELLA', 0.1], ['ING_RICOTTA', 0.05], ['ING_POIVRE', 0.002], ['ING_MIEL', 0.02], ['ING_OIGNONS', 0.03]],
                },
                {
                    code: 'PIZZA_MARINARA', nom: 'Marinara', prix_vente: 45000,
                    recette: [['ING_COULIS_TOMATE', 0.08], ['ING_CREVETTES', 0.07], ['ING_CALMARS', 0.07], ['ING_ORIGAN', 0.002], ['ING_HUILE_OLIVE', 0.01], ['ING_FROMAGE', 0.05]],
                },
            ];

            // 3. Créer / mettre à jour les ingrédients (table dédiée restaurant_ingredients)
            const ingredientIds = {};
            const ingredientUnits = {};
            let createdIngredients = 0;
            let updatedIngredients = 0;

            for (const ing of ingredients) {
                ingredientUnits[ing.code] = ing.unite;
                const [existing] = await pool.query(
                    'SELECT id FROM restaurant_ingredients WHERE LOWER(TRIM(nom)) = LOWER(TRIM(?)) ORDER BY actif DESC, id LIMIT 1',
                    [ing.nom]
                );

                if (existing.length > 0) {
                    ingredientIds[ing.code] = existing[0].id;
                    await pool.query(
                        'UPDATE restaurant_ingredients SET nom = ?, unite = ?, actif = 1 WHERE id = ?',
                        [ing.nom, ing.unite, existing[0].id]
                    );
                    updatedIngredients++;
                } else {
                    const [result] = await pool.query(
                        'INSERT INTO restaurant_ingredients (nom, unite, prix_achat, actif) VALUES (?, ?, 0, 1)',
                        [ing.nom, ing.unite]
                    );
                    ingredientIds[ing.code] = result.insertId;
                    createdIngredients++;
                }
            }

            console.log(`📦 Ingrédients: ${createdIngredients} créés, ${updatedIngredients} mis à jour`);

            // 4. Stock des ingrédients dans le Restaurant (location_id = 2), démarré à 0.
            // Stock existant : on ne touche pas à la quantité réelle (sinon chaque
            // relance du seed effacerait les entrées et consommations).
            const restaurantLocationId = 2;
            let stockCreated = 0;

            for (const ing of ingredients) {
                const [result] = await pool.query(
                    'INSERT IGNORE INTO restaurant_ingredient_stocks (ingredient_id, location_id, quantite) VALUES (?, ?, 0)',
                    [ingredientIds[ing.code], restaurantLocationId]
                );
                stockCreated += result.affectedRows;
            }

            console.log(`📊 Stock restaurant: ${stockCreated} lignes créées à 0`);

            // 5. Créer / mettre à jour les pizzas et leurs recettes
            let createdPizzas = 0;
            let updatedPizzas = 0;
            let recipeItemsCreated = 0;

            for (const pizza of pizzas) {
                const [existing] = await pool.query('SELECT id FROM products WHERE code = ? LIMIT 1', [pizza.code]);
                let productId;

                if (existing.length > 0) {
                    productId = existing[0].id;
                    await pool.query(
                        `UPDATE products
                         SET nom = ?, category_id = ?, unite = 'PIECE', prix_vente = ?, type_produit = 'PRODUIT_FINI', actif = 1, source_module = 'RESTAURANT'
                         WHERE id = ?`,
                        [pizza.nom, pizzaCategoryId, pizza.prix_vente, productId]
                    );
                    updatedPizzas++;
                } else {
                    const [result] = await pool.query(
                        `INSERT INTO products (category_id, code, nom, unite, prix_achat, prix_vente, actif, type_produit, source_module)
                         VALUES (?, ?, ?, 'PIECE', 0, ?, 1, 'PRODUIT_FINI', 'RESTAURANT')`,
                        [pizzaCategoryId, pizza.code, pizza.nom, pizza.prix_vente]
                    );
                    productId = result.insertId;
                    createdPizzas++;
                }

                const [existingRecipe] = await pool.query('SELECT id FROM recipes WHERE product_id = ?', [productId]);
                let recipeId;

                if (existingRecipe.length > 0) {
                    recipeId = existingRecipe[0].id;
                    await pool.query('DELETE FROM recipe_items WHERE recipe_id = ?', [recipeId]);
                    await pool.query('UPDATE recipes SET nom = ? WHERE id = ?', [`Recette: ${pizza.nom}`, recipeId]);
                } else {
                    const [result] = await pool.query(
                        'INSERT INTO recipes (product_id, nom) VALUES (?, ?)',
                        [productId, `Recette: ${pizza.nom}`]
                    );
                    recipeId = result.insertId;
                }

                for (const [ingredientCode, quantite] of pizza.recette) {
                    await pool.query(
                        'INSERT INTO recipe_items (recipe_id, ingredient_id, quantite, unite) VALUES (?, ?, ?, ?)',
                        [recipeId, ingredientIds[ingredientCode], quantite, ingredientUnits[ingredientCode]]
                    );
                    recipeItemsCreated++;
                }
            }

            console.log(`🍕 Pizzas: ${createdPizzas} créées, ${updatedPizzas} mises à jour`);
            console.log(`📝 Items de recette: ${recipeItemsCreated} créés`);
            console.log('\n✅ Seeder des pizzas du restaurant terminé avec succès !');
        } catch (error) {
            console.error('❌ Erreur lors du seeder des pizzas:', error.message);
            throw error;
        }
    }
}

if (require.main === module) {
    const seeder = new SeedRestaurantPizzas();
    seeder.run()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = SeedRestaurantPizzas;
