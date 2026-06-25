const { pool } = require('../Config/connectDatabase');

class RoomEquipment {
  // Récupérer tous les équipements de chambre
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          re.*,
          r.numero as room_numero,
          e.nom as equipment_nom,
          e.categorie as equipment_categorie,
          e.code as equipment_code
        FROM room_equipments re
        LEFT JOIN rooms r ON re.room_id = r.id
        LEFT JOIN equipments e ON re.equipment_id = e.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.room_id) {
        query += ' AND re.room_id = ?';
        values.push(filters.room_id);
      }

      if (filters.statut) {
        query += ' AND re.statut = ?';
        values.push(filters.statut);
      }

      if (filters.equipment_id) {
        query += ' AND re.equipment_id = ?';
        values.push(filters.equipment_id);
      }

      query += ' ORDER BY r.numero ASC, e.nom ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll RoomEquipment:', error);
      throw error;
    }
  }

  // Récupérer un équipement par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          re.*,
          r.numero as room_numero,
          e.nom as equipment_nom,
          e.categorie as equipment_categorie
        FROM room_equipments re
        LEFT JOIN rooms r ON re.room_id = r.id
        LEFT JOIN equipments e ON re.equipment_id = e.id
        WHERE re.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById RoomEquipment ${id}:`, error);
      throw error;
    }
  }

  // Récupérer les équipements d'une chambre
  static async findByRoomId(roomId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          re.*,
          e.nom as equipment_nom,
          e.categorie as equipment_categorie,
          e.code as equipment_code
        FROM room_equipments re
        LEFT JOIN equipments e ON re.equipment_id = e.id
        WHERE re.room_id = ?
        ORDER BY e.nom ASC
      `, [roomId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByRoomId RoomEquipment ${roomId}:`, error);
      throw error;
    }
  }

  // Créer un équipement de chambre
  static async create(data) {
    try {
      const { room_id, equipment_id, quantite = 1, statut = 'BON' } = data;

      const [result] = await pool.query(`
        INSERT INTO room_equipments (room_id, equipment_id, quantite, statut) 
        VALUES (?, ?, ?, ?)
      `, [room_id, equipment_id, quantite, statut]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create RoomEquipment:', error);
      throw error;
    }
  }

  // Mettre à jour un équipement
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['room_id', 'equipment_id', 'quantite', 'statut'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      values.push(id);
      const [result] = await pool.query(
        `UPDATE room_equipments SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update RoomEquipment ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      const [result] = await pool.query(
        'UPDATE room_equipments SET statut = ? WHERE id = ?',
        [statut, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updateStatus RoomEquipment ${id}:`, error);
      throw error;
    }
  }

  // Supprimer un équipement
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM room_equipments WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete RoomEquipment ${id}:`, error);
      throw error;
    }
  }

  // Supprimer tous les équipements d'une chambre
  static async deleteByRoomId(roomId) {
    try {
      const [result] = await pool.query('DELETE FROM room_equipments WHERE room_id = ?', [roomId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur deleteByRoomId RoomEquipment ${roomId}:`, error);
      throw error;
    }
  }

  // Vérifier si un équipement existe déjà dans une chambre
  static async exists(roomId, equipmentId) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM room_equipments WHERE room_id = ? AND equipment_id = ?',
        [roomId, equipmentId]
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error('❌ Erreur exists RoomEquipment:', error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'BON' THEN 1 ELSE 0 END) as bons,
          SUM(CASE WHEN statut = 'EN_PANNE' THEN 1 ELSE 0 END) as en_panne,
          SUM(CASE WHEN statut = 'REMPLACE' THEN 1 ELSE 0 END) as remplaces,
          SUM(CASE WHEN statut = 'HORS_SERVICE' THEN 1 ELSE 0 END) as hors_service,
          COUNT(DISTINCT room_id) as chambres_equipees,
          COUNT(DISTINCT equipment_id) as equipements_differents
        FROM room_equipments
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats RoomEquipment:', error);
      throw error;
    }
  }
}

module.exports = RoomEquipment;