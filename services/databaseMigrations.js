const { pool } = require('../config/db');
const stockModel = require('../models/stockModel');

// Add only reviewed, additive migrations here. Historical SQL scripts are not
// replayed automatically because some contain data rewrites or destructive SQL.
const migrations = [
  {
    id: '20261123_stock_movement_schema_compat',
    up: async () => {
      await stockModel.ensureStockMovementsSchema();
      await stockModel.ensureBarStockMovementsSchema();
    },
  },
  {
    id: '20261126_order_creator_tracking',
    up: async () => {
      const [restaurantColumns] = await pool.query('SHOW COLUMNS FROM orders');
      if (!restaurantColumns.some((column) => column.Field === 'created_by')) {
        await pool.query('ALTER TABLE orders ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER montant_total');
        await pool.query('ALTER TABLE orders ADD KEY idx_orders_created_by (created_by)');
      }
      if (!restaurantColumns.some((column) => column.Field === 'moyen_paiement_prevu')) {
        await pool.query('ALTER TABLE orders ADD COLUMN moyen_paiement_prevu VARCHAR(30) NULL AFTER montant_total');
      }

      const [barTables] = await pool.query("SHOW TABLES LIKE 'bar_orders'");
      if (barTables.length) {
        const [barColumns] = await pool.query('SHOW COLUMNS FROM bar_orders');
        if (!barColumns.some((column) => column.Field === 'created_by')) {
          await pool.query('ALTER TABLE bar_orders ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER montant_total');
          await pool.query('ALTER TABLE bar_orders ADD KEY idx_bar_orders_created_by (created_by)');
        }
      }
    },
  },
];

async function runDatabaseMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(190) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[lock]] = await pool.query("SELECT GET_LOCK('hda:database-migrations', 30) AS acquired");
  if (Number(lock?.acquired) !== 1) throw new Error('Impossible d’obtenir le verrou des migrations de base de données.');

  try {
    for (const migration of migrations) {
      const [[applied]] = await pool.query('SELECT id FROM schema_migrations WHERE id = ? LIMIT 1', [migration.id]);
      if (applied) continue;

      console.log(`[migrations] Application de ${migration.id}`);
      await migration.up();
      await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
      console.log(`[migrations] ${migration.id} appliquée`);
    }
  } finally {
    await pool.query("SELECT RELEASE_LOCK('hda:database-migrations')");
  }
}

module.exports = { runDatabaseMigrations };
