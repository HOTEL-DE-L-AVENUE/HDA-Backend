const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");

/**
 * Middleware d'authentification JWT
 * Vérifie le token et ajoute les informations utilisateur à req.user
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, error: "Token requis" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let user = null;
    let userType = null;
    let userRole = null;
    let id_agence = null;

    // Vérifier si l'utilisateur est un client
    if (decoded.type === 'client') {
      user = await prisma.clients.findUnique({
        where: { id: parseInt(decoded.userId) },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          telephone: true,
          code_client: true,
          statut: true,
          created_at: true,
          updated_at: true
        }
      });
      userType = 'client';
      userRole = 'client';
    } 
    // Vérifier si l'utilisateur est un user (admin, manager, etc.)
    else if (decoded.type === 'user') {
      user = await prisma.users.findUnique({
        where: { id: parseInt(decoded.userId) },
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          role: true,
          actif: true,
          created_at: true,
          updated_at: true
        }
      });
      userType = 'user';
      userRole = user ? user.role.toLowerCase() : null;
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Utilisateur introuvable"
      });
    }

    // Vérifier si l'utilisateur est actif (pour les users)
    if (userType === 'user' && user.actif === 0) {
      return res.status(403).json({
        success: false,
        error: "Compte utilisateur désactivé"
      });
    }

    // Vérifier si le client est actif
    if (userType === 'client' && user.statut !== 'ACTIF') {
      return res.status(403).json({
        success: false,
        error: "Compte client inactif"
      });
    }

    req.user = {
      ...user,
      type: userType,
      role: userRole,
      id_agence: id_agence
    };
    
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(403).json({
      success: false,
      error: "Token invalide ou expiré"
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
    const normalizedUserRole = userRole.toLowerCase();

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
      error: 'Accès non autorisé'
    });
  };
}

module.exports = { authenticateToken, requireRole };