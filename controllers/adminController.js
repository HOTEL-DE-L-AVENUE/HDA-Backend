// controllers/adminController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Users, findUserByEmail, AuditLogs, logAction, Notifications } = require('../models/adminModel');
const { createCrudController } = require('./controllerFactory');
const { renderUser, renderUserList } = require('../views/userView');
const ApiError = require('../utils/ApiError');
const { ok, created } = require('../utils/apiResponse');
const { getPagination, getSort, buildWhere } = require('../utils/queryHelpers');

// CRUD standard sur les agents (mot de passe masqué en sortie)
const usersCrud = createCrudController(Users, { filterable: ['role', 'statut'], view: renderUser });

// --- Authentification -------------------------------------------------------

async function register(req, res) {
  const { nom, prenom, email, mot_de_passe, role } = req.body;
  if (!nom || !prenom || !email || !mot_de_passe) {
    throw ApiError.badRequest('nom, prenom, email et mot_de_passe sont requis');
  }
  const existing = await findUserByEmail(email);
  if (existing) throw ApiError.conflict('Un compte existe déjà avec cet email');

  const hash = await bcrypt.hash(mot_de_passe, 10);
  const user = await Users.create({ nom, prenom, email, mot_de_passe: hash, role: role || 'receptioniste', statut: 'actif' });
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
  return ok(res, {success : true, message: 'Connexion réussie', token, refreshToken, user: renderUser(user) });
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

const notificationsCrud = createCrudController(Notifications, { filterable: ['statut'] });

module.exports = {
  usersCrud, register, login, me, changePassword, refreshToken, logout, profile, listAuditLogs, notificationsCrud, renderUserList,
};
