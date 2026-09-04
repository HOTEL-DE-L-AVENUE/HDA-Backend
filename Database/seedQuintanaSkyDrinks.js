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
                { nom: 'THB PM 33 cl', ingredients: 'Bière blonde locale 33cl', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 50 },
                { nom: 'THB GM 65 cl', ingredients: 'Bière blonde locale 65cl', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 50 },
                { nom: 'Gold Blanche (PM)', ingredients: 'Bière blanche', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blanche (GM)', ingredients: 'Bière blanche grand format', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blanche 33 cl', ingredients: 'Bière blanche 33cl', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blanche 50 cl', ingredients: 'Bière blanche 50cl', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Normale 50 cl', ingredients: 'Bière blonde 50cl', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blonde (PM)', ingredients: 'Bière blonde', prix: 8000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Gold Blonde (GM)', ingredients: 'Bière blonde grand format', prix: 12000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },
                { nom: 'Beaufort (PM)', ingredients: 'Bière', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'Beaufort (GM)', ingredients: 'Bière grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'Beaufort 33 CL', ingredients: 'Bière 33cl', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'BBA PM', ingredients: 'Bière Beaufort PM', prix: 10000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'BBA GM 100 CL', ingredients: 'Bière Beaufort GM 100cl', prix: 20000, categorie: 'Bières & Softs', alcool: 1, stock: 25 },
                { nom: 'Heineken (PM)', ingredients: 'Bière importée', prix: 16000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: 'Heineken (GM)', ingredients: 'Bière importée grand format', prix: 22000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: 'Heineken 33 CL', ingredients: 'Bière importée 33cl', prix: 16000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: '1664 (bière blonde)', ingredients: 'Bière blonde', prix: 22000, categorie: 'Bières & Softs', alcool: 1, stock: 20 },
                { nom: 'Bière Importée (50cl)', ingredients: 'Bière importée 50cl', prix: 25000, categorie: 'Bières & Softs', alcool: 1, stock: 15 },
                { nom: 'Ranovisy 33 cl', ingredients: 'Boisson locale Ranovisy', prix: 6000, categorie: 'Bières & Softs', alcool: 1, stock: 30 },

                { nom: 'World Cola (PM)', ingredients: 'Boisson gazeuse', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Fanta (PM)', ingredients: 'Boisson gazeuse', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'World Cola (GM)', ingredients: 'Boisson gazeuse grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Fanta (GM)', ingredients: 'Boisson gazeuse grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Coca 30 cl', ingredients: 'Coca-Cola 30cl', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Coca GM 100 CL', ingredients: 'Coca-Cola 100cl', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Youzu (PM)', ingredients: 'Boisson fruitée', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice (PM)', ingredients: 'Boisson fruitée', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice Soda', ingredients: 'Boisson gazeuse fruitée', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice Grenadine', ingredients: 'Boisson fruitée grenadine', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Youzu (GM)', ingredients: 'Boisson fruitée grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Youzou 100cl', ingredients: 'Boisson fruitée 100cl', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Caprice (GM)', ingredients: 'Boisson fruitée grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Bonbon Anglais (PM)', ingredients: 'Sodas', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Bonbon Anglais (GM)', ingredients: 'Sodas grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Schweppes (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster Apple Mix', ingredients: 'Boisson énergisante Apple Mix', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster Tornado', ingredients: 'Boisson énergisante Tornado', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Ice Tea (PM)', ingredients: 'Boisson énergisante / thé glacé', prix: 12000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Schweppes (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Booster (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Ice Tea (GM)', ingredients: 'Grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Redbull', ingredients: 'Boisson énergisante', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'XXL', ingredients: 'Boisson énergisante', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Tonic PM', ingredients: 'Eau tonique', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Tonic GM', ingredients: 'Eau tonique grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive (PM)', ingredients: 'Eau plate 50cl', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive PM 50 cl', ingredients: 'Eau plate 50cl', prix: 6000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive GM 100 CL', ingredients: 'Eau plate 100cl', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Eau Vive (GM)', ingredients: 'Eau tonique grand format', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 30 },
                { nom: 'Cristal (50cl)', ingredients: 'Eau plate 50cl', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 50 },
                { nom: 'Cristal PM 50 CL', ingredients: 'Eau plate 50cl', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 50 },
                { nom: 'Cristal (1.5L)', ingredients: 'Eau plate 1.5L', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 50 },
                { nom: 'Coca Cola (PM)', ingredients: 'Sodas', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Sprite (PM)', ingredients: 'Sodas', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Coca Cola (GM)', ingredients: 'Sodas grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Sprite (GM)', ingredients: 'Sodas grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 40 },
                { nom: 'Jus Naturel (PM)', ingredients: 'Jus de fruit frais', prix: 8000, categorie: 'Bières & Softs', alcool: 0, stock: 25 },
                { nom: 'Jus Naturel (GM)', ingredients: 'Jus de fruit frais grand format', prix: 20000, categorie: 'Bières & Softs', alcool: 0, stock: 25 },
                { nom: 'Sirop de Fraise', ingredients: 'Sirop', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 20 },
                { nom: 'Sirop de Grenadine', ingredients: 'Sirop', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 20 },
                { nom: 'Sirop de Menthe', ingredients: 'Sirop', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 20 },
                { nom: 'Sucre de Canne 1 L', ingredients: 'Sucre de canne liquide', prix: 15000, categorie: 'Bières & Softs', alcool: 0, stock: 20 },

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
                { nom: 'Petit Vin 18,7 CL (Blanc)', ingredients: 'Vin individuel blanc 18.7cl', prix: 10000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Petit Vin 18,7 CL (Rouge)', ingredients: 'Vin individuel rouge 18.7cl', prix: 10000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 30 },
                { nom: 'Cubi Blanc', ingredients: 'Vin en cubi blanc', prix: 90000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 10 },
                { nom: 'Cubi Rouge', ingredients: 'Vin en cubi rouge', prix: 90000, categorie: 'Vin & Alcools Forts', alcool: 1, stock: 10 },

                // =========================================================================
                // VINS - BOUTEILLE (Existant)
                // =========================================================================
                { nom: 'Satyricon', ingredients: 'Vin bouteille', prix: 60000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Cuvee de l\'Aubade (Cote de Provence 2015)', ingredients: 'Vin rosé', prix: 75000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Touraine Pinot Noir', ingredients: 'Vin rouge', prix: 70000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Gabardes (Ch. Auzias 2009)', ingredients: 'Vin rouge', prix: 70000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Les Foncanelles', ingredients: 'Vin', prix: 60000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Moulins de Citran (Haut Medoc 2017)', ingredients: 'Vin rouge haut medoc', prix: 95000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Ch. Letaillanet (Medoc 2012)', ingredients: 'Vin rouge medoc', prix: 90000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'La Vierge Pinot Noir (2011)', ingredients: 'Vin rouge', prix: 85000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Cardinalices (Cote du Rhone 2005)', ingredients: 'Vin cote du rhone', prix: 85000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Lazo Cabernet Sauvignon (2016)', ingredients: 'Vin cabernet sauvignon', prix: 80000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Ch St Clotilde (2010)', ingredients: 'Vin rouge', prix: 80000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Versus Red', ingredients: 'Vin rouge', prix: 75000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Domaine Auzias (2011)', ingredients: 'Vin', prix: 70000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Sunninghill', ingredients: 'Vin', prix: 70000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Lazo Chardonnay', ingredients: 'Vin blanc chardonnay', prix: 80000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Gewueztraminer (Vin d\'Alsace 2016)', ingredients: 'Vin d\'alsace', prix: 95000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Bourgogne (Louis Jadot)', ingredients: 'Vin de bourgogne', prix: 110000, categorie: 'Vins - Bouteille', alcool: 1, stock: 6 },
                { nom: 'Loupiac (Dom. Bois de Roche 2014)', ingredients: 'Vin blanc moelleux', prix: 85000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Rieseling (2016)', ingredients: 'Vin riesling', prix: 85000, categorie: 'Vins - Bouteille', alcool: 1, stock: 8 },
                { nom: 'Croix St Salvy (Gaillac 2017)', ingredients: 'Vin de gaillac', prix: 75000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Protea Rose', ingredients: 'Vin rosé', prix: 80000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },
                { nom: 'Medaillon Rose', ingredients: 'Vin rosé', prix: 75000, categorie: 'Vins - Bouteille', alcool: 1, stock: 10 },

                // =========================================================================
                // NOUVEAUX VINS : VINS ROUGES
                // =========================================================================
                { nom: 'Vin de France', ingredients: 'Vieux Papes', prix: 70000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Vallée de la Loire, Saumur-Champigny', ingredients: 'Maison Plessis-Duval', prix: 170000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Alsace Pinot Noir', ingredients: 'Maison DRESCHLER, Pinot Noir', prix: 180000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Languedoc-Roussillon, IGP Pays d\'Hérault', ingredients: 'SAS Moulin de Gassac, Grenache-Syrah', prix: 130000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Cercle des Epicuriens', prix: 70000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Baron de Lestac', prix: 120000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Maison CASTEL, Bordeaux Merlot', prix: 130000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux Supérieur', ingredients: 'Chateau du Lort', prix: 150000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Médoc', ingredients: 'Maison CASTEL, Médoc', prix: 150000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Cru de la Maqueline', prix: 160000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Saint-Emilion', ingredients: 'Maison CASTEL, Saint-Emilion', prix: 170000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, 1ères Cotes de Bordeaux', ingredients: 'Chateau Campet', prix: 210000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'France, Médoc', ingredients: 'Château Tartuguière', prix: 200000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Côtes de Bourg', ingredients: 'Chateau du Bousquet', prix: 240000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Clarence Dillon Wines SAS, Clarendelle', prix: 280000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Haut-Médoc', ingredients: 'Chateau d\'Arcins', prix: 310000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Graves', ingredients: 'Château FERRANDE', prix: 400000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Médoc', ingredients: 'Clarence Dillon Wines SAS, Clarendelle', prix: 360000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Haut-Médoc', ingredients: 'Chateau Peyrat-Fourthon', prix: 370000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Médoc', ingredients: 'Tour Prignac, Grande Réserve', prix: 450000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Saint-Emilion Grand Cru', ingredients: 'Chateau La Croix Montlabert, Saint Emilion Grand Cru', prix: 460000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Saint-Emilion Grand Cru', ingredients: 'Chateau Montlabert, Saint Emilion Grand Cru', prix: 620000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Vallée du Rhône, AOP Côtes du Rhône', ingredients: 'Maison JEANTET, Côtes du Rhône', prix: 110000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Vallée du Rhône, AOP Côtes du Rhône', ingredients: 'Maison CASTEL, Syrah-Grenache', prix: 120000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Vallée du Rhône, AOP Chateauneuf du Pape', ingredients: 'Maison JEANTET, Châteauneuf du Pape', prix: 600000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Vallée du Rhône, AOP Chateauneuf du Pape', ingredients: 'Maison CASTEL, Châteauneuf du Pape', prix: 630000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Provence, Bandol', ingredients: 'Château Canadel', prix: 440000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Espagne, Rioja', ingredients: 'Domaine Igay, Marques de Murrieta', prix: 300000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Haut-Médoc', ingredients: 'Chateau d\'Arcins (Magnum)', prix: 670000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Marianne Craft Wines, Natana Red Blend', ingredients: 'Natana Red Blend', prix: 100000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Ken Forrester Wines, Petit Cabernet-Sauvignon', ingredients: 'Petit Cabernet-Sauvignon', prix: 150000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Kanonkop Estate, Kadette Cape Blend', ingredients: 'Kadette Cape Blend', prix: 160000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Kanonkop Estate, Kadette Pinotage', ingredients: 'Kadette Pinotage', prix: 180000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'A.A. Badenhorst, Secateurs Shiraz Blend', ingredients: 'Secateurs Shiraz Blend', prix: 190000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'Mullineux Wines, Kloof Street', ingredients: 'Kloof Street', prix: 200000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'La Vierge Collection, Nymphomane', ingredients: 'Nymphomane', prix: 270000, categorie: 'Vins rouges', alcool: 1, stock: 10 },
                { nom: 'La Vierge Collection, Pinot Noir', ingredients: 'Pinot Noir', prix: 430000, categorie: 'Vins rouges', alcool: 1, stock: 10 },

                // =========================================================================
                // NOUVEAUX VINS : VINS BLANCS
                // =========================================================================
                { nom: 'Vin de France', ingredients: 'Vieux Papes Chardonnay-Colombard', prix: 80000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Vin de France', ingredients: 'Maison CASTEL, Chardonnay', prix: 100000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Vallée de la Loire, Muscadet Sèvre-et-Maine', ingredients: 'Maison CASTEL', prix: 130000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Vallée de la Loire, Touraine', ingredients: 'Maison Plessis-Duval', prix: 140000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Maison CASTEL, Bordeaux Sauvignon Blanc', prix: 150000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Bordeaux, Bordeaux', ingredients: 'Clarence Dillon Wines SAS, Clarendelle', prix: 290000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Sud-Ouest, IGP Côtes de Gascogne', ingredients: 'Maison CASTEL Sauvignon Blanc', prix: 110000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Languedoc-Roussillon, IGP Pays d\'Oc', ingredients: 'La Roche Mazet, Chardonnay Blanc', prix: 100000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Languedoc-Roussillon, IGP Pays d\'Hérault', ingredients: 'SAS Moulin de Gassac, Grenache Blanc-Colombard-Rolle', prix: 130000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Languedoc-Roussillon, IGP Pays d\'Oc', ingredients: 'Maison CASTEL, Muscat Semi-Sweet', prix: 140000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Bourgogne, Chablis', ingredients: 'Maison CASTEL', prix: 440000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Alsace Riesling', ingredients: 'Maison DRESCHLER, Riesling', prix: 180000, categorie: 'Vins blancs', alcool: 1, stock: 10 },
                { nom: 'Alsace Gewurztraminer', ingredients: 'Maison DRESCHLER, Gewurztraminer', prix: 220000, categorie: 'Vins blancs', alcool: 1, stock: 10 },

                // =========================================================================
                // NOUVEAUX VINS : VINS ROSES
                // =========================================================================
                { nom: 'Vallée de la Loire, AOP Cabernet d\'Anjou', ingredients: 'Maison Plessis-Duval', prix: 130000, categorie: 'Vins roses', alcool: 1, stock: 10 },
                { nom: 'Côtes de Provence, AOP Côtes de Provence', ingredients: 'Maison CASTEL', prix: 180000, categorie: 'Vins roses', alcool: 1, stock: 10 },
                { nom: 'Côtes de Provence, AOP Côtes de Provence', ingredients: 'Maison CAVALIER, Marafiance', prix: 310000, categorie: 'Vins roses', alcool: 1, stock: 10 },
                { nom: 'Languedoc-Roussillon, IGP Pays d\'Hérault', ingredients: 'SAS Moulin de Gassac, Grenache-Carignan-Cinsault', prix: 130000, categorie: 'Vins roses', alcool: 1, stock: 10 },

                // =========================================================================
                // NOUVEAUX VINS : VINS EFFERVESCENTS
                // =========================================================================
                { nom: 'Languedoc-Roussillon, Vin Pétillant', ingredients: 'SAS Moulin de Gassac, Folie by Gassac', prix: 210000, categorie: 'Vins effervescents', alcool: 1, stock: 10 },
                { nom: 'Vin de France, Mousseux 1/2 Sec', ingredients: 'Maison CASTEL, ICE Blanc', prix: 200000, categorie: 'Vins effervescents', alcool: 1, stock: 10 },
                { nom: 'Vin de France, Mousseux 1/2 Sec', ingredients: 'Maison CASTEL, ICE Rosé', prix: 190000, categorie: 'Vins effervescents', alcool: 1, stock: 10 },

                // =========================================================================
                // NOUVEAUX VINS : BAGS IN BOX
                // =========================================================================
                { nom: 'Afrique du Sud', ingredients: 'L\'Incontournable Blanc (Format 5L)', prix: 170000, categorie: 'Bags in Box', alcool: 1, stock: 5 },
                { nom: 'Afrique du Sud', ingredients: 'L\'Incontournable Rouge (Format 5L)', prix: 190000, categorie: 'Bags in Box', alcool: 1, stock: 5 },
                // =========================================================================
                // CHAMPAGNE / VIN MOUSSEUX
                // =========================================================================
                { nom: 'Cuvee Brut (Laurent Perrier)', ingredients: 'Champagne brut', prix: 350000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 5 },
                { nom: 'Delahaie', ingredients: 'Champagne', prix: 280000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 6 },
                { nom: 'Lanson Brut', ingredients: 'Champagne lanson brut', prix: 320000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 5 },
                { nom: 'Chapagne TD', ingredients: 'Champagne', prix: 250000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 6 },
                { nom: 'Rose Berteletti', ingredients: 'Vin mousseux rosé', prix: 90000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 10 },
                { nom: 'Les Dieux Chardonai', ingredients: 'Vin mousseux chardonnay', prix: 85000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 10 },
                { nom: 'Maguis Robitailles', ingredients: 'Vin mousseux', prix: 85000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 10 },
                { nom: 'Platinium Label', ingredients: 'Vin mousseux scintillant', prix: 100000, categorie: 'Champagne / Vin Mousseux', alcool: 1, stock: 10 },

                // =========================================================================
                // COCKTAILS
                // =========================================================================
                { nom: 'Spritz Aperol', ingredients: 'Cocktail pétillant', prix: 30000, categorie: 'Cocktails', alcool: 1, stock: 40 },
                { nom: 'Spritz Campari', ingredients: 'Cocktail pétillant', prix: 30000, categorie: 'Cocktails', alcool: 1, stock: 40 },
                { nom: 'Spritz Bucks Fizz', ingredients: 'Cocktail pétillant', prix: 30000, categorie: 'Cocktails', alcool: 1, stock: 40 },
                { nom: 'Spritz Limoncello', ingredients: 'Cocktail pétillant', prix: 30000, categorie: 'Cocktails', alcool: 1, stock: 40 },
                { nom: 'Margarita', ingredients: 'Cocktail standard avec alcool', prix: 20000, categorie: 'Cocktails', alcool: 1, stock: 50 },
                { nom: 'Mojito', ingredients: 'Cocktail standard avec alcool', prix: 20000, categorie: 'Cocktails', alcool: 1, stock: 50 },
                { nom: 'Piña Colada', ingredients: 'Cocktail standard avec alcool', prix: 20000, categorie: 'Cocktails', alcool: 1, stock: 50 },
                { nom: 'Pink Panther', ingredients: 'Mocktail sans alcool', prix: 15000, categorie: 'Cocktails', alcool: 0, stock: 50 },
                { nom: 'Bora Bora', ingredients: 'Mocktail sans alcool', prix: 15000, categorie: 'Cocktails', alcool: 0, stock: 50 },
                { nom: 'Mojito Sans Alcool', ingredients: 'Mocktail sans alcool', prix: 15000, categorie: 'Cocktails', alcool: 0, stock: 50 },

                // =========================================================================
                // RHUM - TEQUILA - VODKA (Bouteilles)
                // =========================================================================
                { nom: 'Tequila Victoria', ingredients: 'Tequila', prix: 90000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Vodka Locale', ingredients: 'Vodka', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Vodka Priskaia', ingredients: 'Vodka', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Casanove', ingredients: 'Alcool fort', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Cazanove 1 L', ingredients: 'Alcool fort 1L', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Mangustan', ingredients: 'Alcool fort', prix: 100000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Tequila Municion 70 CL', ingredients: 'Tequila 70cl', prix: 300000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 8 },
                { nom: 'Cuvee Blanche Dzama', ingredients: 'Rhum blanc Dzama', prix: 120000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Dzama Cuvee Prestige', ingredients: 'Rhum ambré Prestige', prix: 150000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
                { nom: 'Dzama Cuvee Noir', ingredients: 'Rhum noir Dzama', prix: 140000, categorie: 'Rhum, Tequila & Vodka', alcool: 1, stock: 10 },
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
                { nom: 'Bayleys', ingredients: 'Liqueur de crème', prix: 400000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Jagermeister', ingredients: 'Liqueur aux herbes', prix: 550000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Absolut Vodka Bleu', ingredients: 'Vodka Absolut Bleue', prix: 400000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Absolut Vodka Citron', ingredients: 'Vodka Absolut Citron', prix: 400000, categorie: 'Spiritueux', alcool: 1, stock: 10 },
                { nom: 'Luxardo Bitter', ingredients: 'Bitter Luxardo', prix: 350000, categorie: 'Spiritueux', alcool: 1, stock: 8 },
                { nom: 'Ciroc', ingredients: 'Vodka Ciroc', prix: 550000, categorie: 'Spiritueux', alcool: 1, stock: 8 },
                { nom: 'Drambuie', ingredients: 'Liqueur Drambuie', prix: 450000, categorie: 'Spiritueux', alcool: 1, stock: 8 },

                // =========================================================================
                // WHISKY
                // =========================================================================
                { nom: 'John Peters (70cl)', ingredients: 'Whisky 70cl', prix: 160000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Clan Campbell', ingredients: 'Whisky écossais', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Clan Campblee', ingredients: 'Whisky écossais', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'J&B (70cl)', ingredients: 'Whisky 70cl', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'JB 70 CL', ingredients: 'Whisky 70cl', prix: 300000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'J&B (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'JB 1L', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Grants (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Red Label', ingredients: 'Whisky Red Label', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Red Label (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 12 },
                { nom: 'Ballantine\'s (1L)', ingredients: 'Whisky 1L', prix: 400000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Black Label', ingredients: 'Whisky Black Label', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Black Label (1L)', ingredients: 'Whisky 1L', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Jack Daniel\'s (1L)', ingredients: 'Whisky Tennessee 1L', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Jack Daniels', ingredients: 'Whisky Tennessee', prix: 580000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Chivas Regal (1L)', ingredients: 'Whisky 1L', prix: 630000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Chivas 70 CL', ingredients: 'Whisky 70cl', prix: 550000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Chivas 1 L', ingredients: 'Whisky 1L', prix: 630000, categorie: 'Whisky', alcool: 1, stock: 10 },
                { nom: 'Double Black', ingredients: 'Whisky premium', prix: 680000, categorie: 'Whisky', alcool: 1, stock: 8 },
                { nom: 'Gold Label (1L)', ingredients: 'Whisky de luxe 1L', prix: 850000, categorie: 'Whisky', alcool: 1, stock: 6 },
                { nom: 'Gold Label', ingredients: 'Whisky de luxe', prix: 850000, categorie: 'Whisky', alcool: 1, stock: 6 },
                { nom: 'Platinium', ingredients: 'Whisky platinium', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Fuji', ingredients: 'Whisky japonais', prix: 950000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Toki', ingredients: 'Whisky japonais', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Yoshi', ingredients: 'Whisky japonais', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Platinum (1L)', ingredients: 'Whisky 1L', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },
                { nom: 'Nikka', ingredients: 'Whisky japonais', prix: 1200000, categorie: 'Whisky', alcool: 1, stock: 5 },

                // =========================================================================
                // GIN
                // =========================================================================
                { nom: 'Gordon\'s', ingredients: 'Gin', prix: 400000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Gordons', ingredients: 'Gin', prix: 400000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Gin Gordon\'s', ingredients: 'Gin Gordon\'s', prix: 400000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Bombay', ingredients: 'Gin premium', prix: 530000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Sapphire', ingredients: 'Gin Bombay Sapphire', prix: 530000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Bombay Saphir', ingredients: 'Gin Bombay Sapphire', prix: 530000, categorie: 'Gin', alcool: 1, stock: 10 },
                { nom: 'Tanqueray', ingredients: 'Gin Tanqueray', prix: 480000, categorie: 'Gin', alcool: 1, stock: 10 },

                // =========================================================================
                // SHOOTERS
                // =========================================================================
                { nom: 'Desire', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Kamikaze', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Lemon Drop', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Monkey Brain', ingredients: 'Shot', prix: 15000, categorie: 'Shooters', alcool: 1, stock: 30 },
                { nom: 'Vodka Rainbow', ingredients: 'Shot multicolore', prix: 25000, categorie: 'Shooters', alcool: 1, stock: 20 },
                { nom: 'Tequila Slammer\'s', ingredients: 'Shot tequila', prix: 25000, categorie: 'Shooters', alcool: 1, stock: 20 },

                // =========================================================================
                // CONSIGNES & DIVERS (Accessoires, Shisha, Bouteilles vides, Cageots)
                // =========================================================================
                { nom: 'Avoirs Bouteille Vide 30/33cl', ingredients: 'Consigne bouteille vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 100 },
                { nom: 'Avoirs Bouteille Vide 50/65cl', ingredients: 'Consigne bouteille vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 100 },
                { nom: 'Avoirs Bouteille Vide 100cl', ingredients: 'Consigne bouteille vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 100 },
                { nom: 'Avoirs Bouteille Sodeam 100cl', ingredients: 'Consigne bouteille sodeam', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 50 },
                { nom: 'Avoirs Bouteille Ranovisy', ingredients: 'Consigne bouteille ranovisy', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 50 },
                { nom: 'Cageot de 12', ingredients: 'Cageot vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 20 },
                { nom: 'Cageot de 20', ingredients: 'Cageot vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 20 },
                { nom: 'Cageot de 24', ingredients: 'Cageot vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 20 },
                { nom: 'Cageot Ranovisy', ingredients: 'Cageot ranovisy vide', prix: 0, categorie: 'Consignes & Divers', alcool: 0, stock: 20 },
                { nom: 'Parfum Shisha', ingredients: 'Parfum pour chisha', prix: 20000, categorie: 'Consignes & Divers', alcool: 0, stock: 15 },
                { nom: 'Charbon Shisha', ingredients: 'Charbon pour chisha', prix: 10000, categorie: 'Consignes & Divers', alcool: 0, stock: 30 }
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
            console.log(`   ✅ ${insertedCount} nouvelle(s) boisson(s) / article(s) inséré(s) dans bar_products`);
            console.log(`   📋 Total traité : ${items.length} articles`);
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