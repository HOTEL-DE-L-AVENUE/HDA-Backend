// models/consumption.model.js
const { pool } = require('../Config/connectDatabase');

class Consumption {
  // Récupérer toutes les consommations
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          c.*,
          r.numero as room_numero,
          p.nom as product_nom,
          cl.nom as client_nom,
          cl.prenom as client_prenom
        FROM consumptions c
        LEFT JOIN rooms r ON c.room_id = r.id
        LEFT JOIN products p ON c.product_id = p.id
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.room_id) {
        query += ' AND c.room_id = ?';
        values.push(filters.room_id);
      }

      if (filters.client_id) {
        query += ' AND c.client_id = ?';
        values.push(filters.client_id);
      }

      if (filters.facturee !== undefined) {
        query += ' AND c.facturee = ?';
        values.push(filters.facturee ? 1 : 0);
      }

      query += ' ORDER BY c.consumed_at DESC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll Consumption:', error);
      throw error;
    }
  }

  // Récupérer une consommation par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          r.numero as room_numero,
          p.nom as product_nom,
          cl.nom as client_nom,
          cl.prenom as client_prenom
        FROM consumptions c
        LEFT JOIN rooms r ON c.room_id = r.id
        LEFT JOIN products p ON c.product_id = p.id
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById Consumption ${id}:`, error);
      throw error;
    }
  }

  // Récupérer les consommations d'une chambre
  static async findByRoomId(roomId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          c.*,
          p.nom as product_nom
        FROM consumptions c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.room_id = ?
        ORDER BY c.consumed_at DESC
      `, [roomId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByRoomId Consumption ${roomId}:`, error);
      throw error;
    }
  }

  // Créer une consommation
  static async create(data) {
    try {
      const { room_id, client_id, product_id, quantite, prix_unitaire, montant, facturee = false } = data;
      
      const [result] = await pool.query(`
        INSERT INTO consumptions 
        (room_id, client_id, product_id, quantite, prix_unitaire, montant, facturee, consumed_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [room_id, client_id, product_id, quantite, prix_unitaire, montant, facturee]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create Consumption:', error);
      throw error;
    }
  }

  // Marquer comme facturée
  static async markAsBilled(id) {
    try {
      const [result] = await pool.query(
        'UPDATE consumptions SET facturee = true WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur markAsBilled Consumption ${id}:`, error);
      throw error;
    }
  }

  // Supprimer une consommation
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM consumptions WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete Consumption ${id}:`, error);
      throw error;
    }
  }

  // Récupérer le total des consommations d'une chambre
  static async getRoomTotal(roomId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          SUM(montant) as total,
          COUNT(*) as count
        FROM consumptions 
        WHERE room_id = ?
      `, [roomId]);
      return {
        total: rows[0]?.total || 0,
        count: rows[0]?.count || 0
      };
    } catch (error) {
      console.error(`❌ Erreur getRoomTotal Consumption ${roomId}:`, error);
      throw error;
    }
  }
}

module.exports = Consumption;