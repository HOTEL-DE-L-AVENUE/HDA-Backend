// src/Routes/auth.routes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../Config/connectDatabase');  // <-- CORRECTION ICI
const { authenticateToken } = require('../Middleware/auth.middleware');

// =============================================
// ROUTE DE LOGIN
// =============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Vérifier que les champs sont remplis
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis'
      });
    }

    // Vérifier dans la table admin
    const [admins] = await pool.query(
      'SELECT * FROM admin WHERE email = ?',
      [email]
    );

    let user = null;
    let userType = 'admin';

    if (admins.length > 0) {
      user = admins[0];
      userType = 'admin';
      
      // Vérifier le statut de l'admin
      if (user.statut !== 'actif') {
        return res.status(403).json({
          success: false,
          error: 'Compte administrateur inactif'
        });
      }
    } else {
      // Vérifier dans la table clients (si vous avez des clients)
      const [clients] = await pool.query(
        'SELECT * FROM clients WHERE email = ?',
        [email]
      );
      
      if (clients.length > 0) {
        user = clients[0];
        userType = 'client';
        
        if (user.statut !== 'ACTIF') {
          return res.status(403).json({
            success: false,
            error: 'Compte client inactif'
          });
        }
      } else {
        // Vérifier dans la table users (employés)
        const [users] = await pool.query(
          'SELECT * FROM users WHERE email = ?',
          [email]
        );
        
        if (users.length > 0) {
          user = users[0];
          userType = 'user';
          
          if (user.actif === 0) {
            return res.status(403).json({
              success: false,
              error: 'Compte utilisateur désactivé'
            });
          }
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier le mot de passe avec bcrypt
    let isPasswordValid = false;
    
    // Si le mot de passe est hashé avec bcrypt
    if (user.mot_de_passe && (user.mot_de_passe.startsWith('$2a$') || 
                              user.mot_de_passe.startsWith('$2b$') || 
                              user.mot_de_passe.startsWith('$2y$'))) {
      isPasswordValid = await bcrypt.compare(password, user.mot_de_passe);
    } else {
      // Si le mot de passe est en clair (pour test)
      isPasswordValid = password === user.mot_de_passe;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    // Préparer les données utilisateur pour le token
    const userData = {
      id: user.id_admin || user.id,
      nom: user.nom,
      prenom: user.prenom || '',
      email: user.email,
      type: userType,
      role: userType === 'admin' ? user.role : (userType === 'client' ? 'client' : user.role)
    };

    // Générer le token JWT avec une validité de 2 jours
    const token = jwt.sign(
      { 
        userId: userData.id, 
        email: userData.email, 
        type: userData.type,
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2d' } // 2 jours
    );

    // Retourner la réponse
    res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: {
        id: userData.id,
        nom: userData.nom,
        prenom: userData.prenom,
        email: userData.email,
        type: userData.type,
        role: userData.role,
        ...(userType === 'admin' && {
          statut: user.statut,
          date_creation: user.date_creation
        }),
        ...(userType === 'client' && {
          telephone: user.telephone,
          code_client: user.code_client,
          statut: user.statut
        })
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la connexion',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// =============================================
// ROUTE DE LOGOUT
// =============================================
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion'
    });
  }
});

// =============================================
// ROUTE POUR VÉRIFIER LE TOKEN
// =============================================
router.get('/verify-token', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
      message: 'Token valide'
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification du token'
    });
  }
});

// =============================================
// ROUTE POUR OBTENIR LE PROFIL
// =============================================
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    let user = null;
    
    if (req.user.type === 'admin') {
      const [rows] = await pool.query(
        'SELECT id_admin as id, nom, prenom, email, role, statut, date_creation FROM admin WHERE id_admin = ?',
        [req.user.id]
      );
      user = rows[0];
    } else if (req.user.type === 'client') {
      const [rows] = await pool.query(
        'SELECT id, nom, prenom, email, telephone, code_client, statut, is_casino_player FROM clients WHERE id = ?',
        [req.user.id]
      );
      user = rows[0];
    } else if (req.user.type === 'user') {
      const [rows] = await pool.query(
        'SELECT id, nom, prenom, email, role, actif FROM users WHERE id = ?',
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

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du profil'
    });
  }
});

// =============================================
// ROUTE POUR RAFRAÎCHIR LE TOKEN
// =============================================
router.post('/refresh-token', authenticateToken, async (req, res) => {
  try {
    // Générer un nouveau token
    const token = jwt.sign(
      { 
        userId: req.user.id, 
        email: req.user.email, 
        type: req.user.type,
        role: req.user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '2d' }
    );

    res.json({
      success: true,
      token,
      message: 'Token rafraîchi avec succès'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rafraîchissement du token'
    });
  }
});

// =============================================
// ROUTE POUR CHANGER LE MOT DE PASSE
// =============================================
router.post('/change-password', authenticateToken, async (req, res) => {
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
        'SELECT * FROM admin WHERE id_admin = ?',
        [req.user.id]
      );
      user = rows[0];
      tableName = 'admin';
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
    let isPasswordValid = false;
    if (user.mot_de_passe && (user.mot_de_passe.startsWith('$2a$') || 
                              user.mot_de_passe.startsWith('$2b$') || 
                              user.mot_de_passe.startsWith('$2y$'))) {
      isPasswordValid = await bcrypt.compare(currentPassword, user.mot_de_passe);
    } else {
      isPasswordValid = currentPassword === user.mot_de_passe;
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    const idField = req.user.type === 'admin' ? 'id_admin' : 'id';
    await pool.query(
      `UPDATE ${tableName} SET mot_de_passe = ? WHERE ${idField} = ?`,
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du changement de mot de passe'
    });
  }
});

module.exports = router;