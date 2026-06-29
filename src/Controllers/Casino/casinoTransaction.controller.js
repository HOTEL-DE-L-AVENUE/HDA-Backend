// src/Controllers/Casino/casinoTransaction.controller.js
const { pool } = require('../../Config/connectDatabase');

/**
 * Contrôleur des transactions de casino
 * Gère toutes les opérations CRUD pour la table casino_transactions
 */
class CasinoTransactionController {

  /**
   * Récupérer toutes les transactions
   * GET /api/casino/transactions
   */
  async getAllTransactions(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        ORDER BY ct.id DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get all casino transactions error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions'
      });
    }
  }

  /**
   * Récupérer une transaction par ID
   * GET /api/casino/transactions/:id
   */
  async getTransactionById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transaction non trouvée'
        });
      }

      return res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Get casino transaction by id error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de la transaction'
      });
    }
  }

  /**
   * Récupérer les transactions par session
   * GET /api/casino/transactions/session/:sessionId
   */
  async getTransactionsBySession(req, res) {
    try {
      const { sessionId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.session_id = ?
        ORDER BY ct.created_at DESC`,
        [sessionId]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        sessionId: sessionId
      });
    } catch (error) {
      console.error('Get transactions by session error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions par session'
      });
    }
  }

  /**
   * Récupérer les transactions par client
   * GET /api/casino/transactions/client/:clientId
   */
  async getTransactionsByClient(req, res) {
    try {
      const { clientId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.client_id = ?
        ORDER BY ct.created_at DESC`,
        [clientId]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        clientId: clientId
      });
    } catch (error) {
      console.error('Get transactions by client error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions par client'
      });
    }
  }

  /**
   * Récupérer les transactions par type
   * GET /api/casino/transactions/type/:type
   */
  async getTransactionsByType(req, res) {
    try {
      const { type } = req.params;

      const validTypes = ['ACHAT', 'VENTE', 'DEPOT', 'RETRAIT', 'GAIN', 'PERTE'];
      if (!validTypes.includes(type.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Type invalide. Utilisez: ${validTypes.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.type_transaction = ?
        ORDER BY ct.created_at DESC`,
        [type.toUpperCase()]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        type: type.toUpperCase()
      });
    } catch (error) {
      console.error('Get transactions by type error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions par type'
      });
    }
  }

  /**
   * Récupérer les transactions par moyen de paiement
   * GET /api/casino/transactions/payment/:moyen
   */
  async getTransactionsByPaymentMethod(req, res) {
    try {
      const { moyen } = req.params;

      const validMethods = ['ESPECES', 'CARTE', 'VIREMENT', 'CHIP', 'MOBILE_MONEY'];
      if (!validMethods.includes(moyen.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Moyen de paiement invalide. Utilisez: ${validMethods.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.moyen_paiement = ?
        ORDER BY ct.created_at DESC`,
        [moyen.toUpperCase()]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        moyen: moyen.toUpperCase()
      });
    } catch (error) {
      console.error('Get transactions by payment method error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions par moyen de paiement'
      });
    }
  }

  /**
   * Créer une nouvelle transaction
   * POST /api/casino/transactions
   */
  async createTransaction(req, res) {
    try {
      const { client_id, session_id, type_transaction, montant, moyen_paiement } = req.body;

      // Validation des champs
      if (!client_id) {
        return res.status(400).json({
          success: false,
          error: 'Le client est requis'
        });
      }

      if (!session_id) {
        return res.status(400).json({
          success: false,
          error: 'La session est requise'
        });
      }

      if (!type_transaction) {
        return res.status(400).json({
          success: false,
          error: 'Le type de transaction est requis'
        });
      }

      if (!montant || montant <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Le montant doit être un nombre positif'
        });
      }

      if (!moyen_paiement) {
        return res.status(400).json({
          success: false,
          error: 'Le moyen de paiement est requis'
        });
      }

      // Valider le type de transaction
      const validTypes = ['ACHAT', 'VENTE', 'DEPOT', 'RETRAIT', 'GAIN', 'PERTE'];
      if (!validTypes.includes(type_transaction.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Type de transaction invalide. Utilisez: ${validTypes.join(', ')}`
        });
      }

      // Valider le moyen de paiement
      const validMethods = ['ESPECES', 'CARTE', 'VIREMENT', 'CHIP', 'MOBILE_MONEY'];
      if (!validMethods.includes(moyen_paiement.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: `Moyen de paiement invalide. Utilisez: ${validMethods.join(', ')}`
        });
      }

      // Vérifier si le client existe
      const [clientExists] = await pool.query(
        'SELECT id, nom, prenom FROM clients WHERE id = ?',
        [client_id]
      );

      if (clientExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Client non trouvé'
        });
      }

      // Vérifier si la session existe et est active
      const [sessionExists] = await pool.query(
        'SELECT id, cashier_id FROM casino_sessions WHERE id = ? AND fermeture_at IS NULL',
        [session_id]
      );

      if (sessionExists.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Session non trouvée ou déjà fermée'
        });
      }

      // Insérer la nouvelle transaction
      const [result] = await pool.query(
        `INSERT INTO casino_transactions (client_id, session_id, type_transaction, montant, moyen_paiement, created_at) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [client_id, session_id, type_transaction.toUpperCase(), montant, moyen_paiement.toUpperCase()]
      );

      // Récupérer la transaction créée
      const [newTransaction] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.id = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: '✅ Transaction créée avec succès',
        data: newTransaction[0]
      });

    } catch (error) {
      console.error('Create casino transaction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la transaction'
      });
    }
  }

  /**
   * Mettre à jour une transaction
   * PUT /api/casino/transactions/:id
   */
  async updateTransaction(req, res) {
    try {
      const { id } = req.params;
      const { client_id, session_id, type_transaction, montant, moyen_paiement } = req.body;

      // Vérifier si la transaction existe
      const [existing] = await pool.query(
        'SELECT * FROM casino_transactions WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transaction non trouvée'
        });
      }

      // Valider le type de transaction si fourni
      if (type_transaction) {
        const validTypes = ['ACHAT', 'VENTE', 'DEPOT', 'RETRAIT', 'GAIN', 'PERTE'];
        if (!validTypes.includes(type_transaction.toUpperCase())) {
          return res.status(400).json({
            success: false,
            error: `Type de transaction invalide. Utilisez: ${validTypes.join(', ')}`
          });
        }
      }

      // Valider le moyen de paiement si fourni
      if (moyen_paiement) {
        const validMethods = ['ESPECES', 'CARTE', 'VIREMENT', 'CHIP', 'MOBILE_MONEY'];
        if (!validMethods.includes(moyen_paiement.toUpperCase())) {
          return res.status(400).json({
            success: false,
            error: `Moyen de paiement invalide. Utilisez: ${validMethods.join(', ')}`
          });
        }
      }

      // Vérifier si le client existe (si fourni)
      if (client_id) {
        const [clientExists] = await pool.query(
          'SELECT id FROM clients WHERE id = ?',
          [client_id]
        );
        if (clientExists.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Client non trouvé'
          });
        }
      }

      // Vérifier si la session existe (si fournie)
      if (session_id) {
        const [sessionExists] = await pool.query(
          'SELECT id FROM casino_sessions WHERE id = ?',
          [session_id]
        );
        if (sessionExists.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Session non trouvée'
          });
        }
      }

      // Construire la requête de mise à jour
      let updateFields = [];
      let values = [];

      if (client_id) {
        updateFields.push('client_id = ?');
        values.push(client_id);
      }
      if (session_id) {
        updateFields.push('session_id = ?');
        values.push(session_id);
      }
      if (type_transaction) {
        updateFields.push('type_transaction = ?');
        values.push(type_transaction.toUpperCase());
      }
      if (montant) {
        updateFields.push('montant = ?');
        values.push(montant);
      }
      if (moyen_paiement) {
        updateFields.push('moyen_paiement = ?');
        values.push(moyen_paiement.toUpperCase());
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Aucun champ à mettre à jour'
        });
      }

      values.push(id);
      const query = `UPDATE casino_transactions SET ${updateFields.join(', ')} WHERE id = ?`;
      await pool.query(query, values);

      // Récupérer la transaction mise à jour
      const [updatedTransaction] = await pool.query(
        `SELECT 
          ct.id, 
          ct.client_id, 
          ct.session_id, 
          ct.type_transaction, 
          ct.montant, 
          ct.moyen_paiement, 
          ct.created_at,
          c.nom as client_nom,
          c.prenom as client_prenom,
          c.code_client,
          cc.nom as cashier_nom,
          DATE_FORMAT(ct.created_at, '%Y-%m-%d %H:%i:%s') as created_at_formatted
        FROM casino_transactions ct
        LEFT JOIN clients c ON ct.client_id = c.id
        LEFT JOIN casino_sessions cs ON ct.session_id = cs.id
        LEFT JOIN casino_cashiers cc ON cs.cashier_id = cc.id
        WHERE ct.id = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Transaction mise à jour avec succès',
        data: updatedTransaction[0]
      });

    } catch (error) {
      console.error('Update casino transaction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de la transaction'
      });
    }
  }

  /**
   * Supprimer une transaction
   * DELETE /api/casino/transactions/:id
   */
  async deleteTransaction(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si la transaction existe
      const [existing] = await pool.query(
        'SELECT id FROM casino_transactions WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Transaction non trouvée'
        });
      }

      await pool.query(
        'DELETE FROM casino_transactions WHERE id = ?',
        [id]
      );

      return res.json({
        success: true,
        message: '✅ Transaction supprimée avec succès'
      });

    } catch (error) {
      console.error('Delete casino transaction error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression de la transaction'
      });
    }
  }

  /**
   * Statistiques des transactions
   * GET /api/casino/transactions/stats
   */
  async getStats(req, res) {
    try {
      // Total des transactions
      const [total] = await pool.query('SELECT COUNT(*) as total FROM casino_transactions');
      
      // Total par type
      const [byType] = await pool.query(
        `SELECT 
          type_transaction as type, 
          COUNT(*) as count,
          SUM(montant) as total_montant
        FROM casino_transactions 
        GROUP BY type_transaction`
      );

      // Total par moyen de paiement
      const [byPayment] = await pool.query(
        `SELECT 
          moyen_paiement as moyen, 
          COUNT(*) as count,
          SUM(montant) as total_montant
        FROM casino_transactions 
        GROUP BY moyen_paiement`
      );

      // Total des montants
      const [totals] = await pool.query(
        `SELECT 
          SUM(montant) as total_general,
          SUM(CASE WHEN type_transaction IN ('ACHAT', 'DEPOT') THEN montant ELSE 0 END) as total_entrees,
          SUM(CASE WHEN type_transaction IN ('VENTE', 'RETRAIT', 'PERTE') THEN montant ELSE 0 END) as total_sorties
        FROM casino_transactions`
      );

      // Transactions par jour (derniers 7 jours)
      const [byDay] = await pool.query(
        `SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(montant) as total_montant
        FROM casino_transactions 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date DESC`
      );

      return res.json({
        success: true,
        data: {
          total: total[0].total,
          byType: byType,
          byPayment: byPayment,
          totals: {
            total_general: totals[0].total_general || 0,
            total_entrees: totals[0].total_entrees || 0,
            total_sorties: totals[0].total_sorties || 0
          },
          byDay: byDay
        }
      });

    } catch (error) {
      console.error('Get casino transactions stats error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  /**
   * Résumé des transactions d'une session
   * GET /api/casino/transactions/session/:sessionId/summary
   */
  async getSessionSummary(req, res) {
    try {
      const { sessionId } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          type_transaction,
          COUNT(*) as count,
          SUM(montant) as total_montant,
          AVG(montant) as moyenne
        FROM casino_transactions 
        WHERE session_id = ?
        GROUP BY type_transaction`,
        [sessionId]
      );

      const [totals] = await pool.query(
        `SELECT 
          SUM(montant) as total,
          SUM(CASE WHEN type_transaction IN ('ACHAT', 'DEPOT', 'GAIN') THEN montant ELSE 0 END) as total_entrees,
          SUM(CASE WHEN type_transaction IN ('VENTE', 'RETRAIT', 'PERTE') THEN montant ELSE 0 END) as total_sorties
        FROM casino_transactions 
        WHERE session_id = ?`,
        [sessionId]
      );

      return res.json({
        success: true,
        data: {
          sessionId: sessionId,
          summary: rows,
          totals: {
            total: totals[0].total || 0,
            total_entrees: totals[0].total_entrees || 0,
            total_sorties: totals[0].total_sorties || 0
          }
        }
      });

    } catch (error) {
      console.error('Get session summary error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du résumé de la session'
      });
    }
  }
}

module.exports = new CasinoTransactionController();