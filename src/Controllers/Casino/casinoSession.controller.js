// src/Controllers/Casino/casinoSession.controller.js
const { pool } = require('../../Config/connectDatabase');

/**
 * Contrôleur des sessions de casino
 * Gère toutes les opérations CRUD pour la table casino_sessions
 */
class CasinoSessionController {

  /**
   * Récupérer toutes les sessions
   * GET /api/casino/sessions
   */
  async getAllSessions(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        ORDER BY cs.id DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get all casino sessions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sessions'
      });
    }
  }

  /**
   * Récupérer une session par ID
   * GET /api/casino/sessions/:id
   */
  async getSessionById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session non trouvée'
        });
      }

      return res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Get casino session by id error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de la session'
      });
    }
  }

  /**
   * Récupérer les sessions par caissier
   * GET /api/casino/sessions/cashier/:cashierId
   */
  async getSessionsByCashier(req, res) {
    try {
      const { cashierId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.cashier_id = ?
        ORDER BY cs.ouverture_at DESC`,
        [cashierId]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        cashierId: cashierId
      });
    } catch (error) {
      console.error('Get sessions by cashier error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sessions par caissier'
      });
    }
  }

  /**
   * Récupérer les sessions par utilisateur
   * GET /api/casino/sessions/user/:userId
   */
  async getSessionsByUser(req, res) {
    try {
      const { userId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.user_id = ?
        ORDER BY cs.ouverture_at DESC`,
        [userId]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        userId: userId
      });
    } catch (error) {
      console.error('Get sessions by user error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sessions par utilisateur'
      });
    }
  }

  /**
   * Récupérer les sessions actives (non fermées)
   * GET /api/casino/sessions/active
   */
  async getActiveSessions(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.fermeture_at IS NULL
        ORDER BY cs.ouverture_at DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get active sessions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sessions actives'
      });
    }
  }

  /**
   * Récupérer les sessions fermées
   * GET /api/casino/sessions/closed
   */
  async getClosedSessions(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.fermeture_at IS NOT NULL
        ORDER BY cs.fermeture_at DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get closed sessions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sessions fermées'
      });
    }
  }

  /**
   * Ouvrir une nouvelle session
   * POST /api/casino/sessions/open
   */
  async openSession(req, res) {
    try {
      const { cashier_id, fond_initial } = req.body;
      
      // Récupérer l'ID de l'utilisateur connecté depuis req.user
      const user_id = req.user.id;

      // Validation des champs
      if (!cashier_id) {
        return res.status(400).json({
          success: false,
          error: 'Le caissier est requis'
        });
      }

      if (!fond_initial || fond_initial < 0) {
        return res.status(400).json({
          success: false,
          error: 'Le fond initial doit être un nombre positif'
        });
      }

      // Vérifier si le caissier existe
      const [cashierExists] = await pool.query(
        'SELECT id, nom FROM casino_cashiers WHERE id = ?',
        [cashier_id]
      );

      if (cashierExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Caissier non trouvé'
        });
      }

      // Vérifier si le caissier a déjà une session ouverte
      const [existingSession] = await pool.query(
        'SELECT id FROM casino_sessions WHERE cashier_id = ? AND fermeture_at IS NULL',
        [cashier_id]
      );

      if (existingSession.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Ce caissier a déjà une session ouverte'
        });
      }

      // Vérifier si l'utilisateur existe
      const [userExists] = await pool.query(
        'SELECT id_admin FROM users WHERE id_admin = ?',
        [user_id]
      );

      if (userExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Insérer la nouvelle session
      const [result] = await pool.query(
        `INSERT INTO casino_sessions (cashier_id, user_id, ouverture_at, fond_initial) 
         VALUES (?, ?, NOW(), ?)`,
        [cashier_id, user_id, fond_initial]
      );

      // Récupérer la session créée
      const [newSession] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: '✅ Session ouverte avec succès',
        data: newSession[0]
      });

    } catch (error) {
      console.error('Open casino session error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'ouverture de la session'
      });
    }
  }

  /**
   * Fermer une session
   * POST /api/casino/sessions/:id/close
   */
  async closeSession(req, res) {
    try {
      const { id } = req.params;
      const { fond_final } = req.body;

      if (fond_final === undefined || fond_final < 0) {
        return res.status(400).json({
          success: false,
          error: 'Le fond final est requis et doit être un nombre positif'
        });
      }

      // Vérifier si la session existe
      const [existing] = await pool.query(
        'SELECT * FROM casino_sessions WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session non trouvée'
        });
      }

      // Vérifier si la session est déjà fermée
      if (existing[0].fermeture_at !== null) {
        return res.status(409).json({
          success: false,
          error: 'Cette session est déjà fermée'
        });
      }

      // Calculer l'écart (fond_final - fond_initial)
      const ecart = fond_final - existing[0].fond_initial;

      // Fermer la session
      await pool.query(
        `UPDATE casino_sessions 
         SET fermeture_at = NOW(), fond_final = ?, ecart = ? 
         WHERE id = ?`,
        [fond_final, ecart, id]
      );

      // Récupérer la session mise à jour
      const [updatedSession] = await pool.query(
        `SELECT 
          cs.id, 
          cs.cashier_id, 
          cs.user_id, 
          cs.ouverture_at, 
          cs.fermeture_at, 
          cs.fond_initial, 
          cs.fond_final, 
          cs.ecart,
          cc.nom as cashier_nom,
          u.nom as user_nom,
          u.prenom as user_prenom,
          DATE_FORMAT(cs.ouverture_at, '%Y-%m-%d %H:%i:%s') as ouverture_at_formatted,
          DATE_FORMAT(cs.fermeture_at, '%Y-%m-%d %H:%i:%s') as fermeture_at_formatted
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        LEFT JOIN users u ON cs.user_id = u.id_admin
        WHERE cs.id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Session fermée avec succès',
        data: updatedSession[0]
      });

    } catch (error) {
      console.error('Close casino session error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la fermeture de la session'
      });
    }
  }

  /**
   * Supprimer une session
   * DELETE /api/casino/sessions/:id
   */
  async deleteSession(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si la session existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_sessions WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session non trouvée'
        });
      }

      // Vérifier si des transactions sont associées à cette session
      const [transactions] = await pool.query(
        'SELECT id FROM casino_transactions WHERE session_id = ?',
        [id]
      );

      if (transactions.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Impossible de supprimer cette session car des transactions lui sont associées'
        });
      }

      await pool.query(
        'DELETE FROM casino_sessions WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Session supprimée avec succès'
      });

    } catch (error) {
      console.error('Delete casino session error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression de la session'
      });
    }
  }

  /**
   * Statistiques des sessions
   * GET /api/casino/sessions/stats
   */
  async getStats(req, res) {
    try {
      // Total des sessions
      const [total] = await pool.query('SELECT COUNT(*) as total FROM casino_sessions');
      
      // Sessions actives
      const [active] = await pool.query(
        'SELECT COUNT(*) as active FROM casino_sessions WHERE fermeture_at IS NULL'
      );

      // Sessions fermées
      const [closed] = await pool.query(
        'SELECT COUNT(*) as closed FROM casino_sessions WHERE fermeture_at IS NOT NULL'
      );

      // Total des fonds
      const [totalFonds] = await pool.query(
        'SELECT SUM(fond_initial) as total_fond_initial, SUM(fond_final) as total_fond_final, SUM(ecart) as total_ecart FROM casino_sessions'
      );

      // Sessions par caissier
      const [byCashier] = await pool.query(
        `SELECT 
          cc.nom as cashier_nom,
          COUNT(cs.id) as count,
          SUM(cs.ecart) as total_ecart
        FROM casino_sessions cs
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        GROUP BY cs.cashier_id
        ORDER BY count DESC`
      );

      // Sessions par utilisateur
      const [byUser] = await pool.query(
        `SELECT 
          CONCAT(u.nom, ' ', u.prenom) as user_name,
          COUNT(cs.id) as count,
          SUM(cs.ecart) as total_ecart
        FROM casino_sessions cs
        LEFT JOIN users u ON cs.user_id = u.id_admin
        GROUP BY cs.user_id
        ORDER BY count DESC`
      );

      return res.json({
        success: true,
        data: {
          total: total[0].total,
          active: active[0].active,
          closed: closed[0].closed,
          totalFonds: {
            fond_initial: totalFonds[0].total_fond_initial || 0,
            fond_final: totalFonds[0].total_fond_final || 0,
            ecart: totalFonds[0].total_ecart || 0
          },
          byCashier: byCashier,
          byUser: byUser
        }
      });

    } catch (error) {
      console.error('Get casino sessions stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
}

module.exports = new CasinoSessionController();