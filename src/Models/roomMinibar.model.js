const { pool } = require('../Config/connectDatabase');

class RoomMinibar {
  // Récupérer tous les minibars
  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT 
          rm.*,
          r.numero as room_numero,
          p.nom as product_nom,
          p.code as product_code,
          p.prix_vente as product_prix
        FROM room_minibar rm
        LEFT JOIN rooms r ON rm.room_id = r.id
        LEFT JOIN products p ON rm.product_id = p.id
        WHERE 1=1
      `;
      const values = [];

      if (filters.room_id) {
        query += ' AND rm.room_id = ?';
        values.push(filters.room_id);
      }

      if (filters.product_id) {
        query += ' AND rm.product_id = ?';
        values.push(filters.product_id);
      }

      if (filters.seuil_alerte) {
        query += ' AND rm.quantite <= rm.seuil_alerte';
      }

      query += ' ORDER BY r.numero ASC, p.nom ASC';

      const [rows] = await pool.query(query, values);
      return rows;
    } catch (error) {
      console.error('❌ Erreur findAll RoomMinibar:', error);
      throw error;
    }
  }

  // Récupérer un minibar par ID
  static async findById(id) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          rm.*,
          r.numero as room_numero,
          p.nom as product_nom,
          p.code as product_code,
          p.prix_vente as product_prix
        FROM room_minibar rm
        LEFT JOIN rooms r ON rm.room_id = r.id
        LEFT JOIN products p ON rm.product_id = p.id
        WHERE rm.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error(`❌ Erreur findById RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Récupérer le minibar d'une chambre
  static async findByRoomId(roomId) {
    try {
      const [rows] = await pool.query(`
        SELECT 
          rm.*,
          p.nom as product_nom,
          p.code as product_code,
          p.prix_vente as product_prix
        FROM room_minibar rm
        LEFT JOIN products p ON rm.product_id = p.id
        WHERE rm.room_id = ?
        ORDER BY p.nom ASC
      `, [roomId]);
      return rows;
    } catch (error) {
      console.error(`❌ Erreur findByRoomId RoomMinibar ${roomId}:`, error);
      throw error;
    }
  }

  // Récupérer les produits en alerte
  static async getAlertItems() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          rm.*,
          r.numero as room_numero,
          p.nom as product_nom,
          p.code as product_code
        FROM room_minibar rm
        LEFT JOIN rooms r ON rm.room_id = r.id
        LEFT JOIN products p ON rm.product_id = p.id
        WHERE rm.quantite <= rm.seuil_alerte
        ORDER BY rm.quantite ASC
      `);
      return rows;
    } catch (error) {
      console.error('❌ Erreur getAlertItems RoomMinibar:', error);
      throw error;
    }
  }

  // Créer un produit dans le minibar
  static async create(data) {
    try {
      const { room_id, product_id, quantite = 0, seuil_alerte = 1 } = data;

      const [result] = await pool.query(`
        INSERT INTO room_minibar (room_id, product_id, quantite, seuil_alerte) 
        VALUES (?, ?, ?, ?)
      `, [room_id, product_id, quantite, seuil_alerte]);

      return result.insertId;
    } catch (error) {
      console.error('❌ Erreur create RoomMinibar:', error);
      throw error;
    }
  }

  // Mettre à jour un produit du minibar
  static async update(id, data) {
    try {
      const updates = [];
      const values = [];

      const allowedFields = ['room_id', 'product_id', 'quantite', 'seuil_alerte'];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(data[field]);
        }
      }

      if (updates.length === 0) return false;

      values.push(id);
      const [result] = await pool.query(
        `UPDATE room_minibar SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur update RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Mettre à jour la quantité
  static async updateQuantity(id, quantite) {
    try {
      const [result] = await pool.query(
        'UPDATE room_minibar SET quantite = ? WHERE id = ?',
        [quantite, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur updateQuantity RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Augmenter la quantité
  static async addQuantity(id, quantite) {
    try {
      const [result] = await pool.query(
        'UPDATE room_minibar SET quantite = quantite + ? WHERE id = ?',
        [quantite, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur addQuantity RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Diminuer la quantité
  static async removeQuantity(id, quantite) {
    try {
      const [result] = await pool.query(
        'UPDATE room_minibar SET quantite = quantite - ? WHERE id = ?',
        [quantite, id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur removeQuantity RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Supprimer un produit du minibar
  static async delete(id) {
    try {
      const [result] = await pool.query('DELETE FROM room_minibar WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur delete RoomMinibar ${id}:`, error);
      throw error;
    }
  }

  // Vider le minibar d'une chambre
  static async deleteByRoomId(roomId) {
    try {
      const [result] = await pool.query('DELETE FROM room_minibar WHERE room_id = ?', [roomId]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`❌ Erreur deleteByRoomId RoomMinibar ${roomId}:`, error);
      throw error;
    }
  }

  // Vérifier si un produit existe déjà dans une chambre
  static async exists(roomId, productId) {
    try {
      const [rows] = await pool.query(
        'SELECT COUNT(*) as count FROM room_minibar WHERE room_id = ? AND product_id = ?',
        [roomId, productId]
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error('❌ Erreur exists RoomMinibar:', error);
      throw error;
    }
  }

  // Statistiques
  static async getStats() {
    try {
      const [rows] = await pool.query(`
        SELECT 
          COUNT(*) as total_produits,
          COUNT(DISTINCT room_id) as chambres_equipees,
          COUNT(DISTINCT product_id) as produits_differents,
          SUM(quantite) as quantite_totale,
          COUNT(CASE WHEN quantite <= seuil_alerte THEN 1 END) as alertes_stock
        FROM room_minibar
      `);
      return rows[0];
    } catch (error) {
      console.error('❌ Erreur getStats RoomMinibar:', error);
      throw error;
    }
  }
}

module.exports = RoomMinibar;