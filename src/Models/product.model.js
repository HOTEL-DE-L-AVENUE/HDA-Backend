const { pool } = require('../Config/connectDatabase');

class Product {
  // Récupérer tous les produits
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          p.*,
          c.nom as category_nom
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.actif !== undefined) {
        query += ' AND p.actif = ?';
        values.push(filters.actif);
      }

      if (filters.type_produit) {
        query += ' AND p.type_produit = ?';
        values.push(filters.type_produit);
      }

      if (filters.category_id) {
        query += ' AND p.category_id = ?';
        values.push(filters.category_id);
      }

      if (filters.nom) {
        query += ' AND p.nom LIKE ?';
        values.push(`%${filters.nom}%`);
      }

      query += ' ORDER BY p.nom ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll Product:', error);
      throw error;
    }
  }

  // Récupérer un produit par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          p.*,
          c.nom as category_nom
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById Product ${id}:`, error);
      throw error;
    }
  }

  // Récupérer un produit par code
  static async findByCode(code) {
    try {
      const [rows] = await pool.query('SELECT * FROM products WHERE code = ?', [code]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findByCode Product ${code}:`, error);
      throw error;
    }
  }

  // Créer un produit
  static async create(data) {
    try {
      const {
        category_id, code, nom, unite, prix_achat, prix_vente,
        actif = 1, type_produit = 'MATIERE_PREMIERE'
      } = data;

      const [result] = await pool.query(
        `INSERT INTO products 
         (category_id, code, nom, unite, prix_achat, prix_vente, actif, type_produit) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category_id || null,
          code || null,
          nom,
          unite || null,
          prix_achat || 0,
          prix_vente || 0,
          actif,
          type_produit
        ]
      );

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create Product:', error);
      throw error;
    }
  }

  // Mettre à jour un produit
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = [
        'category_id', 'code', 'nom', 'unite', 'prix_achat',
        'prix_vente', 'actif', 'type_produit'
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
        `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update Product ${id}:`, error);
      throw error;
    }
  }

  // Supprimer un produit
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM products WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete Product ${id}:`, error);
      throw error;
    }
  }

  // Vérifier si un produit existe
  static async exists(id) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM products WHERE id = ?', [id]);
      return rows[0].count > 0;
    } catch (error) {
      console.error(`❌ Erreur exists Product ${id}:`, error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN actif = 1 THEN 1 ELSE 0 END) as actifs,
          SUM(CASE WHEN type_produit = 'MATIERE_PREMIERE' THEN 1 ELSE 0 END) as matieres_premieres,
          SUM(CASE WHEN type_produit = 'PRODUIT_FINI' THEN 1 ELSE 0 END) as produits_finis,
          SUM(CASE WHEN type_produit = 'CONSOMMABLE' THEN 1 ELSE 0 END) as consommables,
          SUM(CASE WHEN type_produit = 'SERVICE' THEN 1 ELSE 0 END) as services,
          AVG(prix_vente) as prix_vente_moyen
        FROM products
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats Product:', error);
      throw error;
    }
  }
}

module.exports = Product;