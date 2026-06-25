const { pool } = require('../Config/connectDatabase');

class Room {
  // Récupérer toutes les chambres
  static async findAll(filters = {}) {
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

    if (filters.capacite) {
      query += ' AND r.capacite >= ?';
      values.push(filters.capacite);
    }

    query += ' ORDER BY r.numero ASC';

    try {
      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur SQL findAll:', error);
      throw error;
    }
  }

  // Récupérer une chambre par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          r.*,
          rt.nom as room_type_nom,
          rt.description as room_type_description
        FROM rooms r
        LEFT JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur SQL findById ${id}:`, error);
      throw error;
    }
  }

  // Récupérer une chambre par numéro
  static async findByNumero(numero) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          r.*,
          rt.nom as room_type_nom,
          rt.description as room_type_description
        FROM rooms r
        LEFT JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.numero = ?
      `, [numero]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur SQL findByNumero ${numero}:`, error);
      throw error;
    }
  }

  // Créer une chambre
  static async create(data) {
    try {
      const { room_type_id, numero, capacite, prix_nuit, statut = 'LIBRE' } = data;

      const [result] = await pool.query(
        `INSERT INTO rooms (room_type_id, numero, capacite, prix_nuit, statut)
         VALUES (?, ?, ?, ?, ?)`,
        [room_type_id || null, numero, capacite, prix_nuit, statut]
      );

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur SQL create:', error);
      throw error;
    }
  }

  // Mettre à jour une chambre
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['room_type_id', 'numero', 'capacite', 'prix_nuit', 'statut'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      values.push(id);

      const [result] = await pool.query(
        `UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur SQL update ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour statut
  static async updateStatus(id, statut) {
    try {
      const [result] = await pool.query(
        'UPDATE rooms SET statut = ? WHERE id = ?',
        [statut, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur SQL updateStatus ${id}:`, error);
      throw error;
    }
  }

  // Supprimer
  static async delete(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM rooms WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur SQL delete ${id}:`, error);
      throw error;
    }
  }

  // Existe ?
  static async exists(id) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM rooms WHERE id = ?',
        [id]
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur SQL exists ${id}:`, error);
      throw error;
    }
  }

  // Numéro existe ?
  static async numeroExists(numero, excludeId = null) {
    try {
      let query = 'SELECT COUNT(*) as count FROM rooms WHERE numero = ?';
      const values = [numero];

      if (excludeId) {
        query += ' AND id != ?';
        values.push(excludeId);
      }

      const [rows] = await pool.query(query, values);
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur SQL numeroExists ${numero}:`, error);
      throw error;
    }
  }

  // Disponibilité chambre
  static async isAvailable(roomId, dateArrivee, dateDepart) {
    try {
      const [rows] = await pool.query(`
        SELECT COUNT(*) as count
        FROM reservations
        WHERE room_id = ?
          AND statut NOT IN ('ANNULEE', 'TERMINEE')
          AND (
            (date_arrivee <= ? AND date_depart >= ?)
            OR (date_arrivee <= ? AND date_depart >= ?)
            OR (date_arrivee >= ? AND date_depart <= ?)
          )
      `, [roomId, dateArrivee, dateArrivee, dateDepart, dateDepart, dateArrivee, dateDepart]);

      return rows[0].count === 0;
    } catch (error) {
      console.error(`❌ Erreur SQL isAvailable ${roomId}:`, error);
      throw error;
    }
  }

  // Chambres disponibles
  static async findAvailable(dateArrivee, dateDepart, capacite = null, roomTypeId = null) {
    try {
      let query = `
        SELECT r.*, rt.nom as room_type_nom
        FROM rooms r
        LEFT JOIN room_types rt ON r.room_type_id = rt.id
        WHERE r.statut = 'LIBRE'
        AND NOT EXISTS (
          SELECT 1 FROM reservations res
          WHERE res.room_id = r.id
          AND res.statut NOT IN ('ANNULEE', 'TERMINEE')
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

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur SQL findAvailable:', error);
      throw error;
    }
  }

  // Stats
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'LIBRE' THEN 1 ELSE 0 END) as libres,
          SUM(CASE WHEN statut = 'OCCUPEE' THEN 1 ELSE 0 END) as occupees,
          SUM(CASE WHEN statut = 'RESERVEE' THEN 1 ELSE 0 END) as reservees,
          SUM(CASE WHEN statut = 'NETTOYAGE' THEN 1 ELSE 0 END) as nettoyage,
          SUM(CASE WHEN statut = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance,
          SUM(CASE WHEN statut = 'HORS_SERVICE' THEN 1 ELSE 0 END) as hors_service,
          AVG(prix_nuit) as prix_moyen,
          SUM(capacite) as capacite_totale
        FROM rooms
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur SQL getStats:', error);
      throw error;
    }
  }
}

module.exports = Room;