const EMPLOYMENT_STATUSES = ['ACTIF', 'EN_CONGE', 'SUSPENDU', 'SORTI', 'RETRAITE', 'RENVOYE', 'DEMISSIONNE'];
// Statuts de fin de contrat : l'employé quitte l'effectif (présences, paie) et une raison est obligatoire.
const DEPARTURE_STATUSES = ['SORTI', 'RETRAITE', 'RENVOYE', 'DEMISSIONNE'];
const CONTRACT_TYPES = ['CDI', 'CDD', 'Prestataire', 'Stagiaire'];
// Contrats soumis aux cotisations CNAPS / OSTIE / IRSA.
const SALARIED_CONTRACTS = ['CDI', 'CDD'];
// Le prestataire est payé au jour de présence : son champ salary est un taux journalier.
const DAILY_RATE_CONTRACT = 'Prestataire';
const CNAPS_RATE = 0.01;
const OSTIE_RATE = 0.01;
const DOCUMENT_TYPES = ['CIN', 'RESIDENCE', 'CV', 'CONTRAT'];
const LEAVE_TYPES = ['ANNUEL', 'MALADIE', 'MATERNITE_PATERNITE', 'SANS_SOLDE'];
const LEAVE_STATUSES = ['EN_ATTENTE', 'APPROUVE', 'REFUSE', 'ANNULE'];
const PAYROLL_STATUSES = ['BROUILLON', 'VALIDE', 'PAYE'];
const DEPARTMENTS = ['Administration', 'Réception', 'Restauration', 'Casino', 'Maintenance', 'Hébergement', 'Sécurité'];

// Fragment SQL réutilisable : employés encore dans l'effectif.
const IN_WORKFORCE_SQL = (alias = '') => `${alias ? `${alias}.` : ''}status NOT IN (${DEPARTURE_STATUSES.map((s) => `'${s}'`).join(', ')})`;

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

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

// Cotisations calculées côté serveur à partir du salaire : le client ne fait qu'afficher.
// L'IRSA reste une saisie manuelle. Hors CDI/CDD, aucune cotisation.
function statutoryContributions({ contract_type, salary = 0, irsa = 0 }) {
  if (!SALARIED_CONTRACTS.includes(contract_type)) return { cnaps: 0, ostie: 0, irsa: 0 };
  return { cnaps: round2(Number(salary) * CNAPS_RATE), ostie: round2(Number(salary) * OSTIE_RATE), irsa: round2(irsa) };
}

function calculateNet({ base_salary = 0, overtime_amount = 0, bonuses = 0, pourboire = 0, allowances = 0, advances = 0, deductions = 0, cnaps = 0, ostie = 0, irsa = 0 }) {
  return Math.max(0, Number(base_salary) + Number(overtime_amount) + Number(bonuses) + Number(pourboire) + Number(allowances) - Number(advances) - Number(deductions) - Number(cnaps) - Number(ostie) - Number(irsa));
}

const DEDUCTION_FREQUENCIES = ['MENSUEL', 'HEBDOMADAIRE'];

// Nombre de semaines d'un mois = nombre de lundis du mois (4 ou 5).
function weeksInMonth(period) {
  const { start, end } = monthBounds(period);
  let weeks = 0;
  for (const day = new Date(`${start}T00:00:00Z`); day.toISOString().slice(0, 10) <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (day.getUTCDay() === 1) weeks += 1;
  }
  return weeks;
}

// Retenue réellement déduite sur le mois à partir du montant saisi.
function deductionTotal(amount, frequency, period) {
  return round2(Number(amount || 0) * (frequency === 'HEBDOMADAIRE' ? weeksInMonth(period) : 1));
}

module.exports = { EMPLOYMENT_STATUSES, DEPARTURE_STATUSES, CONTRACT_TYPES, SALARIED_CONTRACTS, DAILY_RATE_CONTRACT, DOCUMENT_TYPES, DEDUCTION_FREQUENCIES, LEAVE_TYPES, LEAVE_STATUSES, PAYROLL_STATUSES, DEPARTMENTS, IN_WORKFORCE_SQL, workingDays, monthBounds, statutoryContributions, calculateNet, weeksInMonth, deductionTotal };
