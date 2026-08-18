// controllers/adminController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users, findUserByEmail, AuditLogs, logAction, Notifications } = require('../models/adminModel');
const { createCrudController } = require('./controllerFactory');
const { renderUser, renderUserList } = require('../views/userView');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, getSort, buildWhere } = require('../utils/queryHelpers');

const baseUsersCrud = createCrudController(Users, { filterable: ['role', 'statut'], view: renderUser });

// Personnalisation de la suppression et du listage pour masquer les utilisateurs désactivés/supprimés
const customDeleteMethod = async (req, res) => {
  const userId = req.params.id || req.params.id_admin;

  try {
    const userToDelete = await Users.findById(userId);
    if (!userToDelete) {
      return ok(res, { success: true, message: 'Utilisateur déjà supprimé' });
    }

    try {
      // 1. Tentative de suppression physique
      await Users.remove(userId);
      await logAction({ userId: req.user.id_admin, action: 'DELETE_USER', entite: 'users', entiteId: userId });
      return ok(res, { success: true, message: 'Utilisateur supprimé avec succès' });
    } catch (dbError) {
      // 2. Si échec (conflit de clé étrangère avec les logs), on passe le statut à 'inactif'
      console.warn('Suppression physique impossible (conflit FK), passage en statut inactif :', dbError);
      await Users.update(userId, { statut: 'inactif' });
      return ok(res, { success: true, message: 'Utilisateur désactivé avec succès' });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression :', error);
    throw ApiError.internal('Erreur lors de la suppression de l\'utilisateur');
  }
};

const usersCrud = {
  ...baseUsersCrud,
  delete: customDeleteMethod,
  remove: customDeleteMethod,
  getAll: async (req, res) => {
    // Par défaut, masquer les utilisateurs inactifs pour qu'ils ne reviennent pas à l'actualisation
    if (!req.query.statut) {
      req.query.statut = 'actif';
    }
    return baseUsersCrud.getAll(req, res);
  }
};

// --- Authentification -------------------------------------------------------

async function register(req, res) {
  const { nom, prenom, email, mot_de_passe, role, module, statut } = req.body;
  if (!nom || !prenom || !email || !mot_de_passe) {
    throw ApiError.badRequest('nom, prenom, email et mot_de_passe sont requis');
  }
  const existing = await findUserByEmail(email);
  if (existing) throw ApiError.conflict('Un compte existe déjà avec cet email');

  const formattedModule = Array.isArray(module) ? JSON.stringify(module) : (module || null);
  const hash = await bcrypt.hash(mot_de_passe, 10);
  const user = await Users.create({
    nom,
    prenom,
    email,
    mot_de_passe: hash,
    role: role || 'manager',
    module: formattedModule,
    statut: statut || 'actif'
  });
  await logAction({ userId: user.id_admin, action: 'CREATE_USER', entite: 'users', entiteId: user.id_admin });
  return created(res, renderUser(user));
}

async function login(req, res) {
  const { email, mot_de_passe } = req.body;
  if (!email || !mot_de_passe) throw ApiError.badRequest('email et mot_de_passe sont requis');

  const user = await findUserByEmail(email);
  if (!user) throw ApiError.unauthorized('Identifiants invalides');
  if (user.statut !== 'actif') throw ApiError.forbidden('Compte désactivé');

  const valid = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
  if (!valid) throw ApiError.unauthorized('Identifiants invalides');

  const token = jwt.sign(
    { id_admin: user.id_admin, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  const refreshToken = jwt.sign(
    { id_admin: user.id_admin },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  await logAction({ userId: user.id_admin, action: 'LOGIN', entite: 'users', entiteId: user.id_admin });
  return ok(res, { success: true, message: 'Connexion réussie', token, refreshToken, user: renderUser(user) });
}

async function me(req, res) {
  const user = await Users.findById(req.user.id_admin);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  return ok(res, renderUser(user));
}

async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body;
  const user = await Users.findById(req.user.id_admin);
  if (!user) throw ApiError.notFound();

  const valid = await bcrypt.compare(oldPassword, user.mot_de_passe);
  if (!valid) throw ApiError.unauthorized('Ancien mot de passe incorrect');

  const hash = await bcrypt.hash(newPassword, 10);
  await Users.update(user.id_admin, { mot_de_passe: hash });
  await logAction({ userId: user.id_admin, action: 'CHANGE_PASSWORD', entite: 'users', entiteId: user.id_admin });
  return ok(res, { success: true, message: 'Mot de passe mis à jour' });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) throw ApiError.badRequest('Refresh token requis');

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await Users.findById(decoded.id_admin);
    if (!user || user.statut !== 'actif') throw ApiError.unauthorized('Token invalide');

    const newToken = jwt.sign(
      { id_admin: user.id_admin, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return ok(res, { success: true, token: newToken });
  } catch (error) {
    throw ApiError.unauthorized('Refresh token invalide ou expiré');
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
      await logAction({ userId: decoded.id_admin, action: 'LOGOUT', entite: 'users', entiteId: decoded.id_admin });
    } catch (error) {
      // Token invalid but still proceed with logout
    }
  }
  return ok(res, { success: true, message: 'Déconnexion réussie' });
}

async function profile(req, res) {
  const user = await Users.findById(req.user.id_admin);
  if (!user) throw ApiError.notFound('Utilisateur introuvable');
  return ok(res, { success: true, user: renderUser(user) });
}

// --- Logs et notifications ---------------------------------------------------

async function listAuditLogs(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const orderBy = getSort(req.query, AuditLogs.sortableCols, 'id');
  const { sql: whereSql, values } = buildWhere(req.query, ['user_id', 'entite']);
  const [rows, total] = await Promise.all([
    AuditLogs.findAll({ whereSql, whereValues: values, orderBy, limit, offset }),
    AuditLogs.count({ whereSql, whereValues: values }),
  ]);
  return ok(res, rows, { page, limit, total });
}

async function getConnectionHistory(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const orderBy = getSort(req.query, AuditLogs.sortableCols, 'created_at');

  const whereSql = 'user_id = ? AND action IN (?, ?)';
  const whereValues = [req.user.id_admin, 'LOGIN', 'LOGOUT'];

  const [rows, total] = await Promise.all([
    AuditLogs.findAll({ whereSql, whereValues, orderBy, limit, offset }),
    AuditLogs.count({ whereSql, whereValues }),
  ]);
  return ok(res, rows, { page, limit, total });
}

const notificationsCrud = createCrudController(Notifications, { filterable: ['statut'] });

module.exports = {
  usersCrud, register, login, me, changePassword, refreshToken, logout, profile, listAuditLogs, getConnectionHistory, notificationsCrud, renderUserList,
};
