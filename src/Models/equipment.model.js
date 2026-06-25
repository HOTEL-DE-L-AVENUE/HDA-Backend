const { pool } = require('../Config/connectDatabase');

class Equipment {
  // Récupérer tous les équipements
  static async findAll(filters = {}) {
    try {
      let query = 'SELECT * FROM equipments WHERE 1=1';
      const values = [];

      if (filters.categorie) {
        query += ' AND categorie = ?';
        values.push(filters.categorie);
      }

      if (filters.nom) {
        query += ' AND nom LIKE ?';
        values.push(`%${filters.nom}%`);
      }

      if (filters.code) {
        query += ' AND code LIKE ?';
        values.push(`%${filters.code}%`);
      }

      query += ' ORDER BY nom ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll Equipment:', error);
      throw error;
    }
  }

  // Récupérer un équipement par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query('SELECT * FROM equipments WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById Equipment ${id}:`, error);
      throw error;
    }
  }

  // Récupérer un équipement par code
  static async findByCode(code) {
    try {
      const [rows] = await pool.query('SELECT * FROM equipments WHERE code = ?', [code]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findByCode Equipment ${code}:`, error);
      throw error;
    }
  }

  // Créer un équipement
  static async create(data) {
    try {
      const { code, nom, categorie, description } = data;

      // Vérifier si le code existe déjà
      if (code) {
        const existing = await this.findByCode(code);
        if (existing) {
          throw new Error(`Un équipement avec le code ${code} existe déjà`);
        }
      }

      const [result] = await pool.query(
        `INSERT INTO equipments (code, nom, categorie, description) 
         VALUES (?, ?, ?, ?)`,
        [code || null, nom, categorie || null, description || null]
      );

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create Equipment:', error);
      throw error;
    }
  }

  // Mettre à jour un équipement
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['code', 'nom', 'categorie', 'description'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      // Vérifier si le nouveau code existe déjà
      if (data.code) {
        const existing = await this.findByCode(data.code);
        if (existing && existing.id !== parseInt(id)) {
          throw new Error(`Un équipement avec le code ${data.code} existe déjà`);
        }
      }

      values.push(id);
      const [result] = await pool.query(
        `UPDATE equipments SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update Equipment ${id}:`, error);
      throw error;
    }
  }

  // Supprimer un équipement
  static async delete(id) {
    try {
      // Vérifier si l'équipement est utilisé dans room_equipments
      const [used] = await pool.query(
        'SELECT COUNT(*) as count FROM room_equipments WHERE equipment_id = ?',
        [id]
      );

      if (used[0].count > 0) {
        throw new Error('Cet équipement est utilisé dans des chambres. Supprimez d\'abord les associations.');
      }

      const [result] = await pool.query('DELETE FROM equipments WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete Equipment ${id}:`, error);
      throw error;
    }
  }

  // Vérifier si un équipement existe
  static async exists(id) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM equipments WHERE id = ?', [id]);
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur exists Equipment ${id}:`, error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(DISTINCT categorie) as categories,
          (SELECT COUNT(*) FROM room_equipments) as total_associations,
          (SELECT COUNT(DISTINCT equipment_id) FROM room_equipments) as equipements_utilises
        FROM equipments
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats Equipment:', error);
      throw error;
    }
  }

  // Récupérer les catégories
  static async getCategories() {
    try {
      const [rows] = await pool.query(
        'SELECT DISTINCT categorie FROM equipments WHERE categorie IS NOT NULL ORDER BY categorie ASC'
      );
      return rows.map(row => row.categorie);
    } catch (error) {
      console.error('❌ Erreur getCategories Equipment:', error);
      throw error;
    }
  }
}

module.exports = Equipment;