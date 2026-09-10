const test = require('node:test');
const assert = require('node:assert/strict');
const { workingDays, calculateNet, monthBounds } = require('../utils/hr');
const rhController = require('../controllers/rhController');

test('leave workflow counts only working days and rejects weekends', () => {
  assert.equal(workingDays('2026-09-11', '2026-09-14'), 2);
  assert.equal(workingDays('2026-09-12', '2026-09-13'), 0);
});

test('payroll net amount is calculated server-side from allowed components', () => {
  assert.equal(calculateNet({ base_salary: 1000000, overtime_amount: 50000, bonuses: 10000, allowances: 5000, advances: 20000, deductions: 15000 }), 1030000);
  assert.equal(calculateNet({ base_salary: 100, deductions: 200 }), 0);
  assert.deepEqual(monthBounds('2026-09'), { period: '2026-09-01', start: '2026-09-01', end: '2026-09-30' });
});

test('HR controller exposes employee, leave and payroll route handlers', () => {
  for (const handler of ['createEmployee', 'updateEmployee', 'offboardEmployee', 'leaveCreate', 'leaveStatus', 'payrollGenerate', 'payrollUpdate', 'payrollStatus']) assert.equal(typeof rhController[handler], 'function');
});

test('employee creation route rejects an incomplete personnel file before database access', async () => {
  await assert.rejects(
    () => rhController.createEmployee({ body: {} }, {}),
    /first_name, last_name, department, position et joined_at sont obligatoires/
  );
});
