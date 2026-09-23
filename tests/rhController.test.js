const test = require('node:test');
const assert = require('node:assert/strict');
const { workingDays, calculateNet, monthBounds, statutoryContributions, weeksInMonth, deductionTotal } = require('../utils/hr');

test('weekly deduction is multiplied by the number of Mondays in the month', () => {
  assert.equal(weeksInMonth('2026-09'), 4); // lundis 7, 14, 21, 28
  assert.equal(weeksInMonth('2026-08'), 5); // lundis 3, 10, 17, 24, 31
  assert.equal(deductionTotal(10000, 'HEBDOMADAIRE', '2026-08-01'), 50000);
  assert.equal(deductionTotal(10000, 'MENSUEL', '2026-08-01'), 10000);
});

test('tips (pourboire) are added to the net amount', () => {
  assert.equal(calculateNet({ base_salary: 500000, pourboire: 20000, deductions: 10000 }), 510000);
});
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

test('CNAPS and OSTIE are 1 % of salary for CDI/CDD only, IRSA is kept as entered', () => {
  assert.deepEqual(statutoryContributions({ contract_type: 'CDI', salary: 1250000, irsa: 30000 }), { cnaps: 12500, ostie: 12500, irsa: 30000 });
  assert.deepEqual(statutoryContributions({ contract_type: 'CDD', salary: 999, irsa: 0 }), { cnaps: 9.99, ostie: 9.99, irsa: 0 });
  assert.deepEqual(statutoryContributions({ contract_type: 'Prestataire', salary: 50000, irsa: 1000 }), { cnaps: 0, ostie: 0, irsa: 0 });
  assert.deepEqual(statutoryContributions({ contract_type: 'Stagiaire', salary: 300000 }), { cnaps: 0, ostie: 0, irsa: 0 });
});

test('payroll net amount subtracts CNAPS, OSTIE and IRSA', () => {
  assert.equal(calculateNet({ base_salary: 1000000, bonuses: 50000, advances: 100000, cnaps: 10000, ostie: 10000, irsa: 25000 }), 905000);
});

test('employee creation rejects an unknown contract type before database access', async () => {
  await assert.rejects(
    () => rhController.createEmployee({ body: { first_name: 'A', last_name: 'B', department: 'Casino', position: 'Croupier', joined_at: '2026-09-01', contract_type: 'Stage' } }, {}),
    /Type de contrat invalide/
  );
});

test('HR controller exposes employee, leave and payroll route handlers', () => {
  for (const handler of ['createEmployee', 'updateEmployee', 'offboardEmployee', 'leaveCreate', 'leaveStatus', 'payrollGenerate', 'payrollUpdate', 'payrollStatus', 'documentUpload', 'documentDownload', 'documentDelete', 'budgetList', 'budgetUpdate', 'evaluationList']) assert.equal(typeof rhController[handler], 'function');
});

test('employee creation route rejects an incomplete personnel file before database access', async () => {
  await assert.rejects(
    () => rhController.createEmployee({ body: {} }, {}),
    /first_name, last_name, department, position et joined_at sont obligatoires/
  );
});
