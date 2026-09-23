const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const ApiError = require('../utils/ApiError');
const { ok, created, noContent } = require('../utils/apiResponse');
const { getPagination, getSort } = require('../utils/queryHelpers');
const { EMPLOYMENT_STATUSES, DEPARTURE_STATUSES, CONTRACT_TYPES, DAILY_RATE_CONTRACT, DOCUMENT_TYPES, LEAVE_TYPES, LEAVE_STATUSES, PAYROLL_STATUSES, DEPARTMENTS, statutoryContributions, weeksInMonth } = require('../utils/hr');
const { RH_DOCUMENTS_DIR } = require('../middlewares/upload');
const model = require('../models/rhModel');
const { logAction } = require('../models/adminModel');

const numericFields = ['salary', 'prime', 'pourboire', 'irsa'];
const renderEmployee = (row) => ({ ...row, salary: Number(row.salary || 0), prime: Number(row.prime || 0), pourboire: Number(row.pourboire || 0), cnaps: Number(row.cnaps || 0), ostie: Number(row.ostie || 0), irsa: Number(row.irsa || 0), ...(row.presence_days !== undefined ? { presence_days: Number(row.presence_days || 0) } : {}), status: String(row.status || '').toUpperCase() });
const audit = (req, action, entite, entiteId, payload) => logAction({ userId: req.user?.id_admin, action, entite, entiteId, payload }).catch((err) => console.error('Audit RH impossible:', err.message));
function normalized(body) {
  const out = { ...(body || {}) };
  for (const field of numericFields) if (out[field] !== undefined) out[field] = out[field] === '' || out[field] === null ? 0 : Number(out[field]);
  // CNAPS et OSTIE sont toujours recalculées côté serveur (withContributions), jamais reprises du client.
  delete out.cnaps; delete out.ostie; delete out.presence_days;
  if (out.status !== undefined) out.status = String(out.status).toUpperCase();
  return out;
}
function assertEmployee(body, partial = false) {
  if (!partial && ['first_name', 'last_name', 'department', 'position', 'joined_at'].some((key) => !body[key])) throw ApiError.badRequest('first_name, last_name, department, position et joined_at sont obligatoires');
  if (body.department && !DEPARTMENTS.includes(body.department)) throw ApiError.badRequest('Département non référencé');
  if (body.contract_type && !CONTRACT_TYPES.includes(body.contract_type)) throw ApiError.badRequest(`Type de contrat invalide (${CONTRACT_TYPES.join(', ')})`);
  if (body.status && !EMPLOYMENT_STATUSES.includes(body.status)) throw ApiError.badRequest('Statut d’emploi invalide');
  for (const [field, label] of [['salary', 'Salaire'], ['prime', 'Prime'], ['pourboire', 'Pourboire'], ['irsa', 'IRSA']]) {
    if (body[field] !== undefined && (!Number.isFinite(Number(body[field])) || Number(body[field]) < 0)) throw ApiError.badRequest(`${label} invalide`);
  }
  if (body.joined_at && body.contract_end_date && body.contract_end_date < body.joined_at) throw ApiError.badRequest('La date de débauche doit être postérieure à la date d’embauche');
}
// Recalcule CNAPS / OSTIE (1 % du salaire) et l'IRSA saisie, selon le contrat résultant
// de la mise à jour (valeurs existantes complétées par le body).
function withContributions(body, existing = {}) {
  const merged = { ...existing, ...body };
  return { ...body, ...statutoryContributions({ contract_type: merged.contract_type, salary: merged.salary, irsa: merged.irsa }) };
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
  const messages = { OVERLAP: 'Cette demande chevauche un congé déjà approuvé', LEAVE_FINAL: 'Une demande traitée ne peut plus être modifiée', INSUFFICIENT_BALANCE: 'Solde de congé annuel insuffisant', ALREADY_CHECKED_IN: 'Employé déjà pointé à l’arrivée', NO_CHECK_IN: 'Aucun pointage d’arrivée pour aujourd’hui', ALREADY_CHECKED_OUT: 'Employé déjà pointé au départ', PAYROLL_LOCKED: 'Une paie validée ou payée ne peut plus être modifiée', INVALID_PAYROLL_TRANSITION: 'Transition de statut de paie invalide', INVALID_PAYROLL_AMOUNT: 'Les montants de paie doivent être positifs', PAYROLL_PAID_DELETE: 'Une paie déjà payée ne peut pas être supprimée', INVALID_DEDUCTION_FREQUENCY: 'Fréquence de retenue invalide (MENSUEL ou HEBDOMADAIRE)' };
  if (messages[error.message]) throw ApiError.badRequest(messages[error.message]);
  if (/date|jour ouvré/i.test(error.message || '')) throw ApiError.badRequest(error.message);
  throw error;
}

async function employeesList(req, res) {
  const p = page(req); const orderBy = getSort(req.query, model.employees.sortableCols, 'last_name');
  const status = req.query.status ? String(req.query.status).toUpperCase() : undefined;
  if (status && !EMPLOYMENT_STATUSES.includes(status)) throw ApiError.badRequest('Statut d’emploi invalide');
  if (req.query.contract_type && !CONTRACT_TYPES.includes(req.query.contract_type)) throw ApiError.badRequest('Type de contrat invalide');
  const result = await model.listEmployees({ search: req.query.search, department: req.query.department, status, contractType: req.query.contract_type, ...p, orderBy });
  return ok(res, result.rows.map(renderEmployee), result.meta);
}
async function getEmployee(req, res) { const row = await model.findEmployeeWithPresence(req.params.id); if (!row) throw ApiError.notFound('Employé introuvable'); return ok(res, renderEmployee(row)); }
async function createEmployee(req, res) {
  const body = normalized(req.body); assertEmployee(body); await ensureDuplicates(body);
  if (body.status === 'EN_CONGE') throw ApiError.badRequest('Le statut en congé est défini par une demande approuvée');
  if (DEPARTURE_STATUSES.includes(body.status)) throw ApiError.badRequest('Un nouvel employé ne peut pas être créé avec un statut de sortie');
  const matricule = body.matricule || `HDA-${Date.now().toString().slice(-8)}`;
  const row = await model.employees.create(withContributions({ ...body, matricule, contract_type: body.contract_type || 'CDI', status: body.status || 'ACTIF', departure_reason: undefined, departure_date: undefined }));
  await require('../config/db').pool.query('INSERT INTO rh_leave_balances (employee_id, annual_accrued, annual_used) VALUES (?, 24, 0)', [row.id]);
  await audit(req, 'CREATE_HR_EMPLOYEE', 'rh_employees', row.id, { matricule: row.matricule });
  return created(res, renderEmployee(row));
}
async function updateEmployee(req, res) {
  const existing = await model.employees.findById(req.params.id); if (!existing) throw ApiError.notFound('Employé introuvable');
  const body = normalized(req.body); assertEmployee({ ...body, joined_at: body.joined_at || existing.joined_at, contract_end_date: body.contract_end_date === undefined ? existing.contract_end_date : body.contract_end_date }, true); await ensureDuplicates(body, req.params.id);
  if (body.status === 'SORTI' && existing.status !== 'SORTI') throw ApiError.badRequest('Choisissez le statut Retraité, Renvoyé ou Démissionné avec une raison');
  if (body.status === 'EN_CONGE' && existing.status !== 'EN_CONGE') throw ApiError.badRequest('Le statut en congé est défini automatiquement par une demande approuvée');
  if (body.status && DEPARTURE_STATUSES.includes(body.status)) {
    // Retraité / Renvoyé / Démissionné : raison obligatoire, date de sortie par défaut aujourd'hui.
    const reason = String(body.departure_reason ?? '').trim();
    if (!reason) throw ApiError.badRequest('La raison est obligatoire pour un employé retraité, renvoyé ou démissionnaire');
    body.departure_reason = reason;
    body.departure_date = body.departure_date || existing.departure_date || new Date().toISOString().slice(0, 10);
  } else if (body.status && DEPARTURE_STATUSES.includes(existing.status)) {
    // Réintégration : on efface la sortie précédente.
    body.departure_reason = null; body.departure_date = null;
  } else {
    delete body.departure_reason; delete body.departure_date;
  }
  const row = await model.employees.update(req.params.id, withContributions(body, existing));
  await model.syncEmployeePayrollSnapshot(row, existing);
  const action = body.status && body.status !== existing.status && DEPARTURE_STATUSES.includes(body.status) ? 'OFFBOARD_HR_EMPLOYEE' : Number(row.salary) !== Number(existing.salary) ? 'UPDATE_HR_SALARY' : 'UPDATE_HR_EMPLOYEE';
  await audit(req, action, 'rh_employees', row.id, { fields: Object.keys(body), ...(action === 'OFFBOARD_HR_EMPLOYEE' ? { status: row.status, reason: row.departure_reason } : {}) });
  return ok(res, renderEmployee(await model.findEmployeeWithPresence(row.id)));
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
async function payrollDelete(req, res) { try { const row = await model.deletePayroll(req.params.id); if (!row) throw ApiError.notFound('Ligne de paie introuvable'); await audit(req, 'DELETE_HR_PAYROLL', 'rh_payroll', row.id, { employee_id: row.employee_id, period: row.period_month }); return noContent(res); } catch (err) { businessError(err); } }
async function payrollPayslip(req, res) {
  const rows = (await model.listPayroll({ period: req.params.period, page: 1, limit: 1000 })).rows; const line = rows.find((item) => String(item.employee_id) === String(req.params.employeeId));
  if (!line) throw ApiError.notFound('Bulletin de paie introuvable');
  res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="bulletin-${line.matricule}-${req.params.period}.pdf"`);
  const doc = new PDFDocument({ margin: 50 }); doc.pipe(res); doc.fontSize(20).text("Hôtel de l'Avenue — Bulletin de paie"); doc.moveDown().fontSize(12).text(`${line.first_name} ${line.last_name} (${line.matricule})`).text(`Contrat : ${line.contract_type}`).text(`Période : ${req.params.period.slice(0, 7)}`).moveDown();
  const isDailyRate = line.contract_type === DAILY_RATE_CONTRACT;
  const baseLabel = isDailyRate ? `Rémunération (${Number(line.presence_days || 0)} jour(s) de présence)` : 'Salaire de base';
  const manualDeduction = Math.max(0, Number(line.deductions || 0) - Number(line.absence_deductions || 0));
  const deductionLabel = `Retenue${line.deduction_frequency === 'HEBDOMADAIRE' ? ` (hebdomadaire, ${Number(line.deduction_amount || 0).toLocaleString('fr-FR')} Ar × ${weeksInMonth(line.period_month)} semaines)` : ''}${line.deduction_reason ? ` : ${line.deduction_reason}` : ''}`;
  [[baseLabel, line.base_salary], ['Heures supplémentaires', line.overtime_amount], ['Primes', line.bonuses], ['Pourboire', line.pourboire], ['Indemnités', line.allowances], ['Avances', -line.advances], [deductionLabel, -manualDeduction], ['Absences et congés sans solde', -line.absence_deductions], ['CNAPS (1 %)', -line.cnaps], ['OSTIE (1 %)', -line.ostie], ['IRSA', -line.irsa], ['Net à payer', line.net_amount]].forEach(([label, amount]) => doc.text(`${label} : ${Number(amount || 0).toLocaleString('fr-FR')} Ar`));
  doc.end();
}
const evaluationsCrud = require('./controllerFactory').createCrudController(model.evaluations, { filterable: ['employee_id', 'status'] });
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
async function evaluationList(req, res) {
  const { from, to } = req.query;
  if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) throw ApiError.badRequest('Dates invalides (format YYYY-MM-DD)');
  const result = await model.listEvaluations({ from, to, employeeId: req.query.employee_id, status: req.query.status, ...page(req) });
  return ok(res, result.rows, result.meta);
}
async function budgetList(req, res) {
  const today = new Date().toISOString().slice(0, 10);
  const from = req.query.from || `${today.slice(0, 7)}-01`; const to = req.query.to || today;
  if (!isIsoDate(from) || !isIsoDate(to)) throw ApiError.badRequest('Dates invalides (format YYYY-MM-DD)');
  try { const result = await model.listDepartmentBudgets({ from, to, departments: DEPARTMENTS }); return ok(res, result.rows, { months: result.months, from: result.from, to: result.to }); } catch (err) { businessError(err); }
}
async function budgetUpdate(req, res) {
  const { department } = req.params; const amount = Number(req.body?.monthly_budget);
  if (!DEPARTMENTS.includes(department)) throw ApiError.badRequest('Département non référencé');
  if (!Number.isFinite(amount) || amount < 0) throw ApiError.badRequest('Budget invalide');
  const row = await model.setDepartmentBudget(department, amount, req.user?.id_admin);
  await audit(req, 'UPDATE_HR_DEPARTMENT_BUDGET', 'rh_department_budgets', null, row);
  return ok(res, row);
}

// --- Pièces jointes (CIN, justificatif de résidence, CV, contrat) ----------------
const documentPath = (storedName) => path.join(RH_DOCUMENTS_DIR, path.basename(storedName));
const removeFile = (filePath) => fs.promises.unlink(filePath).catch((err) => { if (err.code !== 'ENOENT') console.error('Suppression de pièce RH impossible:', err.message); });
async function documentList(req, res) {
  if (!await model.employees.findById(req.params.id)) throw ApiError.notFound('Employé introuvable');
  return ok(res, await model.listDocuments(req.params.id));
}
async function documentUpload(req, res) {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Aucun fichier reçu (champ "file" requis)');
  const docType = String(req.body?.doc_type || '').toUpperCase();
  const employee = await model.employees.findById(req.params.id);
  if (!employee || !DOCUMENT_TYPES.includes(docType)) {
    await removeFile(file.path);
    if (!employee) throw ApiError.notFound('Employé introuvable');
    throw ApiError.badRequest(`Type de pièce invalide (${DOCUMENT_TYPES.join(', ')})`);
  }
  const row = await model.createDocument({ employeeId: employee.id, docType, storedName: file.filename, originalName: file.originalname, mimeType: file.mimetype, fileSize: file.size, uploadedBy: req.user?.id_admin });
  await audit(req, 'UPLOAD_HR_DOCUMENT', 'rh_employee_documents', row.id, { employee_id: employee.id, doc_type: docType });
  return created(res, row);
}
async function documentDownload(req, res) {
  const row = await model.findDocument(req.params.id, req.params.documentId);
  if (!row) throw ApiError.notFound('Pièce jointe introuvable');
  const filePath = documentPath(row.stored_name);
  if (!fs.existsSync(filePath)) throw ApiError.notFound('Fichier introuvable sur le serveur');
  res.setHeader('Content-Type', row.mime_type);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(row.original_name)}`);
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(filePath);
}
async function documentDelete(req, res) {
  const row = await model.findDocument(req.params.id, req.params.documentId);
  if (!row) throw ApiError.notFound('Pièce jointe introuvable');
  await model.deleteDocument(row.id);
  await removeFile(documentPath(row.stored_name));
  await audit(req, 'DELETE_HR_DOCUMENT', 'rh_employee_documents', row.id, { employee_id: row.employee_id, doc_type: row.doc_type });
  return noContent(res);
}
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
async function myAttendanceList(req, res) {
  const employee = await myEmployee(req);
  const p = page(req);
  const result = await model.listMyAttendance(employee.id, p);
  return ok(res, result.rows, result.meta);
}
async function myCheckIn(req, res) {
  const employee = await myEmployee(req);
  try {
    const row = await model.checkIn(employee.id, req.body?.notes);
    if (!row) throw ApiError.notFound('Votre fiche employé est introuvable ou inactive');
    await audit(req, 'HR_CHECK_IN_SELF', 'rh_attendance', row.id, { employee_id: row.employee_id });
    return created(res, row);
  } catch (err) { businessError(err); }
}
async function myCheckOut(req, res) {
  const employee = await myEmployee(req);
  try {
    const row = await model.checkOut(employee.id, req.body?.notes);
    await audit(req, 'HR_CHECK_OUT_SELF', 'rh_attendance', row.id, { employee_id: row.employee_id });
    return ok(res, row);
  } catch (err) { businessError(err); }
}

module.exports = { evaluationList, budgetList, budgetUpdate, documentList, documentUpload, documentDownload, documentDelete, employeesList, getEmployee, createEmployee, updateEmployee, offboardEmployee, dashboard, leaveList, leaveCreate, leaveStatus, attendanceList, checkIn, checkOut, payrollList, payrollGenerate, payrollUpdate, payrollStatus, payrollDelete, payrollPayslip, evaluationsCrud, evaluationCreate, myProfile, myLeaveList, myLeaveCreate, myAttendanceList, myCheckIn, myCheckOut };
