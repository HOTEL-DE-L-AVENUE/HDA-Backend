// src/Database/seed.js
const SeedUser = require('./seedUser');
const SeedCategory = require('./seedCategory');
const SeedStockLocation = require('./seedStockLocation');
const SeedUnit = require('./seedUnit');
const SeedProductType = require('./seedProductType');

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

    const seedProductType = new SeedProductType();
    await seedProductType.run();

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