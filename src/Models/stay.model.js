const { pool } = require('../Config/connectDatabase');

class Stay {

  // Récupérer tous les séjours
  static async findAll(filters = {}) {
    let query = `
      SELECT 
        s.*,
        r.numero as room_numero,
        c.nom as client_nom,
        c.prenom as client_prenom,
        res.statut as reservation_statut
      FROM stays s
      LEFT JOIN reservations res ON s.reservation_id = res.id
      LEFT JOIN rooms r ON res.room_id = r.id
      LEFT JOIN clients c ON res.client_id = c.id
      WHERE 1=1
    `;

    const values = [];

    if (filters.room_id) {
      query += ' AND r.id = ?';
      values.push(filters.room_id);
    }

    if (filters.client_id) {
      query += ' AND c.id = ?';
      values.push(filters.client_id);
    }

    query += ' ORDER BY s.checkin_at DESC';

    const [rows] = await pool.query(query, values);
    return rows;
  }

  // Find by ID
  static async findById(id) {
    const [rows] = await pool.query(`
      SELECT 
        s.*,
        r.numero as room_numero,
        c.nom as client_nom,
        c.prenom as client_prenom
      FROM stays s
      LEFT JOIN reservations res ON s.reservation_id = res.id
      LEFT JOIN rooms r ON res.room_id = r.id
      LEFT JOIN clients c ON res.client_id = c.id
      WHERE s.id = ?
    `, [id]);

    return rows[0] || null;
  }

  // Create (check-in)
  static async create(data) {
    const { reservation_id, checkin_at } = data;

    const [result] = await pool.query(
      `INSERT INTO stays (reservation_id, checkin_at)
       VALUES (?, ?)`,
      [reservation_id, checkin_at || new Date()]
    );

    return result.insertId;
  }

  // Checkout
  static async checkout(id, checkout_at = null) {
    const [result] = await pool.query(
      'UPDATE stays SET checkout_at = ? WHERE id = ?',
      [checkout_at || new Date(), id]
    );

    return result.affectedRows > 0;
  }

  // Delete
  static async delete(id) {
    const [result] = await pool.query(
      'DELETE FROM stays WHERE id = ?',
      [id]
    );

    return result.affectedRows > 0;
  }
}

module.exports = Stay;