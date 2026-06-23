// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const pool = require('../config/database');

/**
 * Middleware d'authentification JWT
 * Vérifie le token et ajoute les informations utilisateur à req.user
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      error: "Token requis" 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user = null;
    let userType = null;
    let userRole = null;
    let id_agence = null;

    // Vérifier si l'utilisateur est un client
    if (decoded.type === 'client') {
      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          prenom, 
          email, 
          telephone, 
          code_client, 
          statut,
          is_casino_player,
          created_at, 
          updated_at 
        FROM clients 
        WHERE id = ?`,
        [parseInt(decoded.userId)]
      );
      
      user = rows[0] || null;
      userType = 'client';
      userRole = 'client';
      
      // Vérifier si le client est actif
      if (user && user.statut !== 'ACTIF') {
        return res.status(403).json({
          success: false,
          error: "Compte client inactif"
        });
      }
    } 
    // Vérifier si l'utilisateur est un user (admin, manager, chauffeur, etc.)
    else if (decoded.type === 'user') {
      const [rows] = await pool.query(
        `SELECT 
          id, 
          nom, 
          prenom, 
          email, 
          role, 
          actif,
          created_at, 
          updated_at 
        FROM users 
        WHERE id = ?`,
        [parseInt(decoded.userId)]
      );
      
      user = rows[0] || null;
      userType = 'user';
      userRole = user ? user.role.toLowerCase() : null;
      
      // Vérifier si l'utilisateur est actif
      if (user && user.actif === 0) {
        return res.status(403).json({
          success: false,
          error: "Compte utilisateur désactivé"
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Utilisateur introuvable"
      });
    }

    // Ajouter les informations utilisateur à req.user
    req.user = {
      id: user.id,
      nom: user.nom,
      prenom: user.prenom || null,
      email: user.email,
      type: userType,
      role: userRole,
      id_agence: id_agence, // null par défaut car pas dans votre table
      // Ajouter des champs spécifiques selon le type
      ...(userType === 'client' && {
        code_client: user.code_client,
        telephone: user.telephone,
        statut: user.statut,
        is_casino_player: user.is_casino_player === 1
      }),
      ...(userType === 'user' && {
        actif: user.actif === 1
      })
    };
    
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        error: "Token expiré"
      });
    }
    
    return res.status(403).json({
      success: false,
      error: "Token invalide"
    });
  }
}

/**
 * Middleware de vérification des rôles
 * @param {string|string[]} allowedRoles - Rôle(s) autorisé(s)
 * @returns {Function} Middleware Express
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentification requise'
      });
    }

    const userRole = req.user.role;
    const rolesArray = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // Convertir les rôles en minuscules pour la comparaison
    const normalizedRoles = rolesArray.map(role => role.toLowerCase());
    const normalizedUserRole = userRole ? userRole.toLowerCase() : '';

    // Admin a accès à tout
    if (normalizedUserRole === 'admin') {
      return next();
    }

    // Vérifier si le rôle de l'utilisateur est autorisé
    if (normalizedRoles.includes(normalizedUserRole)) {
      return next();
    }

    res.status(403).json({
      success: false,
      error: 'Accès non autorisé. Rôle requis: ' + rolesArray.join(', ')
    });
  };
}

/**
 * Middleware pour vérifier si l'utilisateur est un client
 */
function requireClient(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise'
    });
  }

  if (req.user.type !== 'client') {
    return res.status(403).json({
      success: false,
      error: 'Accès réservé aux clients'
    });
  }

  next();
}

/**
 * Middleware pour vérifier si l'utilisateur est un user (employé)
 */
function requireUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise'
    });
  }

  if (req.user.type !== 'user') {
    return res.status(403).json({
      success: false,
      error: 'Accès réservé aux employés'
    });
  }

  next();
}

module.exports = { 
  authenticateToken, 
  requireRole,
  requireClient,
  requireUser
};