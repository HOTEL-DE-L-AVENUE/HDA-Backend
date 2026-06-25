const { pool } = require('../Config/connectDatabase');

class RoomMaintenance {
  // Récupérer toutes les maintenances
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          rm.*,
          r.numero as room_numero,
          e.nom as equipment_nom,
          u.nom as created_by_nom
        FROM room_maintenance rm
        LEFT JOIN rooms r ON rm.room_id = r.id
        LEFT JOIN equipments e ON rm.equipment_id = e.id
        LEFT JOIN users u ON rm.created_by = u.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.statut) {
        query += ' AND rm.statut = ?';
        values.push(filters.statut);
      }

      if (filters.room_id) {
        query += ' AND rm.room_id = ?';
        values.push(filters.room_id);
      }

      if (filters.type_intervention) {
        query += ' AND rm.type_intervention = ?';
        values.push(filters.type_intervention);
      }

      query += ' ORDER BY rm.date_declaration DESC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll RoomMaintenance:', error);
      throw error;
    }
  }

  // Récupérer une maintenance par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          rm.*,
          r.numero as room_numero,
          e.nom as equipment_nom,
          u.nom as created_by_nom
        FROM room_maintenance rm
        LEFT JOIN rooms r ON rm.room_id = r.id
        LEFT JOIN equipments e ON rm.equipment_id = e.id
        LEFT JOIN users u ON rm.created_by = u.id
        WHERE rm.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById RoomMaintenance ${id}:`, error);
      throw error;
    }
  }

  // Créer une maintenance
  static async create(data) {
    try {
      const {
        room_id, equipment_id, type_intervention, description,
        statut = 'OUVERT', date_declaration, cout = 0, created_by
      } = data;

      const [result] = await pool.query(`
        INSERT INTO room_maintenance 
        (room_id, equipment_id, type_intervention, description, 
         statut, date_declaration, cout, created_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        room_id,
        equipment_id || null,
        type_intervention,
        description || null,
        statut,
        date_declaration || new Date(),
        cout,
        created_by || null
      ]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create RoomMaintenance:', error);
      throw error;
    }
  }

  // Mettre à jour une maintenance
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = [
        'room_id', 'equipment_id', 'type_intervention', 'description',
        'statut', 'date_resolution', 'cout'
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
        `UPDATE room_maintenance SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update RoomMaintenance ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      const [result] = await pool.query(
        'UPDATE room_maintenance SET statut = ? WHERE id = ?',
        [statut, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updateStatus RoomMaintenance ${id}:`, error);
      throw error;
    }
  }

  // Résoudre une maintenance
  static async resolve(id, date_resolution = null) {
    try {
      const [result] = await pool.query(
        'UPDATE room_maintenance SET statut = "TERMINE", date_resolution = ? WHERE id = ?',
        [date_resolution || new Date(), id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur resolve RoomMaintenance ${id}:`, error);
      throw error;
    }
  }

  // Supprimer une maintenance
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM room_maintenance WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete RoomMaintenance ${id}:`, error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'OUVERT' THEN 1 ELSE 0 END) as ouverts,
          SUM(CASE WHEN statut = 'EN_COURS' THEN 1 ELSE 0 END) as en_cours,
          SUM(CASE WHEN statut = 'TERMINE' THEN 1 ELSE 0 END) as termines,
          SUM(CASE WHEN statut = 'ANNULE' THEN 1 ELSE 0 END) as annules,
          SUM(cout) as cout_total,
          AVG(cout) as cout_moyen,
          COUNT(DISTINCT room_id) as chambres_touchees
        FROM room_maintenance
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats RoomMaintenance:', error);
      throw error;
    }
  }
}

module.exports = RoomMaintenance;