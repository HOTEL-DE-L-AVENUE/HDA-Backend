// src/Controllers/Casino/casinoCashier.controller.js
const { pool } = require('../../Config/connectDatabase');

/**
 * Contrôleur des caissiers de casino
 * Gère toutes les opérations CRUD pour la table casino_cashiers
 */
class CasinoCashierController {

  /**
   * Récupérer tous les caissiers
   * GET /api/casino/cashiers
   */
  async getAllCashiers(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        ORDER BY cc.id DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get all casino cashiers error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des caissiers'
      });
    }
  }

  /**
   * Récupérer un caissier par ID
   * GET /api/casino/cashiers/:id
   */
  async getCashierById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Caissier non trouvé'
        });
      }

      return res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Get casino cashier by id error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du caissier'
      });
    }
  }

  /**
   * Récupérer les caissiers par salle
   * GET /api/casino/cashiers/room/:roomId
   */
  async getCashiersByRoom(req, res) {
    try {
      const { roomId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.room_id = ?
        ORDER BY cc.nom`,
        [roomId]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        roomId: roomId
      });
    } catch (error) {
      console.error('Get cashiers by room error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des caissiers par salle'
      });
    }
  }

  /**
   * Créer un nouveau caissier
   * POST /api/casino/cashiers
   */
  async createCashier(req, res) {
    try {
      const { room_id, nom, statut = 'ACTIF' } = req.body;

      // Validation des champs
      if (!nom) {
        return res.status(400).json({
          success: false,
          error: 'Le nom du caissier est requis'
        });
      }

      if (!room_id) {
        return res.status(400).json({
          success: false,
          error: 'La salle est requise'
        });
      }

      // Vérifier si la salle existe
      const [roomExists] = await pool.query(
        'SELECT id FROM casino_rooms WHERE id = ?',
        [room_id]
      );

      if (roomExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'La salle spécifiée n\'existe pas'
        });
      }

      // Valider le statut
      const validStatus = ['ACTIF', 'INACTIF', 'EN_PAUSE'];
      if (statut && !validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      // Vérifier si un caissier avec le même nom existe déjà dans la même salle
      const [existing] = await pool.query(
        'SELECT id FROM casino_cashiers WHERE nom = ? AND room_id = ?',
        [nom, room_id]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Un caissier avec ce nom existe déjà dans cette salle'
        });
      }

      // Insérer le nouveau caissier
      const [result] = await pool.query(
        `INSERT INTO casino_cashiers (room_id, nom, statut) 
         VALUES (?, ?, ?)`,
        [room_id, nom, statut.toUpperCase()]
      );

      // Récupérer le caissier créé
      const [newCashier] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: '✅ Caissier créé avec succès',
        data: newCashier[0]
      });

    } catch (error) {
      console.error('Create casino cashier error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du caissier'
      });
    }
  }

  /**
   * Mettre à jour un caissier
   * PUT /api/casino/cashiers/:id
   */
  async updateCashier(req, res) {
    try {
      const { id } = req.params;
      const { room_id, nom, statut } = req.body;

      // Vérifier si le caissier existe
      const [existing] = await pool.query(
        'SELECT * FROM casino_cashiers WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Caissier non trouvé'
        });
      }

      // Vérifier si la salle existe (si room_id est fourni)
      if (room_id) {
        const [roomExists] = await pool.query(
          'SELECT id FROM casino_rooms WHERE id = ?',
          [room_id]
        );

        if (roomExists.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'La salle spécifiée n\'existe pas'
          });
        }
      }

      // Valider le statut si fourni
      if (statut) {
        const validStatus = ['ACTIF', 'INACTIF', 'EN_PAUSE'];
        if (!validStatus.includes(statut.toUpperCase())) {
          return res.status(400).json({
            success: false,
            error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
          });
        }
      }

      // Vérifier si le nom est déjà utilisé par un autre caissier dans la même salle
      if (nom && room_id) {
        const [nameCheck] = await pool.query(
          'SELECT id FROM casino_cashiers WHERE nom = ? AND room_id = ? AND id != ?',
          [nom, room_id, id]
        );
        if (nameCheck.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Un caissier avec ce nom existe déjà dans cette salle'
          });
        }
      }

      // Construire la requête de mise à jour
      let updateFields = [];
      let values = [];

      if (room_id) {
        updateFields.push('room_id = ?');
        values.push(room_id);
      }
      if (nom) {
        updateFields.push('nom = ?');
        values.push(nom);
      }
      if (statut) {
        updateFields.push('statut = ?');
        values.push(statut.toUpperCase());
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Aucun champ à mettre à jour'
        });
      }

      values.push(id);
      const query = `UPDATE casino_cashiers SET ${updateFields.join(', ')} WHERE id = ?`;
      await pool.query(query, values);

      // Récupérer le caissier mis à jour
      const [updatedCashier] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Caissier mis à jour avec succès',
        data: updatedCashier[0]
      });

    } catch (error) {
      console.error('Update casino cashier error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour du caissier'
      });
    }
  }

  /**
   * Supprimer un caissier
   * DELETE /api/casino/cashiers/:id
   */
  async deleteCashier(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si le caissier existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_cashiers WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Caissier non trouvé'
        });
      }

      // Vérifier si des sessions sont associées à ce caissier
      const [sessions] = await pool.query(
        'SELECT id FROM casino_sessions WHERE cashier_id = ?',
        [id]
      );

      if (sessions.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de supprimer ce caissier car des sessions lui sont associées'
        });
      }

      await pool.query(
        'DELETE FROM casino_cashiers WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Caissier supprimé avec succès'
      });

    } catch (error) {
      console.error('Delete casino cashier error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du caissier'
      });
    }
  }

  /**
   * Changer le statut d'un caissier
   * PATCH /api/casino/cashiers/:id/status
   */
  async changeCashierStatus(req, res) {
    try {
      const { id } = req.params;
      const { statut } = req.body;

      if (!statut) {
        return res.status(400).json({
          success: false,
          error: 'Le statut est requis'
        });
      }

      const validStatus = ['ACTIF', 'INACTIF', 'EN_PAUSE'];
      if (!validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      // Vérifier si le caissier existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_cashiers WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Caissier non trouvé'
        });
      }

      await pool.query(
        'UPDATE casino_cashiers SET statut = ? WHERE id = ?',
        [statut.toUpperCase(), id]
      );

      // Récupérer le caissier mis à jour
      const [updatedCashier] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: `✅ Statut du caissier changé à "${statut}"`,
        data: updatedCashier[0]
      });

    } catch (error) {
      console.error('Change casino cashier status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du changement de statut'
      });
    }
  }

  /**
   * Récupérer les caissiers par statut
   * GET /api/casino/cashiers/status/:statut
   */
  async getCashiersByStatus(req, res) {
    try {
      const { statut } = req.params;

      const validStatus = ['ACTIF', 'INACTIF', 'EN_PAUSE'];
      if (!validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          cc.id, 
          cc.room_id, 
          cc.nom, 
          cc.statut,
          cr.nom as room_nom,
          cr.type_salle as room_type
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        WHERE cc.statut = ?
        ORDER BY cc.nom`,
        [statut.toUpperCase()]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        statut: statut.toUpperCase()
      });

    } catch (error) {
      console.error('Get cashiers by status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des caissiers par statut'
      });
    }
  }

  /**
   * Statistiques des caissiers
   * GET /api/casino/cashiers/stats
   */
  async getStats(req, res) {
    try {
      const [total] = await pool.query('SELECT COUNT(*) as total FROM casino_cashiers');
      
      const [byStatus] = await pool.query(
        `SELECT 
          statut, 
          COUNT(*) as count 
        FROM casino_cashiers 
        GROUP BY statut`
      );

      const [byRoom] = await pool.query(
        `SELECT 
          cr.nom as room_name,
          COUNT(cc.id) as count 
        FROM casino_cashiers cc
        LEFT JOIN casino_rooms cr ON cc.room_id = cr.id
        GROUP BY cc.room_id
        ORDER BY count DESC`
      );

      return res.json({
        success: true,
        data: {
          total: total[0].total,
          byStatus: byStatus,
          byRoom: byRoom
        }
      });

    } catch (error) {
      console.error('Get casino cashiers stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new CasinoCashierController();