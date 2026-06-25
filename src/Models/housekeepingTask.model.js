const { pool } = require('../Config/connectDatabase');

class HousekeepingTask {
  // Récupérer toutes les tâches
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          ht.*,
          r.numero as room_numero,
          u.nom as assigned_user_nom,
          u.prenom as assigned_user_prenom
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        LEFT JOIN users u ON ht.assigned_user_id = u.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.statut) {
        query += ' AND ht.statut = ?';
        values.push(filters.statut);
      }

      if (filters.room_id) {
        query += ' AND ht.room_id = ?';
        values.push(filters.room_id);
      }

      if (filters.type_tache) {
        query += ' AND ht.type_tache = ?';
        values.push(filters.type_tache);
      }

      if (filters.assigned_user_id) {
        query += ' AND ht.assigned_user_id = ?';
        values.push(filters.assigned_user_id);
      }

      if (filters.planned_at) {
        query += ' AND DATE(ht.planned_at) = ?';
        values.push(filters.planned_at);
      }

      query += ' ORDER BY ht.planned_at ASC, ht.created_at ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll HousekeepingTask:', error);
      throw error;
    }
  }

  // Récupérer une tâche par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          ht.*,
          r.numero as room_numero,
          u.nom as assigned_user_nom,
          u.prenom as assigned_user_prenom
        FROM housekeeping_tasks ht
        LEFT JOIN rooms r ON ht.room_id = r.id
        LEFT JOIN users u ON ht.assigned_user_id = u.id
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
          u.nom as assigned_user_nom,
          u.prenom as assigned_user_prenom
        FROM housekeeping_tasks ht
        LEFT JOIN users u ON ht.assigned_user_id = u.id
        WHERE ht.room_id = ?
        ORDER BY ht.planned_at ASC
      `, [roomId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByRoomId HousekeepingTask ${roomId}:`, error);
      throw error;
    }
  }

  // Récupérer les tâches d'un utilisateur
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
        room_id, assigned_user_id, type_tache, statut = 'A_FAIRE',
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
        statut,
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
        'room_id', 'assigned_user_id', 'type_tache', 'statut',
        'commentaire', 'planned_at', 'completed_at'
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

  // Marquer comme terminée
  static async complete(id) {
    try {
      const [result] = await pool.query(
        'UPDATE housekeeping_tasks SET statut = "TERMINE", completed_at = ? WHERE id = ?',
        [new Date(), id]
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
          SUM(CASE WHEN statut = 'TERMINE' THEN 1 ELSE 0 END) as termines,
          COUNT(DISTINCT room_id) as chambres_traitees,
          COUNT(DISTINCT assigned_user_id) as employes_actifs,
          SUM(CASE WHEN DATE(planned_at) = CURDATE() THEN 1 ELSE 0 END) as aujourdhui,
          SUM(CASE WHEN DATE(planned_at) = CURDATE() AND statut = 'TERMINE' THEN 1 ELSE 0 END) as termines_aujourdhui
        FROM housekeeping_tasks
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats HousekeepingTask:', error);
      throw error;
    }
  }
}

module.exports = HousekeepingTask;