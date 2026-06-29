// src/Controllers/Casino/casinoRoom.controller.js
const { pool } = require('../../Config/connectDatabase');

/**
 * Contrôleur des salles de casino
 * Gère toutes les opérations CRUD pour la table casino_rooms
 */
class CasinoRoomController {

  /**
   * Récupérer toutes les salles de casino
   * GET /api/casino/rooms
   */
  async getAllRooms(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        ORDER BY id DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get all casino rooms error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des salles de casino'
      });
    }
  }

  /**
   * Récupérer une salle de casino par ID
   * GET /api/casino/rooms/:id
   */
  async getRoomById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Salle de casino non trouvée'
        });
      }

      return res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Get casino room by id error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de la salle de casino'
      });
    }
  }

  /**
   * Créer une nouvelle salle de casino
   * POST /api/casino/rooms
   */
  async createRoom(req, res) {
    try {
      const { nom, type_salle, statut = 'OUVERTE' } = req.body;

      // Validation des champs
      if (!nom) {
        return res.status(400).json({
          success: false,
          error: 'Le nom de la salle est requis'
        });
      }

      // Valider le type de salle
      const validTypes = ['POKER', 'BLACKJACK', 'ROULETTE', 'SLOTS', 'VIP', 'GENERAL'];
      if (type_salle && !validTypes.includes(type_salle.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Type de salle invalide. Utilisez: ${validTypes.join(', ')}`
        });
      }

      // Valider le statut
      const validStatus = ['OUVERTE', 'FERMEE', 'MAINTENANCE'];
      if (statut && !validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      // Vérifier si une salle avec le même nom existe déjà
      const [existing] = await pool.query(
        'SELECT id FROM casino_rooms WHERE nom = ?',
        [nom]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Une salle avec ce nom existe déjà'
        });
      }

      // Insérer la nouvelle salle
      const [result] = await pool.query(
        `INSERT INTO casino_rooms (nom, type_salle, statut, created_at, updated_at) 
         VALUES (?, ?, ?, NOW(), NOW())`,
        [nom, type_salle || 'GENERAL', statut.toUpperCase()]
      );

      // Récupérer la salle créée
      const [newRoom] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: '✅ Salle de casino créée avec succès',
        data: newRoom[0]
      });

    } catch (error) {
      console.error('Create casino room error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la salle de casino'
      });
    }
  }

  /**
   * Mettre à jour une salle de casino
   * PUT /api/casino/rooms/:id
   */
  async updateRoom(req, res) {
    try {
      const { id } = req.params;
      const { nom, type_salle, statut } = req.body;

      // Vérifier si la salle existe
      const [existing] = await pool.query(
        'SELECT * FROM casino_rooms WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Salle de casino non trouvée'
        });
      }

      // Valider le type de salle si fourni
      if (type_salle) {
        const validTypes = ['POKER', 'BLACKJACK', 'ROULETTE', 'SLOTS', 'VIP', 'GENERAL'];
        if (!validTypes.includes(type_salle.toUpperCase())) {
          return res.status(400).json({
            success: false,
            error: `Type de salle invalide. Utilisez: ${validTypes.join(', ')}`
          });
        }
      }

      // Valider le statut si fourni
      if (statut) {
        const validStatus = ['OUVERTE', 'FERMEE', 'MAINTENANCE'];
        if (!validStatus.includes(statut.toUpperCase())) {
          return res.status(400).json({
            success: false,
            error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
          });
        }
      }

      // Vérifier si le nom est déjà utilisé par une autre salle
      if (nom) {
        const [nameCheck] = await pool.query(
          'SELECT id FROM casino_rooms WHERE nom = ? AND id != ?',
          [nom, id]
        );
        if (nameCheck.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Une salle avec ce nom existe déjà'
          });
        }
      }

      // Construire la requête de mise à jour
      let updateFields = [];
      let values = [];

      if (nom) {
        updateFields.push('nom = ?');
        values.push(nom);
      }
      if (type_salle) {
        updateFields.push('type_salle = ?');
        values.push(type_salle.toUpperCase());
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

      updateFields.push('updated_at = NOW()');
      values.push(id);

      const query = `UPDATE casino_rooms SET ${updateFields.join(', ')} WHERE id = ?`;
      await pool.query(query, values);

      // Récupérer la salle mise à jour
      const [updatedRoom] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Salle de casino mise à jour avec succès',
        data: updatedRoom[0]
      });

    } catch (error) {
      console.error('Update casino room error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de la salle de casino'
      });
    }
  }

  /**
   * Supprimer une salle de casino
   * DELETE /api/casino/rooms/:id
   */
  async deleteRoom(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si la salle existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_rooms WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Salle de casino non trouvée'
        });
      }

      // Vérifier si des caissiers sont associés à cette salle
      const [cashiers] = await pool.query(
        'SELECT id FROM casino_cashiers WHERE room_id = ?',
        [id]
      );

      if (cashiers.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de supprimer cette salle car des caissiers y sont associés'
        });
      }

      // Vérifier si des visites sont associées à cette salle
      const [visits] = await pool.query(
        'SELECT id FROM casino_visits WHERE room_id = ?',
        [id]
      );

      if (visits.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de supprimer cette salle car des visites y sont associées'
        });
      }

      await pool.query(
        'DELETE FROM casino_rooms WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Salle de casino supprimée avec succès'
      });

    } catch (error) {
      console.error('Delete casino room error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression de la salle de casino'
      });
    }
  }

  /**
   * Changer le statut d'une salle de casino
   * PATCH /api/casino/rooms/:id/status
   */
  async changeRoomStatus(req, res) {
    try {
      const { id } = req.params;
      const { statut } = req.body;

      if (!statut) {
        return res.status(400).json({
          success: false,
          error: 'Le statut est requis'
        });
      }

      const validStatus = ['OUVERTE', 'FERMEE', 'MAINTENANCE'];
      if (!validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      // Vérifier si la salle existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_rooms WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Salle de casino non trouvée'
        });
      }

      await pool.query(
        'UPDATE casino_rooms SET statut = ?, updated_at = NOW() WHERE id = ?',
        [statut.toUpperCase(), id]
      );

      // Récupérer la salle mise à jour
      const [updatedRoom] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: `✅ Statut de la salle changé à "${statut}"`,
        data: updatedRoom[0]
      });

    } catch (error) {
      console.error('Change casino room status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du changement de statut'
      });
    }
  }

  /**
   * Récupérer les salles par type
   * GET /api/casino/rooms/type/:type
   */
  async getRoomsByType(req, res) {
    try {
      const { type } = req.params;

      const validTypes = ['POKER', 'BLACKJACK', 'ROULETTE', 'SLOTS', 'VIP', 'GENERAL'];
      if (!validTypes.includes(type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Type invalide. Utilisez: ${validTypes.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE type_salle = ?
        ORDER BY nom`,
        [type.toUpperCase()]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        type: type.toUpperCase()
      });

    } catch (error) {
      console.error('Get rooms by type error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des salles par type'
      });
    }
  }

  /**
   * Récupérer les salles par statut
   * GET /api/casino/rooms/status/:statut
   */
  async getRoomsByStatus(req, res) {
    try {
      const { statut } = req.params;

      const validStatus = ['OUVERTE', 'FERMEE', 'MAINTENANCE'];
      if (!validStatus.includes(statut.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Statut invalide. Utilisez: ${validStatus.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          type_salle as typeSalle, 
          statut,
          DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted,
          DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at_formatted
        FROM casino_rooms 
        WHERE statut = ?
        ORDER BY nom`,
        [statut.toUpperCase()]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        statut: statut.toUpperCase()
      });

    } catch (error) {
      console.error('Get rooms by status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des salles par statut'
      });
    }
  }

  /**
   * Statistiques des salles
   * GET /api/casino/rooms/stats
   */
  async getStats(req, res) {
    try {
      const [total] = await pool.query('SELECT COUNT(*) as total FROM casino_rooms');
      
      const [byType] = await pool.query(
        `SELECT 
          type_salle as type, 
          COUNT(*) as count 
        FROM casino_rooms 
        GROUP BY type_salle`
      );

      const [byStatus] = await pool.query(
        `SELECT 
          statut, 
          COUNT(*) as count 
        FROM casino_rooms 
        GROUP BY statut`
      );

      return res.json({
        success: true,
        data: {
          total: total[0].total,
          byType: byType,
          byStatus: byStatus
        }
      });

    } catch (error) {
      console.error('Get casino rooms stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new CasinoRoomController();