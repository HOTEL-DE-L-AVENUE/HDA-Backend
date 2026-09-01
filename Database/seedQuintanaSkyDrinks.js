// Database/seedQuintanaSkyDrinks.js
const { pool } = require('../config/db');

class SeedQuintanaSkyDrinks {
    async run() {
        try {
            console.log('🚀 Début du seeder des boissons Quintana Sky pour le Bar...');

            // Liste complète des boissons avec leurs catégories textuelles, prix, alcool et stock initial
            const items = [
                // =========================================================================
                // BIERES & SOFTS
                // =========================================================================
                { nom: 'THB (PM)', ingredients: 'Bière blonde locale', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 50 },
                { nom: 'THB (GM)', ingredients: 'Bière blonde locale grand format', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 50 },
                { nom: 'Gold Blanche (PM)', ingredients: 'Bière blanche', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blanche (GM)', ingredients: 'Bière blanche grand format', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blonde (PM)', ingredients: 'Bière blonde', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blonde (GM)', ingredients: 'Bière blonde grand format', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Beaufort (PM)', ingredients: 'Bière', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'Beaufort (GM)', ingredients: 'Bière grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'Heineken (PM)', ingredients: 'Bière importée', prix: 16000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: 'Heineken (GM)', ingredients: 'Bière importée grand format', prix: 22000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: '1664 (bière blonde)', ingredients: 'Bière blonde', prix: 22000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: 'Bière Importée (50cl)', ingredients: 'Bière importée 50cl', prix: 25000, categorie: 'Bières & Softs', alcool: 1, stock: 15 },

                { nom: 'World Cola (PM)', ingredients: 'Boisson gazeuse', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Fanta (PM)', ingredients: 'Boisson gazeuse', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'World Cola (GM)', ingredients: 'Boisson gazeuse grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Fanta (GM)', ingredients: 'Boisson gazeuse grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Youzu (PM)', ingredients: 'Boisson fruitée', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice (PM)', ingredients: 'Boisson fruitée', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Youzu (GM)', ingredients: 'Boisson fruitée grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice (GM)', ingredients: 'Boisson fruitée grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Bonbon Anglais (PM)', ingredients: 'Sodas', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Bonbon Anglais (GM)', ingredients: 'Sodas grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Schweppes (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Ice Tea (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Schweppes (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Ice Tea (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Tonic (PM)', ingredients: 'Eau tonique', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive (PM)', ingredients: 'Eau tonique', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Tonic (GM)', ingredients: 'Eau tonique grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive (GM)', ingredients: 'Eau tonique grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Cristal (50cl)', ingredients: 'Eau plate 50cl', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 50 },
                { nom: 'Cristal (1.5L)', ingredients: 'Eau plate 1.5L', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 50 },
                { nom: 'Coca Cola (PM)', ingredients: 'Sodas', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Sprite (PM)', ingredients: 'Sodas', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Coca Cola (GM)', ingredients: 'Sodas grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Sprite (GM)', ingredients: 'Sodas grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Jus Naturel (PM)', ingredients: 'Jus de fruit frais', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 25 },
                { nom: 'Jus Naturel (GM)', ingredients: 'Jus de fruit frais grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 25 },

                // =========================================================================
                // VIN / ALCOOLS FORTS (Vente au verre / cl)
                // =========================================================================
                { nom: 'Rhum Arrangé (10cl)', ingredients: 'Rhum macéré', prix: 15000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Vin (10cl)', ingredients: 'Alcool / Apéritif', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Campari (10cl)', ingredients: 'Alcool / Apéritif', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Aperol (10cl)', ingredients: 'Alcool / Apéritif', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Martini Rouge (5cl)', ingredients: 'Vermouth', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Martini Blanc (5cl)', ingredients: 'Vermouth', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Pastis (5cl)', ingredients: 'Alcool fort', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Gin (5cl)', ingredients: 'Alcool fort', prix: 20000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'J&B (5cl)', ingredients: 'Whisky / Liqueur', prix: 25000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Red Label (5cl)', ingredients: 'Whisky / Liqueur', prix: 25000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Bailey\'s (5cl)', ingredients: 'Whisky / Liqueur', prix: 25000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Black Label (5cl)', ingredients: 'Whisky supérieur', prix: 35000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Jack Daniel\'s (5cl)', ingredients: 'Whisky supérieur', prix: 35000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Chivas (5cl)', ingredients: 'Whisky supérieur', prix: 35000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Dewar\'s (5cl)', ingredients: 'Whisky supérieur', prix: 35000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Double Black (5cl)', ingredients: 'Whisky', prix: 45000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 20 },
                { nom: 'Gold Label (5cl)', ingredients: 'Whisky de prestige', prix: 50000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 20 },
                { nom: 'Platinum (5cl)', ingredients: 'Whisky rare', prix: 65000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 15 },
                { nom: 'Macallan (5cl)', ingredients: 'Whisky rare', prix: 65000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 15 },

                // =========================================================================
                // COCKTAILS
                // =========================================================================
                { nom: 'Spritz (Aperol/Campari, Bucks Fizz, Limoncello)', ingredients: 'Cocktail pétillant', prix: 30000, categorie: 'Cocktails', alcool: 1, stock: 40 },
                { nom: 'Cocktail Avec Alcool (Margarita, Mojito, Piña Colada...)', ingredients: 'Cocktail standard', prix: 20000, categorie: 'Cocktails', alcool: 1, stock: 50 },
                { nom: 'Cocktail Sans Alcool (Pink Panther, Bora Bora, Mojito...)', ingredients: 'Mocktail', prix: 15000, categorie: 'Cocktails', alcool: 0, stock: 50 },

                // =========================================================================
                // RHUM - TEQUILA - VODKA (Bouteilles)
                // =========================================================================
                { nom: 'Tequila Victoria', ingredients: 'Tequila', prix: 90000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Vodka Locale', ingredients: 'Vodka', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Casanove', ingredients: 'Alcool fort', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Rhum Arrangé', ingredients: 'Bouteille de rhum arrangé', prix: 120000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 15 },
                { nom: 'Don Pedro', ingredients: 'Alcool fort', prix: 120000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Vodka Zubrowka', ingredients: 'Vodka polonaise', prix: 300000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 8 },
                { nom: 'Vodka Absolut', ingredients: 'Vodka premium', prix: 400000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 8 },

                // =========================================================================
                // SPIRITUEUX
                // =========================================================================
                { nom: 'Martini Rouge', ingredients: 'Bouteille vermouth', prix: 375000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Martini Blanc', ingredients: 'Bouteille vermouth', prix: 375000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Bailey\'s', ingredients: 'Liqueur de crème', prix: 400000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Jagermeister', ingredients: 'Liqueur aux herbes', prix: 550000, categorie: 'Spiritueux', alcool: 1, stock: 10 },

                // =========================================================================
                // WHISKY
                // =========================================================================
                { nom: 'John Peters (70cl)', ingredients: 'Whisky 70cl', prix: 160000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Clan Campbell', ingredients: 'Whisky écossais', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'J&B (70cl)', ingredients: 'Whisky 70cl', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'J&B (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Grants (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Red Label (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Ballantine\'s (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Black Label (1L)', ingredients: 'Whisky 1L', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Jack Daniel\'s (1L)', ingredients: 'Whisky Tennessee 1L', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Chivas Regal (1L)', ingredients: 'Whisky 1L', prix: 630000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Double Black', ingredients: 'Whisky premium', prix: 680000, categorie: 'Whisky', alcool: 1, stock: 8 },
                { nom: 'Gold Label (1L)', ingredients: 'Whisky de luxe 1L', prix: 850000, categorie: 'Whisky', alcool: 1, stock: 6 },
                { nom: 'Fuji', ingredients: 'Whisky japonais', prix: 950000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Toki, Yoshi', ingredients: 'Whisky japonais', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Platinum (1L)', ingredients: 'Whisky 1L', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Nikka', ingredients: 'Whisky japonais', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },

                // =========================================================================
                // GIN
                // =========================================================================
                { nom: 'Gordon\'s', ingredients: 'Gin', prix: 400000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Bombay', ingredients: 'Gin premium', prix: 530000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Sapphire', ingredients: 'Gin Bombay Sapphire', prix: 530000, categorie: 'Gin', alcool: 1, stock: 10 },

                // =========================================================================
                // SHOOTERS
                // =========================================================================
                { nom: 'Desire', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Kamikaze', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Lemon Drop', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Monkey Brain', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Vodka Rainbow', ingredients: 'Shot multicolore', prix: 25000, categorie: 'Shooters', alcool: 1, stock: 20 },
                { nom: 'Tequila Slammer\'s', ingredients: 'Shot tequila', prix: 25000, categorie: 'Shooters', alcool: 1, stock: 20 }
            ];

            let insertedCount = 0;

            for (const item of items) {
                // Vérifier si le produit existe déjà dans bar_products
                const [existing] = await pool.query(
                    'SELECT id FROM bar_products WHERE nom = ?',
                    [item.nom]
                );

                let productId;

                if (existing.length > 0) {
                    productId = existing[0].id;
                    // Mettre à jour le produit existant
                    await pool.query(
                        `UPDATE bar_products 
                         SET ingredients = ?, prix = ?, categorie = ?, alcool = ?, type_produit = 'PRODUIT_FINI', source_module = 'BAR'
                         WHERE id = ?`,
                        [item.ingredients, item.prix, item.categorie, item.alcool, productId]
                    );
                } else {
                    // Insérer le nouveau produit
                    const [result] = await pool.query(
                        `INSERT INTO bar_products (nom, ingredients, prix, categorie, alcool, type_produit, source_module) 
                         VALUES (?, ?, ?, ?, ?, 'PRODUIT_FINI', 'BAR')`,
                        [item.nom, item.ingredients, item.prix, item.categorie, item.alcool]
                    );
                    productId = result.insertId;
                    insertedCount++;
                }

                // Gérer le stock dans bar_stock
                const [stockCheck] = await pool.query(
                    'SELECT id FROM bar_stock WHERE product_id = ?',
                    [productId]
                );

                if (stockCheck.length === 0) {
                    await pool.query(
                        'INSERT INTO bar_stock (product_id, quantite) VALUES (?, ?)',
                        [productId, item.stock]
                    );
                }
            }

            console.log(`\n📊 Résumé du seeder Bar Quintana Sky :`);
            console.log(`   ✅ ${insertedCount} nouvelle(s) boisson(s) insérée(s) dans bar_products`);
            console.log(`   📋 Total traité : ${items.length} boissons`);
            console.log('✅ Seeder des boissons du bar terminé avec succès !\n');

        } catch (error) {
            console.error('❌ Erreur lors du seeder des boissons du bar :', error.message);
            throw error;
        }
    }
}

if (require.main === module) {
    const seeder = new SeedQuintanaSkyDrinks();
    seeder.run()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Erreur fatale:', error);
            process.exit(1);
        });
}

module.exports = SeedQuintanaSkyDrinks;