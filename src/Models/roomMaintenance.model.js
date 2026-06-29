// backend/Models/roomMaintenance.model.js
const { pool } = require('../Config/connectDatabase');

class RoomMaintenance {
  // Récupérer toutes les maintenances - Version avec logs
  static async findAll(filters = {}) {
    try {
      console.log('🔍 [RoomMaintenance.findAll] Début de la recherche');
      console.log('📋 Filters reçus:', JSON.stringify(filters, null, 2));
      
      let query = 'SELECT * FROM room_maintenance WHERE 1=1';
      const values = [];

      if (filters.statut) {
        query += ' AND statut = ?';
        values.push(filters.statut);
        console.log(`✅ Filtre statut: ${filters.statut}`);
      }

      if (filters.room_id) {
        query += ' AND room_id = ?';
        values.push(parseInt(filters.room_id));
        console.log(`✅ Filtre room_id: ${filters.room_id}`);
      }

      if (filters.type_intervention) {
        query += ' AND type_intervention = ?';
        values.push(filters.type_intervention);
        console.log(`✅ Filtre type_intervention: ${filters.type_intervention}`);
      }

      query += ' ORDER BY date_declaration DESC';

      console.log('📝 Query SQL:', query);
      console.log('📝 Values:', values);

      const [rows] = await pool.query(query, values);
      
      console.log(`✅ Résultat: ${rows.length} maintenance(s) trouvée(s)`);
      
      return rows;
    } catch (error) {
      console.error('❌ [RoomMaintenance.findAll] Erreur:', error);
      console.error('❌ Stack:', error.stack);
      throw error;
    }
  }

  // Récupérer une maintenance par ID
  static async findById(id) {
    try {
      console.log(`🔍 [RoomMaintenance.findById] Recherche de l'ID: ${id}`);
      
      const [rows] = await pool.query(
        'SELECT * FROM room_maintenance WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        console.log(`⚠️ Aucune maintenance trouvée avec l'ID: ${id}`);
      } else {
        console.log(`✅ Maintenance trouvée avec l'ID: ${id}`);
      }
      
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ [RoomMaintenance.findById] Erreur pour l'ID ${id}:`, error);
      throw error;
    }
  }

  // Créer une maintenance
  static async create(data) {
    try {
      console.log('📝 [RoomMaintenance.create] Création d\'une maintenance');
      console.log('📋 Data:', JSON.stringify(data, null, 2));

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
        cout || 0,
        created_by || null
      ]);

      console.log(`✅ Maintenance créée avec l'ID: ${result.insertId}`);
      
      return result.insertId;
    } catch (error) {
      console.error('❌ [RoomMaintenance.create] Erreur:', error);
      throw error;
    }
  }

  // Mettre à jour une maintenance
  static async update(id, data) {
    try {
      console.log(`📝 [RoomMaintenance.update] Mise à jour de l'ID: ${id}`);
      console.log('📋 Data:', JSON.stringify(data, null, 2));

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

      if (updates.length === 0) {
        console.log('⚠️ Aucune modification à appliquer');
        return false;
      }

      values.push(id);
      const [result] = await pool.query(
        `UPDATE room_maintenance SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      
      console.log(`✅ ${result.affectedRows} ligne(s) mise(s) à jour`);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ [RoomMaintenance.update] Erreur pour l'ID ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le statut
  static async updateStatus(id, statut) {
    try {
      console.log(`📝 [RoomMaintenance.updateStatus] ID: ${id}, Nouveau statut: ${statut}`);

      const [result] = await pool.query(
        'UPDATE room_maintenance SET statut = ? WHERE id = ?',
        [statut, id]
      );
      
      console.log(`✅ ${result.affectedRows} ligne(s) mise(s) à jour`);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ [RoomMaintenance.updateStatus] Erreur pour l'ID ${id}:`, error);
      throw error;
    }
  }

  // Résoudre une maintenance
  static async resolve(id, date_resolution = null) {
    try {
      console.log(`📝 [RoomMaintenance.resolve] Résolution de l'ID: ${id}`);

      const [result] = await pool.query(
        'UPDATE room_maintenance SET statut = "TERMINE", date_resolution = ? WHERE id = ?',
        [date_resolution || new Date(), id]
      );
      
      console.log(`✅ ${result.affectedRows} ligne(s) mise(s) à jour`);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ [RoomMaintenance.resolve] Erreur pour l'ID ${id}:`, error);
      throw error;
    }
  }

  // Supprimer une maintenance
  static async delete(id) {
    try {
      console.log(`📝 [RoomMaintenance.delete] Suppression de l'ID: ${id}`);

      const [result] = await pool.query('DELETE FROM room_maintenance WHERE id = ?', [id]);
      
      console.log(`✅ ${result.affectedRows} ligne(s) supprimée(s)`);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ [RoomMaintenance.delete] Erreur pour l'ID ${id}:`, error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      console.log('📊 [RoomMaintenance.getStats] Récupération des statistiques');

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
      
      console.log('✅ Statistiques récupérées:', JSON.stringify(rows[0], null, 2));
      
      return rows[0] || { 
        total: 0, 
        ouverts: 0, 
        en_cours: 0, 
        termines: 0, 
        annules: 0, 
        cout_total: 0, 
        cout_moyen: 0, 
        chambres_touchees: 0 
      };
    } catch (error) {
      console.error('❌ [RoomMaintenance.getStats] Erreur:', error);
      throw error;
    }
  }
}

module.exports = RoomMaintenance;