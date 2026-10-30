// utils/stockMath.js
// Règles de calcul pures du module Stock (testables sans base de données).

const ApiError = require('./ApiError');

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const SALE_SOURCES = new Set(['RESTAURANT', 'VENTE', 'VENTE_BAR', 'VENTE_RESTAURANT']);

function madagascarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Antananarivo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Bornes d'un mois au format YYYY-MM, sans conversion de fuseau horaire.
// `end` est le dernier jour du mois et `endExclusive` le premier jour du mois suivant.
function monthBounds(month, now = new Date()) {
  const value = String(month || madagascarDate(now).slice(0, 7));
  const match = MONTH_PATTERN.exec(value);
  if (!match) throw ApiError.badRequest('Le mois doit être au format AAAA-MM');
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) throw ApiError.badRequest('Le mois doit être compris entre 01 et 12');

  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    month: value,
    start: `${value}-01`,
    end: `${value}-${String(lastDay).padStart(2, '0')}`,
    endExclusive: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function signedQuantity(type, quantite) {
  if (type === 'AJUSTEMENT') {
    const adjustment = Number(quantite);
    if (!Number.isFinite(adjustment) || adjustment === 0) {
      throw new Error('La quantité doit être un nombre non nul');
    }
    return adjustment;
  }
  const quantity = positiveNumber(quantite);
  if (quantity === null) throw new Error('La quantité doit être supérieure à 0');
  if (type === 'ENTREE') return quantity;
  if (type === 'SORTIE') return -quantity;
  throw new Error('Type de mouvement invalide');
}

function isSaleSource(sourceModule) {
  return SALE_SOURCES.has(String(sourceModule || '').toUpperCase());
}

// Agrège des mouvements d'un article sur une période.
// Les ventes sont isolées des sorties manuelles ; un retour de vente (ENTREE
// portant une source de vente) vient en déduction des ventes, pas en entrée.
function aggregateMovements(movements = [], { salesFromLedger = true } = {}) {
  let entrees = 0;
  let sorties = 0;
  let ventes = 0;

  for (const movement of movements) {
    const quantity = Math.abs(Number(movement.quantite ?? 0));
    if (!Number.isFinite(quantity) || quantity === 0) continue;
    const type = String(movement.type_mouvement || '').toUpperCase();
    if (isSaleSource(movement.source_module)) {
      if (!salesFromLedger) continue;
      if (type === 'SORTIE') ventes += quantity;
      else if (type === 'ENTREE') ventes -= quantity;
      continue;
    }
    if (type === 'ENTREE') entrees += quantity;
    else if (type === 'SORTIE') sorties += quantity;
    else if (type === 'AJUSTEMENT') {
      if (Number(movement.quantite) < 0) sorties += quantity;
      else entrees += quantity;
    }
  }

  return {
    entrees: Math.round(entrees * 1000) / 1000,
    sorties: Math.round(sorties * 1000) / 1000,
    ventes: Math.round(ventes * 1000) / 1000,
  };
}

// Stock au début du mois reconstitué à rebours depuis le solde courant.
function openingStock(currentQuantity, totals = {}) {
  const current = Number(currentQuantity) || 0;
  const entrees = Number(totals.entrees) || 0;
  const sorties = Number(totals.sorties) || 0;
  const ventes = Number(totals.ventes) || 0;
  return Math.round((current - entrees + sorties + ventes) * 1000) / 1000;
}

// Un seuil maximum nul ou absent signifie « pas de plafond ».
function computeStockStatus({ quantite, seuilMinimum, seuilMaximum }) {
  const quantity = Number(quantite) || 0;
  const minimum = Number(seuilMinimum) || 0;
  const maximum = Number(seuilMaximum) || 0;
  if (quantity <= 0) return 'rupture';
  if (minimum > 0 && quantity <= minimum) return 'faible';
  if (maximum > 0 && quantity > maximum) return 'eleve';
  return 'ok';
}

module.exports = {
  madagascarDate,
  monthBounds,
  signedQuantity,
  isSaleSource,
  aggregateMovements,
  openingStock,
  computeStockStatus,
};
