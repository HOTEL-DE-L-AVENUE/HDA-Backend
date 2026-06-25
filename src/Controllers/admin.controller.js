// src/Controllers/admin.controller.js
const bcrypt = require('bcryptjs');
const { pool } = require('../Config/connectDatabase');

/**
 * Contrôleur des administrateurs
 */
class AdminController {

  /**
   * Créer un administrateur (PUBLIC - Pas de token requis)
   * POST /api/admin
   */
  async createAdmin(req, res) {
    try {
      const { nom, prenom, email, mot_de_passe, role = 'admin', statut = 'actif' } = req.body;

      // Validation des champs
      if (!nom || !prenom || !email || !mot_de_passe) {
        return res.status(400).json({
          success: false,
          error: 'Nom, prénom, email et mot de passe sont requis'
        });
      }

      // Validation du rôle
      const validRoles = ['admin', 'manager', 'receptioniste', 'caisse', 'water', 'housekeeping'];
      if (role && !validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Rôle invalide. Utilisez: ${validRoles.join(', ')}`
        });
      }

      // Vérifier si l'email existe déjà
      const [existing] = await pool.query(
        'SELECT id_admin FROM users WHERE email = ?',
        [email]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Cet email est déjà utilisé'
        });
      }

      // Hasher le mot de passe
      const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

      // Insérer le nouvel utilisateur dans la table users
      const [result] = await pool.query(
        `INSERT INTO users (nom, prenom, email, mot_de_passe, role, statut, date_creation) 
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [nom, prenom, email, hashedPassword, role, statut]
      );

      // Récupérer l'admin créé
      const [newAdmin] = await pool.query(
        `SELECT 
          id_admin, 
          nom, 
          prenom, 
          email, 
          role, 
          statut,
          date_creation,
          DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i:%s') as date_creation_formatted
        FROM users 
        WHERE id_admin = ?`,
        [result.insertId]
      );

      return res.status(201).json({
        success: true,
        message: '✅ Administrateur créé avec succès',
        data: newAdmin[0]
      });

    } catch (error) {
      console.error('Create admin error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de l\'administrateur'
      });
    }
  }

  /**
   * Récupérer tous les administrateurs
   * GET /api/admin
   * Requiert un token admin
   */
  async getAllAdmins(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT 
          id_admin, 
          nom, 
          prenom, 
          email, 
          role, 
          statut,
          date_creation,
          DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i:%s') as date_creation_formatted
        FROM users 
        ORDER BY date_creation DESC`
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length
      });
    } catch (error) {
      console.error('Get all admins error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des administrateurs'
      });
    }
  }

  /**
   * Récupérer un administrateur par ID
   * GET /api/admin/:id
   * Requiert un token admin
   */
  async getAdminById(req, res) {
    try {
      const { id } = req.params;

      const [rows] = await pool.query(
        `SELECT 
          id_admin, 
          nom, 
          prenom, 
          email, 
          role, 
          statut,
          date_creation,
          DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i:%s') as date_creation_formatted
        FROM users 
        WHERE id_admin = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Administrateur non trouvé'
        });
      }

      return res.json({
        success: true,
        data: rows[0]
      });
    } catch (error) {
      console.error('Get admin by id error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération de l\'administrateur'
      });
    }
  }

  /**
   * Mettre à jour un administrateur
   * PUT /api/admin/:id
   * Requiert un token admin
   */
  async updateAdmin(req, res) {
    try {
      const { id } = req.params;
      const { nom, prenom, email, role, statut, mot_de_passe } = req.body;

      // Vérifier si l'admin existe
      const [existing] = await pool.query(
        'SELECT * FROM users WHERE id_admin = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Administrateur non trouvé'
        });
      }

      // Validation du rôle si fourni
      if (role) {
        const validRoles = ['admin', 'manager', 'receptioniste', 'caisse', 'water', 'housekeeping'];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            success: false,
            error: `Rôle invalide. Utilisez: ${validRoles.join(', ')}`
          });
        }
      }

      // Vérifier si l'email est déjà utilisé par un autre admin
      if (email) {
        const [emailCheck] = await pool.query(
          'SELECT id_admin FROM users WHERE email = ? AND id_admin != ?',
          [email, id]
        );
        if (emailCheck.length > 0) {
          return res.status(409).json({
            success: false,
            error: 'Cet email est déjà utilisé par un autre administrateur'
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
      if (prenom) {
        updateFields.push('prenom = ?');
        values.push(prenom);
      }
      if (email) {
        updateFields.push('email = ?');
        values.push(email);
      }
      if (role) {
        updateFields.push('role = ?');
        values.push(role);
      }
      if (statut) {
        updateFields.push('statut = ?');
        values.push(statut);
      }
      if (mot_de_passe) {
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        updateFields.push('mot_de_passe = ?');
        values.push(hashedPassword);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Aucun champ à mettre à jour'
        });
      }

      values.push(id);
      const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id_admin = ?`;
      await pool.query(query, values);

      // Récupérer l'admin mis à jour
      const [updatedAdmin] = await pool.query(
        `SELECT 
          id_admin, 
          nom, 
          prenom, 
          email, 
          role, 
          statut,
          date_creation,
          DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i:%s') as date_creation_formatted
        FROM users 
        WHERE id_admin = ?`,
        [id]
      );

      return res.json({
        success: true,
        message: 'Administrateur mis à jour avec succès',
        data: updatedAdmin[0]
      });

    } catch (error) {
      console.error('Update admin error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de l\'administrateur'
      });
    }
  }

  /**
   * Supprimer un administrateur
   * DELETE /api/admin/:id
   * Requiert un token admin
   */
  async deleteAdmin(req, res) {
    try {
      const { id } = req.params;

      // Vérifier si l'admin existe
      const [existing] = await pool.query(
        'SELECT id_admin FROM users WHERE id_admin = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Administrateur non trouvé'
        });
      }

      // Empêcher la suppression de son propre compte (si authentifié)
      if (req.user && req.user.id === parseInt(id)) {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez pas supprimer votre propre compte'
        });
      }

      await pool.query(
        'DELETE FROM users WHERE id_admin = ?',
        [id]
      );

      return res.json({
        success: true,
        message: 'Administrateur supprimé avec succès'
      });

    } catch (error) {
      console.error('Delete admin error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression de l\'administrateur'
      });
    }
  }

  /**
   * Changer le statut d'un administrateur
   * PATCH /api/admin/:id/status
   * Requiert un token admin
   */
  async changeAdminStatus(req, res) {
    try {
      const { id } = req.params;
      const { statut } = req.body;

      if (!statut || !['actif', 'inactif'].includes(statut)) {
        return res.status(400).json({
          success: false,
          error: 'Statut invalide. Utilisez "actif" ou "inactif"'
        });
      }

      // Vérifier si l'admin existe
      const [existing] = await pool.query(
        'SELECT id_admin FROM users WHERE id_admin = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Administrateur non trouvé'
        });
      }

      // Empêcher la désactivation de son propre compte (si authentifié)
      if (req.user && req.user.id === parseInt(id) && statut === 'inactif') {
        return res.status(403).json({
          success: false,
          error: 'Vous ne pouvez pas désactiver votre propre compte'
        });
      }

      await pool.query(
        'UPDATE users SET statut = ? WHERE id_admin = ?',
        [statut, id]
      );

      return res.json({
        success: true,
        message: `Statut de l'administrateur changé à "${statut}"`
      });

    } catch (error) {
      console.error('Change admin status error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du changement de statut'
      });
    }
  }

  /**
   * Réinitialiser le mot de passe d'un administrateur
   * POST /api/admin/:id/reset-password
   * Requiert un token admin
   */
  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Le mot de passe doit contenir au moins 6 caractères'
        });
      }

      // Vérifier si l'admin existe
      const [existing] = await pool.query(
        'SELECT id_admin FROM users WHERE id_admin = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Administrateur non trouvé'
        });
      }

      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        'UPDATE users SET mot_de_passe = ? WHERE id_admin = ?',
        [hashedPassword, id]
      );

      return res.json({
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la réinitialisation du mot de passe'
      });
    }
  }

  /**
   * Vérifier si des admins existent
   * GET /api/admin/check
   * Route publique
   */
  async checkAdminsExist(req, res) {
    try {
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM users');
      
      return res.json({
        success: true,
        hasAdmins: rows[0].count > 0,
        count: rows[0].count
      });
    } catch (error) {
      console.error('Check admins error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification des administrateurs'
      });
    }
  }

  /**
   * Récupérer les admins par rôle
   * GET /api/admin/role/:role
   * Requiert un token admin
   */
  async getAdminsByRole(req, res) {
    try {
      const { role } = req.params;
      
      // Validation du rôle
      const validRoles = ['admin', 'manager', 'receptioniste', 'caisse', 'water', 'housekeeping'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `Rôle invalide. Utilisez: ${validRoles.join(', ')}`
        });
      }

      const [rows] = await pool.query(
        `SELECT 
          id_admin, 
          nom, 
          prenom, 
          email, 
          role, 
          statut,
          date_creation,
          DATE_FORMAT(date_creation, '%Y-%m-%d %H:%i:%s') as date_creation_formatted
        FROM users 
        WHERE role = ?
        ORDER BY date_creation DESC`,
        [role]
      );

      return res.json({
        success: true,
        data: rows,
        count: rows.length,
        role: role
      });
    } catch (error) {
      console.error('Get admins by role error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des administrateurs par rôle'
      });
    }
  }
}

module.exports = new AdminController();