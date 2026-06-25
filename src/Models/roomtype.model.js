const { pool } = require('../Config/connectDatabase');

class RoomType {

  // Récupérer tous les types
  static async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM room_types ORDER BY nom'
    );
    return rows;
  }

  // Récupérer par ID
  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM room_types WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  // Créer
  static async create(data) {
    const { nom, description } = data;

    const [result] = await pool.query(
      'INSERT INTO room_types (nom, description) VALUES (?, ?)',
      [nom, description]
    );

    return result.insertId;
  }

  // Update
  static async update(id, data) {
    const { nom, description } = data;

    const [result] = await pool.query(
      'UPDATE room_types SET nom = ?, description = ? WHERE id = ?',
      [nom, description, id]
    );

    return result.affectedRows > 0;
  }

  // Delete
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM room_types WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = RoomType;