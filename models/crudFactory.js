// models/crudFactory.js
//
// Génère un modèle CRUD complet (findAll, findById, create, update, remove)
// pour une table donnée, sans dupliquer le SQL à chaque fois.
// Utilisé par toutes les tables "simples" (référentiels, tables de rattachement).
// Les tables avec logique métier (casino, stock, finance, restaurant) ont
// leur propre modèle qui peut réutiliser cette factory en interne.

const { pool } = require('../config/db');

/**
 * @param {object} opts
 * @param {string} opts.table - nom de la table SQL
 * @param {string} opts.pk - nom de la clé primaire (ex: 'id', 'id_admin')
 * @param {string[]} opts.fields - colonnes autorisées en écriture (create/update)
 * @param {string[]} [opts.sortable] - colonnes autorisées pour le tri (défaut = fields + pk)
 */
function createCrudModel({ table, pk = 'id', fields, sortable }) {
  const sortableCols = sortable || [pk, ...fields];

  async function findAll({ whereSql = '', whereValues = [], orderBy = `\`${pk}\` DESC`, limit, offset } = {}) {
    let sql = `SELECT * FROM \`${table}\` ${whereSql} ORDER BY ${orderBy}`;
    const values = [...whereValues];
    if (limit !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      values.push(limit, offset || 0);
    }
    const [rows] = await pool.query(sql, values);
    return rows;
  }

  async function count({ whereSql = '', whereValues = [] } = {}) {
    const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\` ${whereSql}`, whereValues);
    return rows[0].total;
  }

  async function findById(id) {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ? LIMIT 1`, [id]);
    return rows[0] || null;
  }

  async function create(data) {
    const cols = fields.filter((f) => data[f] !== undefined);
    if (!cols.length) throw new Error(`Aucun champ valide fourni pour ${table}`);
    const placeholders = cols.map(() => '?').join(', ');
    const values = cols.map((c) => data[c]);
    const [result] = await pool.query(
      `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
      values
    );
    return findById(result.insertId || data[pk]);
  }

  async function update(id, data) {
    const cols = fields.filter((f) => data[f] !== undefined);
    if (!cols.length) return findById(id);
    const setSql = cols.map((c) => `\`${c}\` = ?`).join(', ');
    const values = [...cols.map((c) => data[c]), id];
    await pool.query(`UPDATE \`${table}\` SET ${setSql} WHERE \`${pk}\` = ?`, values);
    return findById(id);
  }

  async function remove(id) {
    const [result] = await pool.query(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`, [id]);
    return result.affectedRows > 0;
  }

  return { table, pk, fields, sortableCols, findAll, count, findById, create, update, remove };
}

module.exports = { createCrudModel };
