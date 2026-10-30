// Database/applyStockMigration.js
// Applique la migration additive du module de stock (idempotente).
// Exécution : node Database/applyStockMigration.js
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Découpe un script SQL en respectant les directives DELIMITER (procédures).
function splitStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = '';

  const flush = () => {
    const statement = buffer.trim();
    buffer = '';
    if (!statement) return;
    // Ignore les blocs qui ne contiennent que des commentaires.
    const meaningful = statement
      .split(/\r?\n/)
      .filter((line) => !/^\s*--/.test(line))
      .join('')
      .trim();
    if (!meaningful) return;
    statements.push(statement);
  };

  for (const line of sql.split(/\r?\n/)) {
    const delimiterMatch = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }
    buffer += `${line}\n`;
    if (buffer.trimEnd().endsWith(delimiter)) {
      buffer = buffer.trimEnd().slice(0, -delimiter.length);
      flush();
    }
  }
  flush();
  return statements;
}

async function main() {
  const file = path.join(__dirname, 'migrations', '20261024_stock_module_completion.sql');
  const raw = fs.readFileSync(file, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hda',
    multipleStatements: false,
  });

  try {
    await connection.query('SET time_zone = ?', ['+03:00']);
    const statements = splitStatements(raw);
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log(`[migration] Module stock : ${statements.length} instructions appliquées avec succès.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error('[migration] Échec :', err.message);
  process.exit(1);
});
