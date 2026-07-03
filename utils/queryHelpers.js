// utils/queryHelpers.js
// Construction sécurisée des clauses LIMIT/OFFSET/ORDER BY/WHERE
// à partir des query params de la requête HTTP (?page=&limit=&sort=&order=&search=).

function getPagination(query, defaultLimit = 20, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  let limit = parseInt(query.limit, 10) || defaultLimit;
  limit = Math.min(Math.max(1, limit), maxLimit);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// allowedColumns : whitelist obligatoire pour éviter toute injection SQL sur ORDER BY
function getSort(query, allowedColumns, defaultColumn = 'id') {
  const col = allowedColumns.includes(query.sort) ? query.sort : defaultColumn;
  const order = String(query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return `\`${col}\` ${order}`;
}

// Construit dynamiquement une clause WHERE à partir d'un objet { colonne: valeur }
// (uniquement pour les colonnes présentes dans allowedFilters)
function buildWhere(filters, allowedFilters) {
  const clauses = [];
  const values = [];
  for (const key of allowedFilters) {
    if (filters[key] !== undefined && filters[key] !== '') {
      clauses.push(`\`${key}\` = ?`);
      values.push(filters[key]);
    }
  }
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values,
  };
}

module.exports = { getPagination, getSort, buildWhere };
