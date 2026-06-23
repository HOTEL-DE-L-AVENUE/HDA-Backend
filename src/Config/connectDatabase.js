const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const db = pool.promise();

const connectDatabase = async () => {
    try {
        const [result] = await db.query('SELECT 1');

        console.log('✅ Base de données connectée');
        console.log(`📂 Database : ${process.env.DB_NAME}`);

        return {
            status: 'success',
            message: 'Connexion MySQL établie',
            database: process.env.DB_NAME
        };
    } catch (error) {
        console.error('❌ Erreur de connexion MySQL :', error.message);
        process.exit(1);
    }
};

module.exports = {
    connectDatabase,
    db
};