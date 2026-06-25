const { pool } = require('../Config/connectDatabase');

class Reservation {
  // Récupérer toutes les réservations
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          r.*,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone as client_telephone,
          c.email as client_email,
          rm.numero as room_numero,
          rt.nom as room_type_nom
        FROM reservations r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN room_types rt ON rm.room_type_id = rt.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.statut) {
        query += ' AND r.statut = ?';
        values.push(filters.statut);
      }

      if (filters.client_id) {
        query += ' AND r.client_id = ?';
        values.push(filters.client_id);
      }

      if (filters.room_id) {
        query += ' AND r.room_id = ?';
        values.push(filters.room_id);
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

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll Reservation:', error);
      throw error;
    }
  }

  // Récupérer une réservation par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          r.*,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.telephone as client_telephone,
          c.email as client_email,
          rm.numero as room_numero,
          rt.nom as room_type_nom
        FROM reservations r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN rooms rm ON r.room_id = rm.id
        LEFT JOIN room_types rt ON rm.room_type_id = rt.id
        WHERE r.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById Reservation ${id}:`, error);
      throw error;
    }
  }

  // Créer une réservation
  static async create(data) {
    try {
      const { client_id, room_id, date_arrivee, date_depart, montant_total, statut = 'CONFIRMEE' } = data;

      const [result] = await pool.query(`
        INSERT INTO reservations 
        (client_id, room_id, date_arrivee, date_depart, montant_total, statut) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [client_id, room_id, date_arrivee, date_depart, montant_total, statut]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create Reservation:', error);
      throw error;
    }
  }

  // Mettre à jour une réservation
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['client_id', 'room_id', 'date_arrivee', 'date_depart', 'montant_total', 'statut'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      values.push(id);
      const [result] = await pool.query(
        `UPDATE reservations SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update Reservation ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      const [result] = await pool.query(
        'UPDATE reservations SET statut = ? WHERE id = ?',
        [statut, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updateStatus Reservation ${id}:`, error);
      throw error;
    }
  }

  // Supprimer une réservation
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM reservations WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete Reservation ${id}:`, error);
      throw error;
    }
  }

  // Vérifier si une réservation existe
  static async exists(id) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM reservations WHERE id = ?', [id]);
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur exists Reservation ${id}:`, error);
      throw error;
    }
  }

  // Statistiques des réservations
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'CONFIRMEE' THEN 1 ELSE 0 END) as confirmees,
          SUM(CASE WHEN statut = 'EN_COURS' THEN 1 ELSE 0 END) as en_cours,
          SUM(CASE WHEN statut = 'TERMINEE' THEN 1 ELSE 0 END) as terminees,
          SUM(CASE WHEN statut = 'ANNULEE' THEN 1 ELSE 0 END) as annulees,
          SUM(montant_total) as revenu_total,
          AVG(montant_total) as panier_moyen,
          COUNT(DISTINCT client_id) as clients_uniques
        FROM reservations
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats Reservation:', error);
      throw error;
    }
  }
}

module.exports = Reservation;