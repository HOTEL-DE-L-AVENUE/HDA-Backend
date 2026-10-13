// utils/unitConversion.js
//
// Convertit une quantité d'une unité de recette vers l'unité de stock d'un ingrédient.
// Deux unités sont compatibles uniquement si elles mesurent la même grandeur (masse, volume, pièce…).

const UNITS = {
  MG: { dim: 'masse', factor: 0.000001 },
  G: { dim: 'masse', factor: 0.001 },
  KG: { dim: 'masse', factor: 1 },
  ML: { dim: 'volume', factor: 0.001 },
  CL: { dim: 'volume', factor: 0.01 },
  L: { dim: 'volume', factor: 1 },
  CUILLERE_CAFE: { dim: 'volume', factor: 0.005 },
  CUILLERE_SOUPE: { dim: 'volume', factor: 0.015 },
  PIECE: { dim: 'piece', factor: 1 },
  UNITE: { dim: 'piece', factor: 1 },
};

const ALIASES = {
  MILLIGRAMME: 'MG', MILLIGRAMMES: 'MG',
  GRAMME: 'G', GRAMMES: 'G',
  KILOGRAMME: 'KG', KILOGRAMMES: 'KG', KILO: 'KG', KILOS: 'KG',
  MILLILITRE: 'ML', MILLILITRES: 'ML', MILILITRE: 'ML', MILILITRES: 'ML',
  CENTILITRE: 'CL', CENTILITRES: 'CL',
  LITRE: 'L', LITRES: 'L',
  CUILLERE_A_CAFE: 'CUILLERE_CAFE', CUILLERE_A_THE: 'CUILLERE_CAFE',
  CUILLERE_A_SOUPE: 'CUILLERE_SOUPE', CUILLERE_SOUPES: 'CUILLERE_SOUPE',
  PIECES: 'PIECE',
  UNITES: 'UNITE',
  BOITES: 'BOITE',
  BOUTEILLES: 'BOUTEILLE',
  SACHETS: 'SACHET',
  PORTIONS: 'PORTION',
  PAQUETS: 'PAQUET',
};

function canonicalUnitCode(rawUnit) {
  const key = String(rawUnit ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!key) return null;
  return ALIASES[key] || key;
}

function unitInfo(rawUnit) {
  const code = canonicalUnitCode(rawUnit);
  if (!code) return null;
  return UNITS[code] || { dim: code, factor: 1 };
}

function convertQuantity(quantity, fromUnit, toUnit) {
  const from = unitInfo(fromUnit);
  const to = unitInfo(toUnit);
  if (!from || !to || from.dim !== to.dim) return null;
  return (quantity * from.factor) / to.factor;
}

module.exports = { canonicalUnitCode, convertQuantity };
