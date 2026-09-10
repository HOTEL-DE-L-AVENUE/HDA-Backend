const { pool } = require('../config/db');
const { createCrudModel } = require('./crudFactory');

const employeeFields = [
  'matricule', 'first_name', 'last_name', 'photo_url', 'birth_date', 'phone', 'address', 'email',
  'identification_number', 'department', 'position', 'joined_at', 'contract_type', 'contract_end_date',
  'salary', 'status', 'departure_date', 'departure_reason',
];

const employees = createCrudModel({
  table: 'rh_employees',
  fields: employeeFields,
  sortable: ['id', 'matricule', 'first_name', 'last_name', 'department', 'position', 'joined_at', 'salary', 'status', 'created_at'],
});

async function listEmployees({ search, department, status } = {}) {
  const conditions = [];
  const values = [];
  if (search) {
    conditions.push('(first_name LIKE ? OR last_name LIKE ? OR position LIKE ? OR matricule LIKE ?)');
    const term = `%${search}%`;
    values.push(term, term, term, term);
  }
  if (department) { conditions.push('department = ?'); values.push(department); }
  if (status) { conditions.push('status = ?'); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(`SELECT * FROM rh_employees ${where} ORDER BY last_name ASC, first_name ASC`, values);
  return rows;
}

async function dashboard() {
  const [[summary]] = await pool.query(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'ACTIF') AS active,
      SUM(status = 'ABSENT') AS absent,
      SUM(status = 'EN_CONGE') AS on_leave,
      COALESCE(SUM(salary), 0) AS payroll_total
    FROM rh_employees
  `);
  const [[pendingLeave]] = await pool.query(`SELECT COUNT(*) AS total FROM rh_leave_requests WHERE status = 'EN_ATTENTE'`);
  const [departments] = await pool.query(`SELECT department, COUNT(*) AS total FROM rh_employees GROUP BY department ORDER BY total DESC, department ASC`);
  const [expiringContracts] = await pool.query(`
    SELECT id, matricule, first_name, last_name, contract_end_date
    FROM rh_employees
    WHERE contract_end_date IS NOT NULL AND contract_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
    ORDER BY contract_end_date ASC
  `);
  return {
    total: Number(summary.total || 0), active: Number(summary.active || 0), absent: Number(summary.absent || 0),
    onLeave: Number(summary.on_leave || 0), payrollTotal: Number(summary.payroll_total || 0),
    pendingLeave: Number(pendingLeave.total || 0), departments, expiringContracts,
  };
}

async function listLeaveRequests() {
  const [rows] = await pool.query(`
    SELECT l.*, e.first_name, e.last_name, e.department
    FROM rh_leave_requests l JOIN rh_employees e ON e.id = l.employee_id
    ORDER BY l.created_at DESC
  `);
  return rows;
}

async function updateLeaveStatus(id, status, reviewedBy) {
  await pool.query(`UPDATE rh_leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`, [status, reviewedBy || null, id]);
  const [[row]] = await pool.query(`SELECT * FROM rh_leave_requests WHERE id = ?`, [id]);
  return row || null;
}

async function listAttendance(date) {
  const [rows] = await pool.query(`
    SELECT e.id, e.matricule, e.first_name, e.last_name, e.department,
           a.attendance_date, a.check_in, a.check_out, COALESCE(a.status, 'NON_POINTE') AS attendance_status, a.notes
    FROM rh_employees e
    LEFT JOIN rh_attendance a ON a.employee_id = e.id AND a.attendance_date = ?
    ORDER BY e.last_name ASC, e.first_name ASC
  `, [date || new Date().toISOString().slice(0, 10)]);
  return rows;
}

async function listPayroll(period) {
  const periodMonth = period || new Date().toISOString().slice(0, 7) + '-01';
  const [rows] = await pool.query(`
    SELECT e.id, e.matricule, e.first_name, e.last_name, e.department, e.contract_type,
           COALESCE(p.base_salary, e.salary) AS base_salary, COALESCE(p.overtime_amount, 0) AS overtime_amount,
           COALESCE(p.bonuses, 0) AS bonuses, COALESCE(p.allowances, 0) AS allowances,
           COALESCE(p.advances, 0) AS advances, COALESCE(p.deductions, 0) AS deductions,
           COALESCE(p.net_amount, e.salary) AS net_amount, COALESCE(p.status, 'BROUILLON') AS payroll_status
    FROM rh_employees e LEFT JOIN rh_payroll p ON p.employee_id = e.id AND p.period_month = ?
    WHERE e.status <> 'SORTI'
    ORDER BY e.last_name ASC, e.first_name ASC
  `, [periodMonth]);
  return rows;
}

module.exports = { employees, listEmployees, dashboard, listLeaveRequests, updateLeaveStatus, listAttendance, listPayroll };
