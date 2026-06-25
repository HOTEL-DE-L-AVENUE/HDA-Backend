const { getPool } = require('../Config/connectDatabase');

class Room {
  static async create(roomData) {
    const pool = getPool();
    const { room_type_id, numero, capacite, prix_nuit, statut = 'disponible', type = 'Standard' } = roomData;
    
    const query = `
      INSERT INTO rooms (room_type_id, numero, capacite, prix_nuit, statut, type) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      room_type_id || null,
      numero,
      capacite,
      prix_nuit,
      statut,
      type
    ]);
    
    return result.insertId;
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT 
        r.*,
        rt.nom as room_type_nom,
        rt.description as room_type_description
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      WHERE 1=1
    `;
    const values = [];
    
    if (filters.statut) {
      query += ' AND r.statut = ?';
      values.push(filters.statut);
    }
    
    if (filters.room_type_id) {
      query += ' AND r.room_type_id = ?';
      values.push(filters.room_type_id);
    }
    
    if (filters.min_price) {
      query += ' AND r.prix_nuit >= ?';
      values.push(filters.min_price);
    }
    
    if (filters.max_price) {
      query += ' AND r.prix_nuit <= ?';
      values.push(filters.max_price);
    }
    
    if (filters.capacite_min) {
      query += ' AND r.capacite >= ?';
      values.push(filters.capacite_min);
    }
    
    query += ' ORDER BY r.numero ASC';
    
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const query = `
      SELECT 
        r.*,
        rt.nom as room_type_nom,
        rt.description as room_type_description
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async update(id, roomData) {
    const pool = getPool();
    const updates = [];
    const values = [];
    
    const allowedFields = ['room_type_id', 'numero', 'capacite', 'prix_nuit', 'statut', 'type'];
    
    for (const field of allowedFields) {
      if (roomData[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(roomData[field]);
      }
    }
    
    if (updates.length === 0) return false;
    
    values.push(id);
    const query = `UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`;
    
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  static async updateStatus(id, statut) {
    const pool = getPool();
    const query = 'UPDATE rooms SET statut = ? WHERE id = ?';
    const [result] = await pool.execute(query, [statut, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = getPool();
    const query = 'DELETE FROM rooms WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  static async exists(id) {
    const pool = getPool();
    const query = 'SELECT COUNT(*) as count FROM rooms WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0].count > 0;
  }

  static async numeroExists(numero, excludeId = null) {
    const pool = getPool();
    let query = 'SELECT COUNT(*) as count FROM rooms WHERE numero = ?';
    const values = [numero];
    
    if (excludeId) {
      query += ' AND id != ?';
      values.push(excludeId);
    }
    
    const [rows] = await pool.execute(query, values);
    return rows[0].count > 0;
  }

  /**
   * Vérifier si une chambre est disponible pour une période donnée
   */
  static async isAvailable(roomId, dateArrivee, dateDepart) {
    const pool = getPool();
    const query = `
      SELECT COUNT(*) as count 
      FROM reservations 
      WHERE room_id = ? 
        AND statut NOT IN ('annulee', 'terminee')
        AND (
          (date_arrivee <= ? AND date_depart >= ?)
          OR (date_arrivee <= ? AND date_depart >= ?)
          OR (date_arrivee >= ? AND date_depart <= ?)
        )
    `;
    
    const [rows] = await pool.execute(query, [
      roomId, 
      dateArrivee, dateArrivee, 
      dateDepart, dateDepart, 
      dateArrivee, dateDepart
    ]);
    
    return rows[0].count === 0;
  }

  /**
   * Récupérer les chambres disponibles pour une période
   */
  static async findAvailable(dateArrivee, dateDepart, capacite = null, roomTypeId = null) {
    const pool = getPool();
    let query = `
      SELECT 
        r.*,
        rt.nom as room_type_nom
      FROM rooms r
      LEFT JOIN room_types rt ON r.room_type_id = rt.id
      WHERE r.statut = 'disponible'
        AND NOT EXISTS (
          SELECT 1 FROM reservations res 
          WHERE res.room_id = r.id 
            AND res.statut NOT IN ('annulee', 'terminee')
            AND (
              (res.date_arrivee <= ? AND res.date_depart >= ?)
              OR (res.date_arrivee <= ? AND res.date_depart >= ?)
              OR (res.date_arrivee >= ? AND res.date_depart <= ?)
            )
        )
    `;
    
    const values = [dateArrivee, dateArrivee, dateDepart, dateDepart, dateArrivee, dateDepart];
    
    if (capacite) {
      query += ' AND r.capacite >= ?';
      values.push(capacite);
    }
    
    if (roomTypeId) {
      query += ' AND r.room_type_id = ?';
      values.push(roomTypeId);
    }
    
    query += ' ORDER BY r.numero ASC';
    
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async getStats() {
    const pool = getPool();
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN statut = 'disponible' THEN 1 ELSE 0 END) as disponibles,
        SUM(CASE WHEN statut = 'occupee' THEN 1 ELSE 0 END) as occupees,
        SUM(CASE WHEN statut = 'reservée' THEN 1 ELSE 0 END) as reservees,
        SUM(CASE WHEN statut = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
        AVG(prix_nuit) as prix_moyen,
        SUM(capacite) as capacite_totale
      FROM rooms
    `;
    
    const [rows] = await pool.execute(query);
    return rows[0];
  }
}

module.exports = Room;