// models/clientModel.js
const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const Clients = createCrudModel({
  table: 'clients',
  pk: 'id',
  fields: [
    'code_client', 'nom', 'prenom', 'telephone', 'email', 'adresse',
    'date_naissance', 'type_piece', 'numero_piece', 'photo_url',
    'is_casino_player', 'statut',
  ],
  sortable: ['id', 'nom', 'prenom', 'code_client', 'statut', 'created_at'],
});

const ClientAccounts = createCrudModel({
  table: 'client_accounts',
  pk: 'id',
  fields: ['client_id', 'solde'],
  sortable: ['id', 'client_id', 'solde'],
});

const LoyaltyPoints = createCrudModel({
  table: 'loyalty_points',
  pk: 'id',
  fields: ['client_id', 'points', 'motif', 'created_at'],
  sortable: ['id', 'client_id', 'created_at'],
});

async function findByClientId(id) {
  const [rows] = await pool.query('SELECT * FROM client_accounts WHERE client_id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Recherche multi-critères (nom, prénom, code_client, téléphone, email)
async function search(term, limit = 20) {
  const like = `%${term}%`;
  const [rows] = await pool.query(
    `SELECT * FROM clients
     WHERE nom LIKE ? OR prenom LIKE ? OR code_client LIKE ? OR telephone LIKE ? OR email LIKE ?
     ORDER BY nom ASC LIMIT ?`,
    [like, like, like, like, like, limit]
  );
  return rows;
}

// Crédite/débite le compte client et journalise le point de fidélité si fourni,
// dans une seule transaction (évite les incohérences en cas d'erreur partielle).
async function adjustAccountBalance(clientId, delta, { points, motif } = {}) {
  return withTransaction(async (conn) => {
    const [accRows] = await conn.query('SELECT * FROM client_accounts WHERE client_id = ? FOR UPDATE', [clientId]);
    let account = accRows[0];
    if (!account) {
      const [ins] = await conn.query('INSERT INTO client_accounts (client_id, solde) VALUES (?, 0)', [clientId]);
      account = { id: ins.insertId, client_id: clientId, solde: 0 };
    }
    const newSolde = Number(account.solde) + Number(delta);
    await conn.query('UPDATE client_accounts SET solde = ? WHERE id = ?', [newSolde, account.id]);

    if (points) {
      await conn.query(
        'INSERT INTO loyalty_points (client_id, points, motif, created_at) VALUES (?, ?, ?, NOW())',
        [clientId, points, motif || null]
      );
    }
    const [updated] = await conn.query('SELECT * FROM client_accounts WHERE id = ?', [account.id]);
    return updated[0];
  });
}

module.exports = { Clients, ClientAccounts, LoyaltyPoints, findByClientId, search, adjustAccountBalance };
