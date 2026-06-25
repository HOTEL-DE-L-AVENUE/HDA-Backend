const { pool } = require('../Config/connectDatabase');

class Client {

  // Récupérer tous les clients
  static async findAll(filters = {}) {
    let query = 'SELECT * FROM clients WHERE 1=1';
    const values = [];

    if (filters.nom) {
      query += ' AND nom LIKE ?';
      values.push(`%${filters.nom}%`);
    }

    if (filters.statut) {
      query += ' AND statut = ?';
      values.push(filters.statut);
    }

    if (filters.is_casino_player !== undefined) {
      query += ' AND is_casino_player = ?';
      values.push(filters.is_casino_player);
    }

    query += ' ORDER BY nom ASC';

    const [rows] = await pool.query(query, values);
    return rows;
  }

  // Récupérer par ID
  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM clients WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  // Récupérer par email
  static async findByEmail(email) {
    const [rows] = await pool.query(
      'SELECT * FROM clients WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  }

  // Créer client
  static async create(data) {
    const {
      code_client, nom, prenom, telephone, email,
      adresse, date_naissance, type_piece, numero_piece,
      photo_url, is_casino_player = 0, statut = 'ACTIF'
    } = data;

    const [result] = await pool.query(`
      INSERT INTO clients 
      (code_client, nom, prenom, telephone, email, adresse,
       date_naissance, type_piece, numero_piece, photo_url,
       is_casino_player, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      code_client || null,
      nom,
      prenom || null,
      telephone || null,
      email || null,
      adresse || null,
      date_naissance || null,
      type_piece || null,
      numero_piece || null,
      photo_url || null,
      is_casino_player,
      statut
    ]);

    return result.insertId;
  }

  // Update client
  static async update(id, data) {
    const updates = [];
    const values = [];

    const allowedFields = [
      'code_client', 'nom', 'prenom', 'telephone', 'email',
      'adresse', 'date_naissance', 'type_piece', 'numero_piece',
      'photo_url', 'is_casino_player', 'statut'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) return false;

    values.push(id);

    const [result] = await pool.query(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  // Delete
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM clients WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }

  // Exists
  static async exists(id) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM clients WHERE id = ?',
      [id]
    );

    return rows[0].count > 0;
  }
}

module.exports = Client;