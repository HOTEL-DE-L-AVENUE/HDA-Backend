const { getPool } = require('../Config/connectDatabase');

class Reservation {
  static async create(data) {
    const pool = getPool();
    const { 
      client_id, room_id, date_arrivee, date_depart, 
      montant_total, statut, notes 
    } = data;

    const query = `
      INSERT INTO reservations 
      (client_id, room_id, date_arrivee, date_depart, montant_total, statut, notes) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(query, [
      client_id,
      room_id,
      date_arrivee,
      date_depart,
      montant_total,
      statut || 'confirmee',
      notes || null
    ]);

    return result.insertId;
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT 
        r.*,
        c.numero as room_numero,
        c.type as room_type,
        cl.nom as client_nom,
        cl.prenom as client_prenom,
        cl.telephone as client_telephone,
        cl.email as client_email
      FROM reservations r
      LEFT JOIN rooms c ON r.room_id = c.id
      LEFT JOIN clients cl ON r.client_id = cl.id
      WHERE 1=1
    `;
    
    const values = [];

    if (filters.statut) {
      query += ' AND r.statut = ?';
      values.push(filters.statut);
    }

    if (filters.room_id) {
      query += ' AND r.room_id = ?';
      values.push(filters.room_id);
    }

    if (filters.client_id) {
      query += ' AND r.client_id = ?';
      values.push(filters.client_id);
    }

    if (filters.date_arrivee) {
      query += ' AND r.date_arrivee >= ?';
      values.push(filters.date_arrivee);
    }

    if (filters.date_depart) {
      query += ' AND r.date_depart <= ?';
      values.push(filters.date_depart);
    }

    query += ' ORDER BY r.date_arrivee DESC';

    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const query = `
      SELECT 
        r.*,
        c.numero as room_numero,
        c.type as room_type,
        c.prix_nuit as room_prix_nuit,
        c.capacite as room_capacite,
        cl.nom as client_nom,
        cl.prenom as client_prenom,
        cl.telephone as client_telephone,
        cl.email as client_email
      FROM reservations r
      LEFT JOIN rooms c ON r.room_id = c.id
      LEFT JOIN clients cl ON r.client_id = cl.id
      WHERE r.id = ?
    `;
    
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async update(id, data) {
    const pool = getPool();
    const updates = [];
    const values = [];

    const allowedFields = [
      'client_id', 'room_id', 'date_arrivee', 'date_depart', 
      'montant_total', 'statut', 'notes'
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) return false;

    values.push(id);
    const query = `UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`;
    
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  static async updateStatus(id, statut) {
    const pool = getPool();
    const query = 'UPDATE reservations SET statut = ? WHERE id = ?';
    const [result] = await pool.execute(query, [statut, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = getPool();
    const query = 'DELETE FROM reservations WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  static async exists(id) {
    const pool = getPool();
    const query = 'SELECT COUNT(*) as count FROM reservations WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0].count > 0;
  }

  static async getStats() {
    const pool = getPool();
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'confirmee' THEN 1 ELSE 0 END) as confirmees,
        SUM(CASE WHEN statut = 'en_cours' THEN 1 ELSE 0 END) as en_cours,
        SUM(CASE WHEN statut = 'terminee' THEN 1 ELSE 0 END) as terminees,
        SUM(CASE WHEN statut = 'annulee' THEN 1 ELSE 0 END) as annulees,
        SUM(montant_total) as revenu_total,
        AVG(montant_total) as panier_moyen
      FROM reservations
    `;
    
    const [rows] = await pool.execute(query);
    return rows[0];
  }
}

module.exports = Reservation;