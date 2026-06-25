const mysql = require('mysql2/promise');

let pool = null;

const connectDatabase = async () => {
  try {
    console.log('📡 Tentative de connexion à la base de données...');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.DB_NAME || 'hda'}`);
    console.log(`   User: ${process.env.DB_USER || 'root'}`);

    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hda',
      port: parseInt(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });

    // Tester la connexion
    const connection = await pool.getConnection();
    console.log('✅ Connexion à la base de données établie avec succès');
    connection.release();

    return pool;
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    throw error;
  }
};

// Fonction pour obtenir le pool - CORRECTEMENT EXPORTÉE
function getPool() {
  if (!pool) {
    throw new Error('La base de données n\'est pas connectée. Appelez connectDatabase() d\'abord.');
  }
  return pool;
}

// Fonction pour fermer la connexion
const closeDatabase = async () => {
  if (pool) {
    await pool.end();
    console.log('✅ Connexion à la base de données fermée');
    pool = null;
  }
};

// Exporter correctement avec module.exports
module.exports = {
  connectDatabase,
  getPool,
  closeDatabase
};