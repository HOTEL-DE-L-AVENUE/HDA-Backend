const { pool, withTransaction } = require('../config/db');
const { createCrudModel } = require('./crudFactory');
const { workingDays, monthBounds, calculateNet } = require('../utils/hr');

const employeeFields = ['matricule', 'first_name', 'last_name', 'photo_url', 'birth_date', 'phone', 'address', 'email', 'identification_number', 'department', 'position', 'joined_at', 'contract_type', 'contract_end_date', 'salary', 'status', 'departure_date', 'departure_reason'];
const employees = createCrudModel({ table: 'rh_employees', fields: employeeFields, sortable: ['id', 'matricule', 'first_name', 'last_name', 'department', 'position', 'joined_at', 'salary', 'status', 'created_at'] });
const evaluations = createCrudModel({ table: 'rh_evaluations', fields: ['employee_id', 'period', 'reviewer_id', 'score', 'comment', 'evaluation_date', 'status'], sortable: ['id', 'employee_id', 'period', 'score', 'evaluation_date', 'status', 'created_at'] });

async function syncCurrentLeaveStatus(connection = pool) {
  // Employment status is not used to record daily absence. A current approved leave
  // alone sets EN_CONGE; expired leave is reset on every HR read/action.
  await connection.query(`UPDATE rh_employees e SET status = 'ACTIF'
    WHERE e.status = 'EN_CONGE' AND NOT EXISTS (
      SELECT 1 FROM rh_leave_requests l WHERE l.employee_id = e.id AND l.status = 'APPROUVE'
      AND CURDATE() BETWEEN l.start_date AND l.end_date
    )`);
  await connection.query(`UPDATE rh_employees e SET status = 'EN_CONGE'
    WHERE e.status = 'ACTIF' AND EXISTS (
      SELECT 1 FROM rh_leave_requests l WHERE l.employee_id = e.id AND l.status = 'APPROUVE'
      AND CURDATE() BETWEEN l.start_date AND l.end_date
    )`);
}

function paginationMeta(page, limit, total) { return { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) }; }

async function listEmployees({ search, department, status, page = 1, limit = 20, offset = 0, orderBy = '`last_name` ASC, `first_name` ASC' } = {}) {
  await syncCurrentLeaveStatus();
  const c = []; const values = [];
  if (search) { c.push('(first_name LIKE ? OR last_name LIKE ? OR position LIKE ? OR matricule LIKE ?)'); const term = `%${search}%`; values.push(term, term, term, term); }
  if (department) { c.push('department = ?'); values.push(department); }
  if (status) { c.push('status = ?'); values.push(status); }
  const where = c.length ? `WHERE ${c.join(' AND ')}` : '';
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM rh_employees ${where}`, values);
  const [rows] = await pool.query(`SELECT * FROM rh_employees ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`, [...values, limit, offset]);
  return { rows, meta: paginationMeta(page, limit, count.total) };
}

async function dashboard() {
  await syncCurrentLeaveStatus();
  const [[summary]] = await pool.query(`SELECT COUNT(*) total, SUM(status = 'ACTIF') active, SUM(status = 'EN_CONGE') on_leave, SUM(status = 'SUSPENDU') suspended, SUM(status = 'SORTI') departed, COALESCE(SUM(CASE WHEN status <> 'SORTI' THEN salary ELSE 0 END), 0) payroll_total FROM rh_employees`);
  const [[pendingLeave]] = await pool.query(`SELECT COUNT(*) total FROM rh_leave_requests WHERE status = 'EN_ATTENTE'`);
  const [[absent]] = await pool.query(`SELECT COUNT(*) total FROM rh_attendance WHERE attendance_date = CURDATE() AND status = 'ABSENT'`);
  const [departments] = await pool.query(`SELECT department, COUNT(*) total FROM rh_employees WHERE status <> 'SORTI' GROUP BY department ORDER BY total DESC, department ASC`);
  const [expiringContracts] = await pool.query(`SELECT id, matricule, first_name, last_name, contract_end_date FROM rh_employees WHERE status <> 'SORTI' AND contract_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) ORDER BY contract_end_date ASC`);
  return { total: Number(summary.total || 0), active: Number(summary.active || 0), absent: Number(absent.total || 0), onLeave: Number(summary.on_leave || 0), suspended: Number(summary.suspended || 0), departed: Number(summary.departed || 0), payrollTotal: Number(summary.payroll_total || 0), pendingLeave: Number(pendingLeave.total || 0), departments, expiringContracts };
}

async function listLeaveRequests({ page = 1, limit = 20, offset = 0, employeeId, status } = {}) {
  const c = []; const values = [];
  if (employeeId) { c.push('l.employee_id = ?'); values.push(employeeId); }
  if (status) { c.push('l.status = ?'); values.push(status); }
  const where = c.length ? `WHERE ${c.join(' AND ')}` : '';
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM rh_leave_requests l ${where}`, values);
  const [rows] = await pool.query(`SELECT l.*, e.first_name, e.last_name, e.department, b.annual_accrued, b.annual_used, (b.annual_accrued - b.annual_used) annual_remaining FROM rh_leave_requests l JOIN rh_employees e ON e.id=l.employee_id LEFT JOIN rh_leave_balances b ON b.employee_id=e.id ${where} ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, [...values, limit, offset]);
  return { rows, meta: paginationMeta(page, limit, count.total) };
}

async function createLeaveRequest(data) {
  const days = workingDays(data.start_date, data.end_date);
  if (!days) throw new Error('Un congé doit contenir au moins un jour ouvré');
  return withTransaction(async (conn) => {
    const [[employee]] = await conn.query('SELECT id, status FROM rh_employees WHERE id = ? FOR UPDATE', [data.employee_id]);
    if (!employee || employee.status === 'SORTI') return null;
    const [[overlap]] = await conn.query(`SELECT id FROM rh_leave_requests WHERE employee_id=? AND status='APPROUVE' AND start_date <= ? AND end_date >= ? LIMIT 1`, [data.employee_id, data.end_date, data.start_date]);
    if (overlap) { const err = new Error('OVERLAP'); throw err; }
    const [result] = await conn.query(`INSERT INTO rh_leave_requests (employee_id, leave_type, start_date, end_date, days, reason, status) VALUES (?, ?, ?, ?, ?, ?, 'EN_ATTENTE')`, [data.employee_id, data.leave_type, data.start_date, data.end_date, days, data.reason || null]);
    return (await conn.query('SELECT * FROM rh_leave_requests WHERE id=?', [result.insertId]))[0][0];
  });
}

async function updateLeaveStatus(id, status, reviewedBy) {
  return withTransaction(async (conn) => {
    const [[leave]] = await conn.query('SELECT * FROM rh_leave_requests WHERE id=? FOR UPDATE', [id]);
    if (!leave) return null;
    if (leave.status !== 'EN_ATTENTE' && status !== leave.status) { const err = new Error('LEAVE_FINAL'); throw err; }
    if (status === 'APPROUVE') {
      const [[overlap]] = await conn.query(`SELECT id FROM rh_leave_requests WHERE employee_id=? AND id<>? AND status='APPROUVE' AND start_date <= ? AND end_date >= ? LIMIT 1`, [leave.employee_id, id, leave.end_date, leave.start_date]);
      if (overlap) { const err = new Error('OVERLAP'); throw err; }
      if (leave.leave_type === 'ANNUEL') {
        await conn.query('INSERT IGNORE INTO rh_leave_balances (employee_id) VALUES (?)', [leave.employee_id]);
        const [[balance]] = await conn.query('SELECT annual_accrued, annual_used FROM rh_leave_balances WHERE employee_id=? FOR UPDATE', [leave.employee_id]);
        if (Number(balance.annual_accrued) - Number(balance.annual_used) < Number(leave.days)) { const err = new Error('INSUFFICIENT_BALANCE'); throw err; }
        await conn.query('UPDATE rh_leave_balances SET annual_used=annual_used+? WHERE employee_id=?', [leave.days, leave.employee_id]);
      }
    }
    await conn.query('UPDATE rh_leave_requests SET status=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?', [status, reviewedBy || null, id]);
    await syncCurrentLeaveStatus(conn);
    return (await conn.query('SELECT * FROM rh_leave_requests WHERE id=?', [id]))[0][0];
  });
}

async function listAttendance({ date, page = 1, limit = 20, offset = 0 } = {}) {
  const attendanceDate = date || new Date().toISOString().slice(0, 10);
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM rh_employees WHERE status <> 'SORTI'`);
  const [rows] = await pool.query(`SELECT e.id employee_id, e.matricule, e.first_name, e.last_name, e.department, a.attendance_date, a.check_in, a.check_out,
    CASE WHEN a.id IS NOT NULL THEN a.status WHEN ? < CURDATE() THEN 'ABSENT' ELSE 'NON_POINTE' END attendance_status, a.notes
    FROM rh_employees e LEFT JOIN rh_attendance a ON a.employee_id=e.id AND a.attendance_date=? WHERE e.status <> 'SORTI' ORDER BY e.last_name, e.first_name LIMIT ? OFFSET ?`, [attendanceDate, attendanceDate, limit, offset]);
  return { rows, meta: paginationMeta(page, limit, count.total) };
}

async function checkIn(employeeId, notes) {
  return withTransaction(async (conn) => {
    const [[employee]] = await conn.query(`SELECT id FROM rh_employees WHERE id=? AND status = 'ACTIF' FOR UPDATE`, [employeeId]);
    if (!employee) return null;
    const [[existing]] = await conn.query('SELECT * FROM rh_attendance WHERE employee_id=? AND attendance_date=CURDATE() FOR UPDATE', [employeeId]);
    if (existing?.check_in) { const err = new Error('ALREADY_CHECKED_IN'); throw err; }
    const [[time]] = await conn.query('SELECT TIME(NOW()) value');
    const status = time.value > '08:15:00' ? 'RETARD' : 'PRESENT';
    if (existing) await conn.query('UPDATE rh_attendance SET check_in=?, check_out=NULL, status=?, notes=? WHERE id=?', [time.value, status, notes || null, existing.id]);
    else await conn.query('INSERT INTO rh_attendance (employee_id, attendance_date, check_in, status, notes) VALUES (?, CURDATE(), ?, ?, ?)', [employeeId, time.value, status, notes || null]);
    return (await conn.query('SELECT * FROM rh_attendance WHERE employee_id=? AND attendance_date=CURDATE()', [employeeId]))[0][0];
  });
}

async function checkOut(employeeId, notes) {
  const [[entry]] = await pool.query('SELECT * FROM rh_attendance WHERE employee_id=? AND attendance_date=CURDATE()', [employeeId]);
  if (!entry?.check_in) { const err = new Error('NO_CHECK_IN'); throw err; }
  if (entry.check_out) { const err = new Error('ALREADY_CHECKED_OUT'); throw err; }
  await pool.query('UPDATE rh_attendance SET check_out=TIME(NOW()), notes=COALESCE(?, notes) WHERE id=?', [notes || null, entry.id]);
  return (await pool.query('SELECT * FROM rh_attendance WHERE id=?', [entry.id]))[0][0];
}

async function payrollAdjustments(conn, employeeId, start, end, baseSalary) {
  const [[days]] = await conn.query(`SELECT COUNT(*) total FROM (SELECT attendance_date d FROM rh_attendance WHERE employee_id=? AND attendance_date BETWEEN ? AND ? AND status='ABSENT' UNION SELECT d FROM (SELECT DATE_ADD(start_date, INTERVAL seq.n DAY) d FROM rh_leave_requests JOIN (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30) seq WHERE leave_type='SANS_SOLDE' AND status='APPROUVE' AND DATE_ADD(start_date, INTERVAL seq.n DAY) <= end_date AND DATE_ADD(start_date, INTERVAL seq.n DAY) BETWEEN ? AND ? AND DAYOFWEEK(DATE_ADD(start_date, INTERVAL seq.n DAY)) NOT IN (1,7)) unpaid) missing`, [employeeId, start, end, start, end]);
  const businessDays = workingDays(start, end) || 1;
  return Math.round((Number(baseSalary) / businessDays) * Number(days.total || 0) * 100) / 100;
}

async function generatePayroll(period) {
  const bounds = monthBounds(period);
  return withTransaction(async (conn) => {
    const [staff] = await conn.query(`SELECT id, salary FROM rh_employees WHERE status <> 'SORTI'`);
    for (const employee of staff) {
      const deduction = await payrollAdjustments(conn, employee.id, bounds.start, bounds.end, employee.salary);
      const [[existing]] = await conn.query('SELECT * FROM rh_payroll WHERE employee_id=? AND period_month=? FOR UPDATE', [employee.id, bounds.period]);
      if (existing && existing.status !== 'BROUILLON') continue;
      // Keep HR-entered deductions separate from computed unpaid-leave/absence
      // deductions so running “generate” twice is idempotent.
      const manualDeductions = existing ? Math.max(0, Number(existing.deductions || 0) - Number(existing.absence_deductions || 0)) : 0;
      const values = existing ? { ...existing, base_salary: employee.salary, absence_deductions: deduction, deductions: manualDeductions + deduction } : { base_salary: employee.salary, overtime_amount: 0, bonuses: 0, allowances: 0, advances: 0, absence_deductions: deduction, deductions: deduction };
      const net = calculateNet(values);
      if (existing) await conn.query('UPDATE rh_payroll SET base_salary=?, deductions=?, absence_deductions=?, net_amount=? WHERE id=?', [values.base_salary, values.deductions, values.absence_deductions, net, existing.id]);
      else await conn.query('INSERT INTO rh_payroll (employee_id, period_month, base_salary, deductions, absence_deductions, net_amount, status) VALUES (?, ?, ?, ?, ?, ?, "BROUILLON")', [employee.id, bounds.period, values.base_salary, values.deductions, values.absence_deductions, net]);
    }
    return listPayroll({ period: bounds.period, page: 1, limit: 100 });
  });
}

async function listPayroll({ period, page = 1, limit = 20, offset = 0 } = {}) {
  const bounds = monthBounds(period || new Date().toISOString().slice(0, 7));
  const [[count]] = await pool.query(`SELECT COUNT(*) total FROM rh_payroll WHERE period_month=?`, [bounds.period]);
  const [rows] = await pool.query(`SELECT p.*, e.matricule, e.first_name, e.last_name, e.department, e.contract_type FROM rh_payroll p JOIN rh_employees e ON e.id=p.employee_id WHERE p.period_month=? ORDER BY e.last_name,e.first_name LIMIT ? OFFSET ?`, [bounds.period, limit, offset]);
  return { rows, meta: paginationMeta(page, limit, count.total), period: bounds.period };
}

async function updatePayroll(id, data) {
  const [[row]] = await pool.query('SELECT * FROM rh_payroll WHERE id=?', [id]);
  if (!row) return null;
  if (row.status !== 'BROUILLON') { const err = new Error('PAYROLL_LOCKED'); throw err; }
  const allowed = ['overtime_amount', 'bonuses', 'allowances', 'advances', 'deductions'];
  const values = { ...row };
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    if (!Number.isFinite(Number(data[key])) || Number(data[key]) < 0) { const err = new Error('INVALID_PAYROLL_AMOUNT'); throw err; }
    values[key] = Number(data[key]);
  }
  values.net_amount = calculateNet(values);
  await pool.query(`UPDATE rh_payroll SET overtime_amount=?, bonuses=?, allowances=?, advances=?, deductions=?, net_amount=? WHERE id=?`, [values.overtime_amount, values.bonuses, values.allowances, values.advances, values.deductions, values.net_amount, id]);
  return (await pool.query('SELECT * FROM rh_payroll WHERE id=?', [id]))[0][0];
}

async function transitionPayroll(id, status) {
  const [[row]] = await pool.query('SELECT * FROM rh_payroll WHERE id=?', [id]);
  if (!row) return null;
  const valid = (row.status === 'BROUILLON' && status === 'VALIDE') || (row.status === 'VALIDE' && status === 'PAYE');
  if (!valid) { const err = new Error('INVALID_PAYROLL_TRANSITION'); throw err; }
  await pool.query('UPDATE rh_payroll SET status=?, paid_at=CASE WHEN ?="PAYE" THEN NOW() ELSE paid_at END WHERE id=?', [status, status, id]);
  return (await pool.query('SELECT * FROM rh_payroll WHERE id=?', [id]))[0][0];
}

module.exports = { employees, evaluations, listEmployees, dashboard, listLeaveRequests, createLeaveRequest, updateLeaveStatus, listAttendance, checkIn, checkOut, generatePayroll, listPayroll, updatePayroll, transitionPayroll, monthBounds };
