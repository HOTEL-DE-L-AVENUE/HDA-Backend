// src/Database/seed.js
const SeedUser = require('./seedUser');

/**
 * Script principal pour exécuter tous les seeders
 */
async function runAllSeeders() {
  console.log('🌱 Démarrage des seeders...\n');

  try {
    // Exécuter le seeder des utilisateurs
    const seedUser = new SeedUser();
    await seedUser.run();

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