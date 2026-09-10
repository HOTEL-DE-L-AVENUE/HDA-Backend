const EMPLOYMENT_STATUSES = ['ACTIF', 'EN_CONGE', 'SUSPENDU', 'SORTI'];
const LEAVE_TYPES = ['ANNUEL', 'MALADIE', 'MATERNITE_PATERNITE', 'SANS_SOLDE'];
const LEAVE_STATUSES = ['EN_ATTENTE', 'APPROUVE', 'REFUSE', 'ANNULE'];
const PAYROLL_STATUSES = ['BROUILLON', 'VALIDE', 'PAYE'];
const DEPARTMENTS = ['Administration', 'Réception', 'Restauration', 'Casino', 'Maintenance', 'Hébergement', 'Sécurité'];

function asDate(value, label = 'Date') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error(`${label} invalide`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} invalide`);
  return date;
}

function workingDays(start, end) {
  const from = asDate(start, 'Date de début');
  const to = asDate(end, 'Date de fin');
  if (to < from) throw new Error('La date de fin doit être postérieure à la date de début');
  let days = 0;
  for (const day = new Date(from); day <= to; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days += 1;
  }
  return days;
}

function monthBounds(period) {
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(String(period || ''))) throw new Error('Période invalide (format YYYY-MM)');
  const month = String(period).slice(0, 7);
  return { period: `${month}-01`, start: `${month}-01`, end: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10) };
}

function calculateNet({ base_salary = 0, overtime_amount = 0, bonuses = 0, allowances = 0, advances = 0, deductions = 0 }) {
  return Math.max(0, Number(base_salary) + Number(overtime_amount) + Number(bonuses) + Number(allowances) - Number(advances) - Number(deductions));
}

module.exports = { EMPLOYMENT_STATUSES, LEAVE_TYPES, LEAVE_STATUSES, PAYROLL_STATUSES, DEPARTMENTS, workingDays, monthBounds, calculateNet };
