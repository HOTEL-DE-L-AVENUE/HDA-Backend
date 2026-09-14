const PDFDocument = require('pdfkit');
const ApiError = require('../utils/ApiError');
const { ok, created, noContent } = require('../utils/apiResponse');
const { getPagination, getSort } = require('../utils/queryHelpers');
const { EMPLOYMENT_STATUSES, LEAVE_TYPES, LEAVE_STATUSES, PAYROLL_STATUSES, DEPARTMENTS } = require('../utils/hr');
const model = require('../models/rhModel');
const { logAction } = require('../models/adminModel');

const numericFields = ['salary'];
const renderEmployee = (row) => ({ ...row, salary: Number(row.salary || 0), status: String(row.status || '').toUpperCase() });
const audit = (req, action, entite, entiteId, payload) => logAction({ userId: req.user?.id_admin, action, entite, entiteId, payload }).catch((err) => console.error('Audit RH impossible:', err.message));
function normalized(body) { const out = { ...(body || {}) }; for (const field of numericFields) if (out[field] !== undefined) out[field] = Number(out[field]); return out; }
function assertEmployee(body, partial = false) {
  if (!partial && ['first_name', 'last_name', 'department', 'position', 'joined_at'].some((key) => !body[key])) throw ApiError.badRequest('first_name, last_name, department, position et joined_at sont obligatoires');
  if (body.department && !DEPARTMENTS.includes(body.department)) throw ApiError.badRequest('Département non référencé');
  if (body.status && !EMPLOYMENT_STATUSES.includes(String(body.status).toUpperCase())) throw ApiError.badRequest('Statut d’emploi invalide');
  if (body.salary !== undefined && (!Number.isFinite(Number(body.salary)) || Number(body.salary) < 0)) throw ApiError.badRequest('Salaire invalide');
}
async function ensureDuplicates(body, excludeId) {
  const checks = [['matricule', 'matricule'], ['email', 'email'], ['identification_number', 'numéro d’identification']];
  for (const [key, label] of checks) {
    if (!body[key]) continue;
    const [rows] = await require('../config/db').pool.query(`SELECT id FROM rh_employees WHERE ${key}=? ${excludeId ? 'AND id<>?' : ''} LIMIT 1`, excludeId ? [body[key], excludeId] : [body[key]]);
    if (rows[0]) throw ApiError.conflict(`Un employé possède déjà ce ${label}`);
  }
}
function page(req) { return getPagination(req.query); }
function businessError(error) {
  const messages = { OVERLAP: 'Cette demande chevauche un congé déjà approuvé', LEAVE_FINAL: 'Une demande traitée ne peut plus être modifiée', INSUFFICIENT_BALANCE: 'Solde de congé annuel insuffisant', ALREADY_CHECKED_IN: 'Employé déjà pointé à l’arrivée', NO_CHECK_IN: 'Aucun pointage d’arrivée pour aujourd’hui', ALREADY_CHECKED_OUT: 'Employé déjà pointé au départ', PAYROLL_LOCKED: 'Une paie validée ou payée ne peut plus être modifiée', INVALID_PAYROLL_TRANSITION: 'Transition de statut de paie invalide', INVALID_PAYROLL_AMOUNT: 'Les montants de paie doivent être positifs' };
  if (messages[error.message]) throw ApiError.badRequest(messages[error.message]);
  if (/date|jour ouvré/i.test(error.message || '')) throw ApiError.badRequest(error.message);
  throw error;
}

async function employeesList(req, res) {
  const p = page(req); const orderBy = getSort(req.query, model.employees.sortableCols, 'last_name');
  const result = await model.listEmployees({ search: req.query.search, department: req.query.department, status: req.query.status, ...p, orderBy });
  return ok(res, result.rows.map(renderEmployee), result.meta);
}
async function getEmployee(req, res) { const row = await model.employees.findById(req.params.id); if (!row) throw ApiError.notFound('Employé introuvable'); return ok(res, renderEmployee(row)); }
async function createEmployee(req, res) {
  const body = normalized(req.body); assertEmployee(body); await ensureDuplicates(body);
  if (body.status === 'EN_CONGE') throw ApiError.badRequest('Le statut en congé est défini par une demande approuvée');
  const matricule = body.matricule || `HDA-${Date.now().toString().slice(-8)}`;
  const row = await model.employees.create({ ...body, matricule, status: String(body.status || 'ACTIF').toUpperCase() });
  await require('../config/db').pool.query('INSERT INTO rh_leave_balances (employee_id, annual_accrued, annual_used) VALUES (?, 24, 0)', [row.id]);
  await audit(req, 'CREATE_HR_EMPLOYEE', 'rh_employees', row.id, { matricule: row.matricule });
  return created(res, renderEmployee(row));
}
async function updateEmployee(req, res) {
  const existing = await model.employees.findById(req.params.id); if (!existing) throw ApiError.notFound('Employé introuvable');
  const body = normalized(req.body); assertEmployee(body, true); await ensureDuplicates(body, req.params.id);
  if (body.status === 'SORTI') throw ApiError.badRequest('Utilisez la procédure de sortie avec un motif');
  if (body.status === 'EN_CONGE') throw ApiError.badRequest('Le statut en congé est défini automatiquement par une demande approuvée');
  const row = await model.employees.update(req.params.id, body);
  await audit(req, Number(body.salary) !== Number(existing.salary) ? 'UPDATE_HR_SALARY' : 'UPDATE_HR_EMPLOYEE', 'rh_employees', row.id, { fields: Object.keys(body) });
  return ok(res, renderEmployee(row));
}
async function offboardEmployee(req, res) {
  const { reason, departure_date } = req.body || {};
  if (!reason?.trim()) throw ApiError.badRequest('Un motif de sortie est obligatoire');
  const existing = await model.employees.findById(req.params.id); if (!existing) throw ApiError.notFound('Employé introuvable');
  const row = await model.employees.update(req.params.id, { status: 'SORTI', departure_reason: reason.trim(), departure_date: departure_date || new Date().toISOString().slice(0, 10) });
  await audit(req, 'OFFBOARD_HR_EMPLOYEE', 'rh_employees', row.id, { reason: row.departure_reason, departure_date: row.departure_date });
  return ok(res, renderEmployee(row));
}
async function dashboard(req, res) { return ok(res, await model.dashboard()); }
async function leaveList(req, res) { const p = page(req); const result = await model.listLeaveRequests({ ...p, employeeId: req.query.employee_id, status: req.query.status }); return ok(res, result.rows, result.meta); }
async function leaveCreate(req, res) {
  const body = req.body || {}; if (!body.employee_id || !body.start_date || !body.end_date || !LEAVE_TYPES.includes(String(body.leave_type || '').toUpperCase())) throw ApiError.badRequest(`employee_id, dates et leave_type (${LEAVE_TYPES.join(', ')}) sont obligatoires`);
  try { const row = await model.createLeaveRequest({ ...body, leave_type: String(body.leave_type).toUpperCase() }); if (!row) throw ApiError.notFound('Employé actif introuvable'); await audit(req, 'CREATE_HR_LEAVE', 'rh_leave_requests', row.id, { employee_id: row.employee_id, leave_type: row.leave_type }); return created(res, row); } catch (err) { businessError(err); }
}
async function leaveStatus(req, res) {
  const status = String(req.body?.status || '').toUpperCase(); if (!LEAVE_STATUSES.includes(status) || !['APPROUVE', 'REFUSE', 'ANNULE'].includes(status)) throw ApiError.badRequest('Statut de congé invalide');
  try { const row = await model.updateLeaveStatus(req.params.id, status, req.user?.id_admin); if (!row) throw ApiError.notFound('Demande de congé introuvable'); await audit(req, `HR_LEAVE_${status}`, 'rh_leave_requests', row.id, { employee_id: row.employee_id }); return ok(res, row); } catch (err) { businessError(err); }
}
async function attendanceList(req, res) { const p = page(req); const result = await model.listAttendance({ date: req.query.date, ...p }); return ok(res, result.rows, result.meta); }
async function checkIn(req, res) { if (!req.body?.employee_id) throw ApiError.badRequest('employee_id est obligatoire'); try { const row = await model.checkIn(req.body.employee_id, req.body.notes); if (!row) throw ApiError.notFound('Employé actif introuvable'); await audit(req, 'HR_CHECK_IN', 'rh_attendance', row.id, { employee_id: row.employee_id }); return created(res, row); } catch (err) { businessError(err); } }
async function checkOut(req, res) { if (!req.body?.employee_id) throw ApiError.badRequest('employee_id est obligatoire'); try { const row = await model.checkOut(req.body.employee_id, req.body.notes); await audit(req, 'HR_CHECK_OUT', 'rh_attendance', row.id, { employee_id: row.employee_id }); return ok(res, row); } catch (err) { businessError(err); } }
async function payrollList(req, res) { try { const p = page(req); const result = await model.listPayroll({ period: req.query.period, ...p }); return ok(res, result.rows, { ...result.meta, period: result.period }); } catch (err) { businessError(err); } }
async function payrollGenerate(req, res) { try { const result = await model.generatePayroll(req.params.period); await audit(req, 'GENERATE_HR_PAYROLL', 'rh_payroll', null, { period: req.params.period }); return ok(res, result.rows, { ...result.meta, period: result.period }); } catch (err) { businessError(err); } }
async function payrollUpdate(req, res) { try { const row = await model.updatePayroll(req.params.id, req.body || {}); if (!row) throw ApiError.notFound('Ligne de paie introuvable'); await audit(req, 'UPDATE_HR_PAYROLL', 'rh_payroll', row.id, { fields: Object.keys(req.body || {}) }); return ok(res, row); } catch (err) { businessError(err); } }
async function payrollStatus(req, res) { const status = String(req.body?.status || '').toUpperCase(); if (!PAYROLL_STATUSES.includes(status) || status === 'BROUILLON') throw ApiError.badRequest('Statut de paie invalide'); try { const row = await model.transitionPayroll(req.params.id, status); if (!row) throw ApiError.notFound('Ligne de paie introuvable'); await audit(req, `HR_PAYROLL_${status}`, 'rh_payroll', row.id, { employee_id: row.employee_id }); return ok(res, row); } catch (err) { businessError(err); } }
async function payrollPayslip(req, res) {
  const rows = (await model.listPayroll({ period: req.params.period, page: 1, limit: 1000 })).rows; const line = rows.find((item) => String(item.employee_id) === String(req.params.employeeId));
  if (!line) throw ApiError.notFound('Bulletin de paie introuvable');
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="bulletin-${line.matricule}-${req.params.period}.pdf"`);
  const doc = new PDFDocument({ margin: 50 }); doc.pipe(res); doc.fontSize(20).text("Hôtel de l'Avenue — Bulletin de paie"); doc.moveDown().fontSize(12).text(`${line.first_name} ${line.last_name} (${line.matricule})`).text(`Période : ${req.params.period.slice(0, 7)}`).moveDown();
  [['Salaire de base', line.base_salary], ['Heures supplémentaires', line.overtime_amount], ['Primes', line.bonuses], ['Indemnités', line.allowances], ['Avances', -line.advances], ['Retenues', -line.deductions], ['Net à payer', line.net_amount]].forEach(([label, amount]) => doc.text(`${label} : ${Number(amount).toLocaleString('fr-FR')} Ar`));
  doc.moveDown().fontSize(8).fillColor('gray').text('Montant hors calcul automatique CNAPS, OSTIE et IRSA.'); doc.end();
}
const evaluationsCrud = require('./controllerFactory').createCrudController(model.evaluations, { filterable: ['employee_id', 'status'] });
async function evaluationCreate(req, res) { const body = { ...(req.body || {}), reviewer_id: req.user?.id_admin }; if (!body.employee_id || !body.period || !body.evaluation_date) throw ApiError.badRequest('employee_id, period et evaluation_date sont obligatoires'); const row = await model.evaluations.create(body); await audit(req, 'CREATE_HR_EVALUATION', 'rh_evaluations', row.id, { employee_id: row.employee_id }); return created(res, row); }

// --- Espace personnel : tout utilisateur connecté, limité à SA propre fiche -----
// L'employee_id vient toujours de la fiche liée au compte connecté, jamais du body,
// pour qu'un utilisateur ne puisse jamais lire ou agir au nom d'un collègue.
async function myEmployee(req) {
  const employee = await model.findEmployeeByUserId(req.user.id_admin);
  if (!employee) throw ApiError.notFound('Aucune fiche RH n’est encore liée à votre compte. Contactez un administrateur.');
  return employee;
}
async function myProfile(req, res) { const employee = await myEmployee(req); return ok(res, renderEmployee(employee)); }
async function myLeaveList(req, res) { const employee = await myEmployee(req); const p = page(req); const result = await model.listLeaveRequests({ ...p, employeeId: employee.id }); return ok(res, result.rows, result.meta); }
async function myLeaveCreate(req, res) {
  const employee = await myEmployee(req);
  const body = req.body || {};
  if (!body.start_date || !body.end_date || !LEAVE_TYPES.includes(String(body.leave_type || '').toUpperCase())) throw ApiError.badRequest(`dates et leave_type (${LEAVE_TYPES.join(', ')}) sont obligatoires`);
  try {
    const row = await model.createLeaveRequest({ employee_id: employee.id, leave_type: String(body.leave_type).toUpperCase(), start_date: body.start_date, end_date: body.end_date, reason: body.reason });
    if (!row) throw ApiError.notFound('Votre fiche employé est introuvable ou inactive');
    await audit(req, 'CREATE_HR_LEAVE_SELF', 'rh_leave_requests', row.id, { employee_id: row.employee_id });
    return created(res, row);
  } catch (err) { businessError(err); }
}

module.exports = { employeesList, getEmployee, createEmployee, updateEmployee, offboardEmployee, dashboard, leaveList, leaveCreate, leaveStatus, attendanceList, checkIn, checkOut, payrollList, payrollGenerate, payrollUpdate, payrollStatus, payrollPayslip, evaluationsCrud, evaluationCreate, myProfile, myLeaveList, myLeaveCreate };
