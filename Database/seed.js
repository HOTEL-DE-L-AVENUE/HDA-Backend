// Database/seed.js
const SeedUser = require('./seedUser');
const SeedCategory = require('./SeedCategories');
const SeedStockLocation = require('./seedStockLocation');
const SeedUnit = require('./seedUnit');
const SeedProductType = require('./seedProductType');
const SeedProducts = require('./seedProducts');
const SeedBarProducts = require('./SeedBarProducts'); // <-- AJOUTÉ
const { seedBillardExtras } = require('./seedBillardExtras');
const { seedBottleExtras } = require('./seedBottleExtras');

/**
 * Script principal pour exécuter tous les seeders
 */
async function runAllSeeders() {
  console.log('🌱 Démarrage des seeders...\n');

  try {
    // 1. Seeder des utilisateurs
    const seedUser = new SeedUser();
    await seedUser.run();

    // 2. Seeder des catégories
    const seedCategory = new SeedCategory();
    await seedCategory.run();

    // 3. Seeder des emplacements de stock
    const seedStockLocation = new SeedStockLocation();
    await seedStockLocation.run();

    // 4. Seeder des unités
    const seedUnit = new SeedUnit();
    await seedUnit.run();

    // 5. Seeder des types de produits
    const seedProductType = new SeedProductType();
    await seedProductType.run();

    // 6. Seeder des produits génériques
    const seedProducts = new SeedProducts();
    await seedProducts.run();

    // 7. Seeder des produits spécifiques au Bar (BOISSONS) <-- AJOUTÉ
    const seedBarProducts = new SeedBarProducts();
    await seedBarProducts.run();

    // 8. Seeder des extras Billard (30 min)
    await seedBillardExtras();

    // 9. Seeder des extras Bouteille (verre cassé, consignation)
    await seedBottleExtras();

    console.log('\n🎉 Tous les seeders ont été exécutés avec succès !');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution des seeders:', error.message);
    process.exit(1);
  }
}

// Exécuter si le fichier est appelé directement
if (require.main === module) {
  runAllSeeders();
}

module.exports = { runAllSeeders }; 