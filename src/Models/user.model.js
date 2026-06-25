const { pool } = require('../Config/connectDatabase');

class User {
  // Récupérer tous les utilisateurs
  static async findAll(filters = {}) {
    try {
      let query = 'SELECT id, nom, prenom, email, role, actif, created_at FROM users WHERE 1=1';
      const values = [];

      if (filters.actif !== undefined) {
        query += ' AND actif = ?';
        values.push(filters.actif);
      }

      if (filters.role) {
        query += ' AND role = ?';
        values.push(filters.role);
      }

      if (filters.nom) {
        query += ' AND nom LIKE ?';
        values.push(`%${filters.nom}%`);
      }

      query += ' ORDER BY nom ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll User:', error);
      throw error;
    }
  }

  // Récupérer un utilisateur par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT id, nom, prenom, email, role, actif, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById User ${id}:`, error);
      throw error;
    }
  }

  // Récupérer un utilisateur par email
  static async findByEmail(email) {
    try {
      const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findByEmail User ${email}:`, error);
      throw error;
    }
  }

  // Créer un utilisateur
  static async create(data) {
    try {
      const { nom, prenom, email, password, role = 'user', actif = 1 } = data;

      const [result] = await pool.query(
        `INSERT INTO users (nom, prenom, email, password, role, actif) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [nom, prenom || null, email, password, role, actif]
      );

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create User:', error);
      throw error;
    }
  }

  // Mettre à jour un utilisateur
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['nom', 'prenom', 'email', 'role', 'actif'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      values.push(id);
      const [result] = await pool.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update User ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour le mot de passe
  static async updatePassword(id, password) {
    try {
      const [result] = await pool.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [password, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updatePassword User ${id}:`, error);
      throw error;
    }
  }

  // Supprimer un utilisateur
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete User ${id}:`, error);
      throw error;
    }
  }

  // Vérifier si un utilisateur existe
  static async exists(id) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM users WHERE id = ?', [id]);
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur exists User ${id}:`, error);
      throw error;
    }
  }
}

module.exports = User;