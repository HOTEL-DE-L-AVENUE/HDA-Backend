// src/Controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../Config/connectDatabase');

/**
 * Contrôleur d'authentification
 * Gère toutes les opérations liées à l'authentification
 */
class AuthController {
  
  /**
   * Connexion d'un utilisateur
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Vérifier que les champs sont remplis
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email et mot de passe requis'
        });
      }

      // Rechercher l'utilisateur dans les différentes tables
      const user = await this.findUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
      }

      // Vérifier le statut du compte
      const isAccountActive = this.checkAccountStatus(user);
      if (!isAccountActive) {
        return res.status(403).json({
          success: false,
          error: 'Compte inactif'
        });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await this.verifyPassword(password, user.mot_de_passe);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Email ou mot de passe incorrect'
        });
      }

      // Générer le token
      const token = this.generateToken(user);

      // Retourner la réponse
      return res.json({
        success: true,
        message: 'Connexion réussie',
        token,
        user: this.formatUserData(user)
      });

    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la connexion',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Déconnexion d'un utilisateur
   * POST /api/auth/logout
   */
  async logout(req, res) {
    try {
      // Le client doit simplement supprimer le token de son stockage
      // On peut logger l'action de déconnexion si nécessaire
      return res.json({
        success: true,
        message: 'Déconnexion réussie'
      });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la déconnexion'
      });
    }
  }

  /**
   * Vérification du token
   * GET /api/auth/verify-token
   */
  async verifyToken(req, res) {
    try {
      return res.json({
        success: true,
        user: req.user,
        message: 'Token valide'
      });
    } catch (error) {
      console.error('Verify token error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification du token'
      });
    }
  }

  /**
   * Récupération du profil utilisateur
   * GET /api/auth/profile
   */
  async getProfile(req, res) {
    try {
      let user = null;
      
      if (req.user.type === 'admin') {
        const [rows] = await pool.query(
          'SELECT id_admin as id, nom, prenom, email, role, statut, date_creation FROM users WHERE id_admin = ?',
          [req.user.id]
        );
        user = rows[0];
      } else if (req.user.type === 'client') {
        const [rows] = await pool.query(
          'SELECT id, nom, prenom, email, telephone, code_client, statut, is_casino_player, created_at, updated_at FROM clients WHERE id = ?',
          [req.user.id]
        );
        user = rows[0];
      } else if (req.user.type === 'user') {
        const [rows] = await pool.query(
          'SELECT id, nom, prenom, email, role, actif, created_at, updated_at FROM users WHERE id = ?',
          [req.user.id]
        );
        user = rows[0];
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      return res.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('Profile error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du profil'
      });
    }
  }

  /**
   * Rafraîchir le token
   * POST /api/auth/refresh-token
   */
  async refreshToken(req, res) {
    try {
      // Vérifier que l'utilisateur est authentifié
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentification requise'
        });
      }

      // Générer un nouveau token
      const token = this.generateToken({
        id: req.user.id,
        email: req.user.email,
        type: req.user.type,
        role: req.user.role
      });

      return res.json({
        success: true,
        token,
        message: 'Token rafraîchi avec succès'
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du rafraîchissement du token'
      });
    }
  }

  /**
   * Changement de mot de passe
   * POST /api/auth/change-password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Mot de passe actuel et nouveau mot de passe requis'
        });
      }

      // Récupérer l'utilisateur avec son mot de passe
      let user = null;
      let tableName = '';
      
      if (req.user.type === 'admin') {
        const [rows] = await pool.query(
          'SELECT * FROM users WHERE id_admin = ?',
          [req.user.id]
        );
        user = rows[0];
        tableName = 'users';
      } else if (req.user.type === 'client') {
        const [rows] = await pool.query(
          'SELECT * FROM clients WHERE id = ?',
          [req.user.id]
        );
        user = rows[0];
        tableName = 'clients';
      } else if (req.user.type === 'user') {
        const [rows] = await pool.query(
          'SELECT * FROM users WHERE id = ?',
          [req.user.id]
        );
        user = rows[0];
        tableName = 'users';
      }

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }

      // Vérifier le mot de passe actuel
      const isPasswordValid = await this.verifyPassword(currentPassword, user.mot_de_passe);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Mot de passe actuel incorrect'
        });
      }

      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Mettre à jour le mot de passe
      const idField = req.user.type === 'users' ? 'id_admin' : 'id';
      await pool.query(
        `UPDATE ${tableName} SET mot_de_passe = ? WHERE ${idField} = ?`,
        [hashedPassword, req.user.id]
      );

      return res.json({
        success: true,
        message: 'Mot de passe modifié avec succès'
      });
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors du changement de mot de passe'
      });
    }
  }

  // ==================== MÉTHODES PRIVÉES ====================

  /**
   * Recherche un utilisateur par email dans toutes les tables
   */
  async findUserByEmail(email) {
    // Chercher dans users
    const [admins] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (admins.length > 0) {
      return { ...admins[0], type: 'admin' };
    }

    // Chercher dans clients
    const [clients] = await pool.query(
      'SELECT * FROM clients WHERE email = ?',
      [email]
    );
    if (clients.length > 0) {
      return { ...clients[0], type: 'client' };
    }

    // Chercher dans users
    const [users] = await pool.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    if (users.length > 0) {
      return { ...users[0], type: 'user' };
    }

    return null;
  }

  /**
   * Vérifie le statut du compte
   */
  checkAccountStatus(user) {
    if (user.type === 'admin') {
      return user.statut === 'actif';
    } else if (user.type === 'client') {
      return user.statut === 'ACTIF';
    } else if (user.type === 'user') {
      return user.actif === 1;
    }
    return false;
  }

  /**
   * Vérifie le mot de passe (hashé ou en clair)
   */
  async verifyPassword(inputPassword, storedPassword) {
    // Si le mot de passe est hashé avec bcrypt
    if (storedPassword && (storedPassword.startsWith('$2a$') || 
                           storedPassword.startsWith('$2b$') || 
                           storedPassword.startsWith('$2y$'))) {
      return await bcrypt.compare(inputPassword, storedPassword);
    }
    // Si le mot de passe est en clair (pour test)
    return inputPassword === storedPassword;
  }

  /**
   * Génère un token JWT
   */
  generateToken(user) {
    const userData = {
      id: user.id_admin || user.id,
      email: user.email,
      type: user.type,
      role: user.type === 'admin' ? user.role : (user.type === 'client' ? 'client' : (user.role || 'user'))
    };

    return jwt.sign(
      { 
        userId: userData.id, 
        email: userData.email, 
        type: userData.type,
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2d' } // 2 jours
    );
  }

  /**
   * Formate les données utilisateur pour la réponse
   */
  formatUserData(user) {
    const userData = {
      id: user.id_admin || user.id,
      nom: user.nom,
      prenom: user.prenom || '',
      email: user.email,
      type: user.type,
      role: user.type === 'admin' ? user.role : (user.type === 'client' ? 'client' : (user.role || 'user'))
    };

    // Ajouter les champs spécifiques
    if (user.type === 'admin') {
      return {
        ...userData,
        statut: user.statut,
        date_creation: user.date_creation
      };
    } else if (user.type === 'client') {
      return {
        ...userData,
        telephone: user.telephone,
        code_client: user.code_client,
        statut: user.statut,
        is_casino_player: user.is_casino_player === 1
      };
    } else if (user.type === 'user') {
      return {
        ...userData,
        actif: user.actif === 1,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    }

    return userData;
  }
}

module.exports = new AuthController();