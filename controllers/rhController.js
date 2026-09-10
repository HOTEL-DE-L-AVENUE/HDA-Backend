const ApiError = require('../utils/ApiError');
const { ok, created, noContent } = require('../utils/apiResponse');
const { createCrudController } = require('./controllerFactory');
const model = require('../models/rhModel');

const renderEmployee = (row) => ({
  ...row,
  salary: Number(row.salary || 0),
  status: String(row.status || '').toUpperCase(),
});

const employeesCrud = createCrudController(model.employees, { filterable: ['department', 'status', 'contract_type'] });

async function employeesList(req, res) {
  const rows = await model.listEmployees({ search: req.query.search, department: req.query.department, status: req.query.status });
  return ok(res, rows.map(renderEmployee));
}

async function createEmployee(req, res) {
  const body = req.body || {};
  if (!body.first_name || !body.last_name || !body.department || !body.position || !body.joined_at) {
    throw ApiError.badRequest('first_name, last_name, department, position et joined_at sont obligatoires');
  }
  const matricule = body.matricule || `HDA-${Date.now().toString().slice(-8)}`;
  const row = await model.employees.create({ ...body, matricule, status: body.status || 'ACTIF' });
  return created(res, renderEmployee(row));
}

async function dashboard(req, res) { return ok(res, await model.dashboard()); }
async function leaveList(req, res) { return ok(res, await model.listLeaveRequests()); }

async function leaveStatus(req, res) {
  const allowed = ['APPROUVE', 'REFUSE', 'EN_ATTENTE'];
  const status = String(req.body?.status || '').toUpperCase();
  if (!allowed.includes(status)) throw ApiError.badRequest(`Statut invalide (attendu: ${allowed.join(', ')})`);
  const row = await model.updateLeaveStatus(req.params.id, status, req.user?.id_admin);
  if (!row) throw ApiError.notFound('Demande de congé introuvable');
  return ok(res, row);
}

async function attendanceList(req, res) { return ok(res, await model.listAttendance(req.query.date)); }
async function payrollList(req, res) { return ok(res, await model.listPayroll(req.query.period)); }

module.exports = { employeesCrud, employeesList, createEmployee, dashboard, leaveList, leaveStatus, attendanceList, payrollList };
