// backend/Models/housekeepingTask.model.js
const { pool } = require('../Config/connectDatabase');

class HousekeepingTask {
  // Récupérer toutes les tâches - Version sans jointure users
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          ht.*,
          r.numero as room_numero
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.statut) {
        query += ' AND ht.statut = ?';
        values.push(filters.statut);
      }
      if (filters.room_id) {
        query += ' AND ht.room_id = ?';
        values.push(parseInt(filters.room_id));
      }
      if (filters.type_tache) {
        query += ' AND ht.type_tache = ?';
        values.push(filters.type_tache);
      }
      if (filters.assigned_user_id) {
        query += ' AND ht.assigned_user_id = ?';
        values.push(parseInt(filters.assigned_user_id));
      }
      if (filters.planned_at) {
        query += ' AND DATE(ht.planned_at) = ?';
        values.push(filters.planned_at);
      }

      query += ' ORDER BY ht.planned_at ASC, ht.created_at DESC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll HousekeepingTask:', error);
      throw error;
    }
  }

  // Récupérer une tâche par ID - Version sans jointure users
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          ht.*,
          r.numero as room_numero
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        WHERE ht.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById HousekeepingTask ${id}:`, error);
      throw error;
    }
  }

  // Récupérer les tâches d'une chambre
  static async findByRoomId(roomId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          ht.*,
          r.numero as room_numero
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        WHERE ht.room_id = ? 
        ORDER BY ht.planned_at ASC
      `, [roomId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByRoomId HousekeepingTask ${roomId}:`, error);
      throw error;
    }
  }

  // Récupérer les tâches d'un utilisateur - Version sans jointure users
  static async findByUserId(userId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          ht.*,
          r.numero as room_numero
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        WHERE ht.assigned_user_id = ? 
        ORDER BY ht.planned_at ASC
      `, [userId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByUserId HousekeepingTask ${userId}:`, error);
      throw error;
    }
  }

  // Créer une tâche
  static async create(data) {
    try {
      const {
        room_id, assigned_user_id, type_tache, statut,
        commentaire, planned_at
      } = data;

      const [result] = await pool.query(`
        INSERT INTO housekeeping_tasks 
        (room_id, assigned_user_id, type_tache, statut, commentaire, planned_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        room_id,
        assigned_user_id || null,
        type_tache,
        statut || 'A_FAIRE',
        commentaire || null,
        planned_at || new Date()
      ]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create HousekeepingTask:', error);
      throw error;
    }
  }

  // Mettre à jour une tâche
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = [
        'room_id', 'assigned_user_id', 'type_tache',
        'statut', 'commentaire', 'planned_at'
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
        `UPDATE housekeeping_tasks SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update HousekeepingTask ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      const [result] = await pool.query(
        'UPDATE housekeeping_tasks SET statut = ? WHERE id = ?',
        [statut, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updateStatus HousekeepingTask ${id}:`, error);
      throw error;
    }
  }

  // Terminer une tâche
  static async complete(id) {
    try {
      const [result] = await pool.query(
        'UPDATE housekeeping_tasks SET statut = "TERMINE", completed_at = NOW() WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur complete HousekeepingTask ${id}:`, error);
      throw error;
    }
  }

  // Supprimer une tâche
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM housekeeping_tasks WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete HousekeepingTask ${id}:`, error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN statut = 'A_FAIRE' THEN 1 ELSE 0 END) as a_faire,
          SUM(CASE WHEN statut = 'EN_COURS' THEN 1 ELSE 0 END) as en_cours,
          SUM(CASE WHEN statut = 'TERMINE' THEN 1 ELSE 0 END) as termine,
          COUNT(DISTINCT room_id) as chambres_occupees
        FROM housekeeping_tasks
      `);
      return rows[0] || { total: 0, a_faire: 0, en_cours: 0, termine: 0, chambres_occupees: 0 };
    } catch (error) {
      console.error('❌ Erreur getStats HousekeepingTask:', error);
      throw error;
    }
  }
}

module.exports = HousekeepingTask;