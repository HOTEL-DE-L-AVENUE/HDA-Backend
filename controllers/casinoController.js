// controllers/casinoController.js
//
// Corrigé selon le code réel du projet :
//  - routeFactory.createCrudRouter(controller) attend un objet avec les 5
//    handlers { list, getOne, create, update, remove } — pas une config
//    passive. Les exports `*Crud` ci-dessous sont donc de vrais mini-contrôleurs
//    générés par `buildCrud(...)`.
//  - config/db exporte { pool, checkConnection, withTransaction }.
//  - req.user = payload JWT { id_admin, role, email } (auth.js) → on utilise
//    partout `req.user.id_admin` (jamais `req.user.id`).
//  - ApiError existe dans utils/ApiError avec au moins `.unauthorized()` et
//    `.forbidden()` (vu dans auth.js). Je suppose ici la présence de
//    `.badRequest()`, `.notFound()`, `.conflict()`, qui suivent la même
//    convention statique — si les noms diffèrent chez toi, un rename global
//    suffit (les usages sont regroupés et explicites).
//
// Toutes les écritures financières restent idempotentes via `ref_flux_global`
// (contrainte UNIQUE côté SQL + `INSERT IGNORE`).

const { randomUUID } = require('crypto');
const { pool, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

// =====================================================================
// Helpers génériques
// =====================================================================

function genRef() {
  return randomUUID();
}

function asMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v < 0) throw ApiError.badRequest('Montant invalide');
  return v;
}

function caissierId(req) {
  return req.user.id_admin;
}

/**
 * Écrit une ligne dans le module financier global à partir d'un événement
 * casino. Idempotent grâce à `ref_flux_global` (UNIQUE en base) : si la ligne
 * existe déjà, `INSERT IGNORE` ne crée pas de doublon.
 */
async function recordFinancialTransaction(conn, { client_id = null, type_flux, montant, reference_id, description, ref_flux_global }) {
  await conn.query(
    `INSERT IGNORE INTO financial_transactions
       (client_id, module, type_flux, montant, reference_id, ref_flux_global, description, statut_sync, created_at)
     VALUES (?, 'CASINO', ?, ?, ?, ?, ?, 'SYNCED', NOW())`,
    [client_id, type_flux, montant, reference_id, ref_flux_global, description]
  );
}

async function getOpenSession(conn, sessionId) {
  const [rows] = await conn.query(
    `SELECT * FROM casino_cashier_sessions WHERE id = ? AND statut = 'OUVERTE' LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function getScoringConfigMap(conn) {
  const [rows] = await conn.query(`SELECT cle, valeur FROM casino_scoring_config`);
  const map = {};
  for (const r of rows) map[r.cle] = r.valeur;
  return map;
}

// =====================================================================
// Générateur de CRUD générique (utilisé pour les exports `*Crud`)
// =====================================================================

/**
 * Construit un mini-contrôleur { list, getOne, create, update, remove }
 * compatible avec routeFactory.createCrudRouter.
 *
 * @param {string} table
 * @param {object} opts
 *  - pk: colonne clé primaire (défaut 'id')
 *  - allowedFields: colonnes acceptées en create/update
 *  - readOnly: si true, create/update/remove renvoient 405
 *  - orderBy: clause ORDER BY par défaut pour list()
 *  - defaults: fn(req) => objet de valeurs par défaut fusionnées à la création
 *    (ex: created_by: req.user.id_admin)
 */
function buildCrud(table, { pk = 'id', allowedFields = [], readOnly = false, orderBy = `${pk} DESC`, defaults = null } = {}) {
  function pickAllowed(body) {
    const out = {};
    for (const f of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, f)) out[f] = body[f];
    }
    return out;
  }

  return {
    async list(req, res, next) {
      try {
        const { limit = 100, offset = 0 } = req.query;
        const [rows] = await pool.query(
          `SELECT * FROM \`${table}\` ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
          [Number(limit), Number(offset)]
        );
        res.json(rows);
      } catch (err) { next(err); }
    },

    async getOne(req, res, next) {
      try {
        const [[row]] = await pool.query(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ?`, [req.params[pk] ?? req.params.id]);
        if (!row) throw ApiError.notFound(`${table} introuvable`);
        res.json(row);
      } catch (err) { next(err); }
    },

    async create(req, res, next) {
      try {
        if (readOnly) throw ApiError.forbidden(`${table} : création non autorisée via cette route`);
        const data = { ...pickAllowed(req.body), ...(defaults ? defaults(req) : {}) };
        if (Object.keys(data).length === 0) throw ApiError.badRequest('Aucun champ valide fourni');
        const columns = Object.keys(data);
        const [result] = await pool.query(
          `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
          columns.map(c => data[c])
        );
        const [[row]] = await pool.query(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ?`, [result.insertId]);
        res.status(201).json(row);
      } catch (err) { next(err); }
    },

    async update(req, res, next) {
      try {
        if (readOnly) throw ApiError.forbidden(`${table} : modification non autorisée via cette route`);
        const data = pickAllowed(req.body);
        if (Object.keys(data).length === 0) throw ApiError.badRequest('Aucun champ valide fourni');
        const columns = Object.keys(data);
        const [result] = await pool.query(
          `UPDATE \`${table}\` SET ${columns.map(c => `\`${c}\` = ?`).join(', ')} WHERE \`${pk}\` = ?`,
          [...columns.map(c => data[c]), req.params[pk] ?? req.params.id]
        );
        if (result.affectedRows === 0) throw ApiError.notFound(`${table} introuvable`);
        const [[row]] = await pool.query(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ?`, [req.params[pk] ?? req.params.id]);
        res.json(row);
      } catch (err) { next(err); }
    },

    async remove(req, res, next) {
      try {
        if (readOnly) throw ApiError.forbidden(`${table} : suppression non autorisée via cette route`);
        const [result] = await pool.query(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`, [req.params[pk] ?? req.params.id]);
        if (result.affectedRows === 0) throw ApiError.notFound(`${table} introuvable`);
        res.status(204).send();
      } catch (err) { next(err); }
    },
  };
}

exports.roomsCrud = buildCrud('casino_rooms', {
  allowedFields: ['code', 'nom', 'type_salle', 'statut'],
});

exports.cashiersCrud = buildCrud('casino_cashiers', {
  allowedFields: ['room_id', 'code', 'nom', 'statut'],
});

exports.sessionsCrud = buildCrud('casino_cashier_sessions', {
  allowedFields: ['cashier_id', 'user_id', 'ouverture_at', 'fermeture_at', 'fond_initial', 'fond_final_declare', 'statut', 'commentaire'],
  orderBy: 'ouverture_at DESC',
});

exports.cardsCrud = buildCrud('casino_cards', {
  allowedFields: ['client_id', 'numero_carte', 'qr_code', 'niveau', 'plafond_credit', 'statut', 'date_emission'],
});

exports.clientProfilesCrud = buildCrud('casino_client_profiles', {
  allowedFields: ['client_id', 'statut_special', 'motif', 'date_effet', 'decide_par'],
});

exports.incidentsCrud = buildCrud('casino_incidents', {
  allowedFields: ['client_id', 'session_id', 'type', 'gravite', 'description', 'statut', 'resolved_at'],
  orderBy: 'created_at DESC',
});

exports.chipTypesCrud = buildCrud('casino_chip_types', {
  allowedFields: ['code', 'nom', 'valeur_nominale', 'couleur', 'statut'],
});

// Lecture seule : la création passe par /chips/buy et /chips/sell
// (il faut calculer valeur_unitaire, générer ref_flux_global, écrire le flux global).
exports.chipTransactionsCrud = buildCrud('casino_chip_transactions', {
  readOnly: true,
  orderBy: 'created_at DESC',
});

// Lecture seule : la création passe par /operations/buy-in, /cash-out, /deposit.
exports.cashOperationsCrud = buildCrud('casino_cash_operations', {
  readOnly: true,
  orderBy: 'created_at DESC',
});

exports.creditsCrud = buildCrud('casino_credits', {
  allowedFields: ['client_id', 'session_id', 'montant_accorde', 'encours', 'echeance', 'statut'],
  orderBy: 'date_octroi DESC',
});

// Lecture seule : la création passe par /scoring/:clientId/compute,
// la décision humaine par /scoring/:scoreId/decision.
exports.scoresCrud = buildCrud('casino_scores', {
  readOnly: true,
  orderBy: 'calcule_le DESC',
});

exports.visitsCrud = buildCrud('casino_visits', {
  allowedFields: ['client_id', 'room_id', 'card_id', 'entree_at', 'sortie_at', 'entree_via'],
  orderBy: 'entree_at DESC',
});

// =====================================================================
// Tableau de bord & consolidation
// =====================================================================

exports.dashboardHandler = async (req, res, next) => {
  try {
    const [[salles]] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(statut='OUVERTE') AS ouvertes FROM casino_rooms`
    );
    const [[sessions]] = await pool.query(
      `SELECT COUNT(*) AS ouvertes FROM casino_cashier_sessions WHERE statut = 'OUVERTE'`
    );
    const [[produitJour]] = await pool.query(
      `SELECT COALESCE(SUM(produit_net),0) AS produit_net_jour
         FROM v_casino_produit_net_jour WHERE jour = CURDATE()`
    );
    const [[encours]] = await pool.query(
      `SELECT COALESCE(SUM(encours_total),0) AS encours_credit_total FROM v_casino_encours_credit`
    );
    const [[incidents]] = await pool.query(
      `SELECT COUNT(*) AS ouverts FROM casino_incidents WHERE statut IN ('OUVERT','EN_COURS')`
    );
    res.json({
      salles_total: salles.total,
      salles_ouvertes: salles.ouvertes,
      sessions_ouvertes: sessions.ouvertes,
      produit_net_jour: produitJour.produit_net_jour,
      encours_credit_total: encours.encours_credit_total,
      incidents_ouverts: incidents.ouverts,
    });
  } catch (err) { next(err); }
};

exports.produitNetHandler = async (req, res, next) => {
  try {
    const { salle, du, au } = req.query;
    const clauses = [];
    const params = [];
    if (salle) { clauses.push('salle = ?'); params.push(salle); }
    if (du) { clauses.push('jour >= ?'); params.push(du); }
    if (au) { clauses.push('jour <= ?'); params.push(au); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM v_casino_produit_net_jour ${where} ORDER BY jour DESC, salle`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.ecartsCaisseHandler = async (req, res, next) => {
  try {
    const { salle, session_id } = req.query;
    const clauses = [];
    const params = [];
    if (salle) { clauses.push('salle = ?'); params.push(salle); }
    if (session_id) { clauses.push('session_id = ?'); params.push(session_id); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM v_casino_ecarts_caisse ${where} ORDER BY ouverture_at DESC`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.encoursCreditHandler = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM v_casino_encours_credit ORDER BY encours_total DESC`);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.fluxPendingHandler = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 'cash_operation' AS source, id, ref_flux_global, montant, created_at
        FROM casino_cash_operations
       WHERE ref_flux_global IS NOT NULL
         AND ref_flux_global NOT IN (SELECT ref_flux_global FROM financial_transactions WHERE ref_flux_global IS NOT NULL)
      UNION ALL
      SELECT 'chip_transaction' AS source, id, ref_flux_global, montant_total, created_at
        FROM casino_chip_transactions
       WHERE ref_flux_global IS NOT NULL
         AND ref_flux_global NOT IN (SELECT ref_flux_global FROM financial_transactions WHERE ref_flux_global IS NOT NULL)
      UNION ALL
      SELECT 'credit_repayment' AS source, id, ref_flux_global, montant, created_at
        FROM casino_credit_repayments
       WHERE ref_flux_global IS NOT NULL
         AND ref_flux_global NOT IN (SELECT ref_flux_global FROM financial_transactions WHERE ref_flux_global IS NOT NULL)
      ORDER BY created_at
    `);
    res.json(rows);
  } catch (err) { next(err); }
};

// =====================================================================
// Sessions de caisse
// =====================================================================

exports.activeSessionsHandler = async (req, res, next) => {
  try {
    const { cashier_id } = req.query;
    const clauses = [`statut = 'OUVERTE'`];
    const params = [];
    if (cashier_id) { clauses.push('cashier_id = ?'); params.push(cashier_id); }
    const [rows] = await pool.query(
      `SELECT * FROM casino_cashier_sessions WHERE ${clauses.join(' AND ')} ORDER BY ouverture_at DESC`, params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.openSessionHandler = async (req, res, next) => {
  try {
    const { cashier_id, fond_initial } = req.body;
    if (!cashier_id) throw ApiError.badRequest('cashier_id requis');

    const session = await withTransaction(async (conn) => {
      const [existing] = await conn.query(
        `SELECT id FROM casino_cashier_sessions WHERE cashier_id = ? AND statut = 'OUVERTE' LIMIT 1`,
        [cashier_id]
      );
      if (existing.length) throw ApiError.conflict('Une session est déjà ouverte pour cette caisse');

      const [result] = await conn.query(
        `INSERT INTO casino_cashier_sessions (cashier_id, user_id, ouverture_at, fond_initial, statut)
         VALUES (?, ?, NOW(), ?, 'OUVERTE')`,
        [cashier_id, caissierId(req), asMoney(fond_initial || 0)]
      );
      await conn.query(`UPDATE casino_cashiers SET statut = 'OUVERTE' WHERE id = ?`, [cashier_id]);
      const [[row]] = await conn.query(`SELECT * FROM casino_cashier_sessions WHERE id = ?`, [result.insertId]);
      return row;
    });

    res.status(201).json(session);
  } catch (err) { next(err); }
};

async function computeSessionTotals(conn, sessionId) {
  const [[cashTotals]] = await conn.query(
    `SELECT
       SUM(CASE WHEN type_operation IN ('BUY_IN','DEPOT','REMBOURSEMENT_CREDIT') THEN montant ELSE 0 END) AS entrees,
       SUM(CASE WHEN type_operation IN ('CASH_OUT','AVANCE_CREDIT') THEN montant ELSE 0 END) AS sorties
     FROM casino_cash_operations WHERE cashier_session_id = ?`,
    [sessionId]
  );
  const [[chipTotals]] = await conn.query(
    `SELECT
       SUM(CASE WHEN type_operation = 'ACHAT' THEN montant_total ELSE 0 END) AS entrees,
       SUM(CASE WHEN type_operation = 'REPRISE' THEN montant_total ELSE 0 END) AS sorties
     FROM casino_chip_transactions WHERE cashier_session_id = ?`,
    [sessionId]
  );
  const entrees = Number(cashTotals.entrees || 0) + Number(chipTotals.entrees || 0);
  const sorties = Number(cashTotals.sorties || 0) + Number(chipTotals.sorties || 0);
  return { entrees, sorties };
}

exports.closeSessionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fond_final_declare, commentaire } = req.body;

    const updated = await withTransaction(async (conn) => {
      const session = await getOpenSession(conn, id);
      if (!session) throw ApiError.notFound('Session introuvable ou déjà fermée');

      const { entrees, sorties } = await computeSessionTotals(conn, id);
      const fondFinalTheorique = Number(session.fond_initial) + entrees - sorties;
      const declare = asMoney(fond_final_declare);
      const ecart = declare - fondFinalTheorique;

      await conn.query(
        `UPDATE casino_cashier_sessions
           SET fermeture_at = NOW(), fond_final_declare = ?, fond_final_theorique = ?, ecart = ?,
               statut = 'FERMEE', commentaire = ?
         WHERE id = ?`,
        [declare, fondFinalTheorique, ecart, commentaire || null, id]
      );
      await conn.query(`UPDATE casino_cashiers SET statut = 'FERMEE' WHERE id = ?`, [session.cashier_id]);

      const [[row]] = await conn.query(`SELECT * FROM casino_cashier_sessions WHERE id = ?`, [id]);
      return row;
    });

    res.json(updated);
  } catch (err) { next(err); }
};

exports.sessionSummaryHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[session]] = await pool.query(`SELECT * FROM casino_cashier_sessions WHERE id = ?`, [id]);
    if (!session) throw ApiError.notFound('Session introuvable');
    const { entrees, sorties } = await computeSessionTotals(pool, id);
    res.json({
      session,
      total_entrees: entrees,
      total_sorties: sorties,
      solde_theorique: Number(session.fond_initial) + entrees - sorties,
    });
  } catch (err) { next(err); }
};

exports.sessionTransactionsHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT 'cash_operation' AS source, id, type_operation, montant, moyen_paiement, client_id, client_libre, created_at
         FROM casino_cash_operations WHERE cashier_session_id = ?
       UNION ALL
       SELECT 'chip_transaction' AS source, id, type_operation, montant_total AS montant, moyen_paiement, client_id, client_libre, created_at
         FROM casino_chip_transactions WHERE cashier_session_id = ?
       ORDER BY created_at`,
      [id, id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// =====================================================================
// Clients en caisse (recherche / ajout simple, sans carte obligatoire)
// =====================================================================

exports.searchClientHandler = async (req, res, next) => {
  try {
    const { q = '' } = req.query;
    const like = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT id, code_client, nom, prenom, telephone, is_casino_player, statut
         FROM clients
        WHERE nom LIKE ? OR prenom LIKE ? OR telephone LIKE ? OR code_client LIKE ?
        ORDER BY nom LIMIT 20`,
      [like, like, like, like]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.quickAddClientHandler = async (req, res, next) => {
  try {
    const { nom, prenom, telephone } = req.body;
    if (!nom) throw ApiError.badRequest('nom requis');
    const [result] = await pool.query(
      `INSERT INTO clients (nom, prenom, telephone, is_casino_player, statut, created_at)
       VALUES (?, ?, ?, 1, 'ACTIF', NOW())`,
      [nom, prenom || null, telephone || null]
    );
    const [[client]] = await pool.query(`SELECT * FROM clients WHERE id = ?`, [result.insertId]);
    res.status(201).json(client);
  } catch (err) { next(err); }
};

exports.clientProfileHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[client]] = await pool.query(`SELECT * FROM clients WHERE id = ?`, [id]);
    if (!client) throw ApiError.notFound('Client introuvable');
    const [[profile]] = await pool.query(`SELECT * FROM casino_client_profiles WHERE client_id = ?`, [id]);
    const [[card]] = await pool.query(`SELECT * FROM casino_cards WHERE client_id = ?`, [id]);
    const [[lastScore]] = await pool.query(
      `SELECT * FROM casino_scores WHERE client_id = ? ORDER BY calcule_le DESC LIMIT 1`, [id]
    );
    res.json({ client, profile: profile || null, card: card || null, dernier_score: lastScore || null });
  } catch (err) { next(err); }
};

exports.clientHistoryHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [visites] = await pool.query(
      `SELECT v.*, r.nom AS salle FROM casino_visits v
         JOIN casino_rooms r ON r.id = v.room_id
        WHERE v.client_id = ? ORDER BY v.entree_at DESC LIMIT 100`,
      [id]
    );
    const [salles] = await pool.query(
      `SELECT r.id, r.nom, COUNT(*) AS nb_visites
         FROM casino_visits v JOIN casino_rooms r ON r.id = v.room_id
        WHERE v.client_id = ? GROUP BY r.id, r.nom ORDER BY nb_visites DESC`,
      [id]
    );
    res.json({ visites, salles_frequentees: salles });
  } catch (err) { next(err); }
};

exports.clientConsumptionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [[stats]] = await pool.query(
      `SELECT COUNT(*) AS nb_commandes, COALESCE(AVG(montant_total),0) AS panier_moyen,
              MIN(created_at) AS premiere_commande, MAX(created_at) AS derniere_commande
         FROM orders WHERE client_id = ? AND source_module IN ('RESTAURANT','BAR')`,
      [id]
    );
    res.json(stats);
  } catch (err) { next(err); }
};

exports.clientIncidentsHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM casino_incidents WHERE client_id = ? ORDER BY created_at DESC`, [id]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// =====================================================================
// Cartes de fidélité + scan QR
// =====================================================================

exports.scanCardHandler = async (req, res, next) => {
  try {
    const { qrCode } = req.params;
    const [[card]] = await pool.query(`SELECT * FROM casino_cards WHERE qr_code = ?`, [qrCode]);
    if (!card) throw ApiError.notFound('Carte introuvable pour ce QR code');
    const [[client]] = await pool.query(`SELECT * FROM clients WHERE id = ?`, [card.client_id]);
    const [[profile]] = await pool.query(`SELECT * FROM casino_client_profiles WHERE client_id = ?`, [card.client_id]);
    res.json({ card, client, profile: profile || null });
  } catch (err) { next(err); }
};

exports.cardByClientHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const [[card]] = await pool.query(`SELECT * FROM casino_cards WHERE client_id = ?`, [clientId]);
    if (!card) throw ApiError.notFound('Aucune carte pour ce client');
    res.json(card);
  } catch (err) { next(err); }
};

exports.addPointsHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { points } = req.body;
    if (!Number.isFinite(Number(points))) throw ApiError.badRequest('points invalide');
    await pool.query(`UPDATE casino_cards SET points = points + ? WHERE id = ?`, [Number(points), id]);
    const [[card]] = await pool.query(`SELECT * FROM casino_cards WHERE id = ?`, [id]);
    if (!card) throw ApiError.notFound('Carte introuvable');
    res.json(card);
  } catch (err) { next(err); }
};

// =====================================================================
// Profil client / statut spécial (toujours une décision humaine)
// =====================================================================

exports.setClientStatutHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { statut_special, motif } = req.body;
    const allowed = ['NORMAL', 'VIP', 'A_SURVEILLER', 'EXCLU', 'AUTO_EXCLU'];
    if (!allowed.includes(statut_special)) throw ApiError.badRequest('statut_special invalide');

    await pool.query(
      `INSERT INTO casino_client_profiles (client_id, statut_special, motif, date_effet, decide_par)
       VALUES (?, ?, ?, CURDATE(), ?)
       ON DUPLICATE KEY UPDATE statut_special = VALUES(statut_special), motif = VALUES(motif),
         date_effet = VALUES(date_effet), decide_par = VALUES(decide_par), updated_at = NOW()`,
      [clientId, statut_special, motif || null, caissierId(req)]
    );
    const [[profile]] = await pool.query(`SELECT * FROM casino_client_profiles WHERE client_id = ?`, [clientId]);
    res.json(profile);
  } catch (err) { next(err); }
};

// =====================================================================
// Jetons — mouvements (le CRUD des types est `chipTypesCrud` ci-dessus)
// =====================================================================

async function chipMovement(req, res, next, typeOperation) {
  try {
    const { session_id, chip_type_id, quantite, client_id, client_libre, moyen_paiement } = req.body;
    const qty = Number(quantite);
    if (!Number.isInteger(qty) || qty <= 0) throw ApiError.badRequest('quantite invalide');

    const tx = await withTransaction(async (conn) => {
      const session = await getOpenSession(conn, session_id);
      if (!session) throw ApiError.badRequest('Session de caisse introuvable ou fermée');

      const [[chipType]] = await conn.query(`SELECT * FROM casino_chip_types WHERE id = ? AND statut = 'ACTIF'`, [chip_type_id]);
      if (!chipType) throw ApiError.notFound('Type de jeton introuvable ou inactif');

      const ref = genRef();
      const [result] = await conn.query(
        `INSERT INTO casino_chip_transactions
           (chip_type_id, cashier_session_id, client_id, client_libre, type_operation, quantite, valeur_unitaire,
            moyen_paiement, ref_flux_global, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [chip_type_id, session_id, client_id || null, client_id ? null : (client_libre || null),
         typeOperation, qty, chipType.valeur_nominale, moyen_paiement || 'ESPECES', ref, caissierId(req)]
      );

      const montantTotal = qty * chipType.valeur_nominale;
      await recordFinancialTransaction(conn, {
        client_id: client_id || null,
        type_flux: typeOperation === 'ACHAT' ? 'ENTREE_CAISSE_CASINO' : 'SORTIE_CAISSE_CASINO',
        montant: montantTotal,
        reference_id: result.insertId,
        ref_flux_global: ref,
        description: `${typeOperation} ${qty} jeton(s) ${chipType.nom}`,
      });

      const [[row]] = await conn.query(`SELECT * FROM casino_chip_transactions WHERE id = ?`, [result.insertId]);
      return row;
    });

    res.status(201).json(tx);
  } catch (err) { next(err); }
}

exports.buyChipsHandler = (req, res, next) => chipMovement(req, res, next, 'ACHAT');
exports.sellChipsHandler = (req, res, next) => chipMovement(req, res, next, 'REPRISE');

exports.chipHistoryByClientHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const [rows] = await pool.query(
      `SELECT ct.*, t.nom AS type_jeton FROM casino_chip_transactions ct
         JOIN casino_chip_types t ON t.id = ct.chip_type_id
        WHERE ct.client_id = ? ORDER BY ct.created_at DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// =====================================================================
// Opérations de caisse (buy-in / cash-out / dépôt)
// =====================================================================

async function insertCashOperation(req, res, next, typeOperation) {
  try {
    const { session_id, montant, moyen_paiement, client_id, client_libre } = req.body;
    const amount = asMoney(montant);

    const op = await withTransaction(async (conn) => {
      const session = await getOpenSession(conn, session_id);
      if (!session) throw ApiError.badRequest('Session de caisse introuvable ou fermée');

      const ref = genRef();
      const [result] = await conn.query(
        `INSERT INTO casino_cash_operations
           (cashier_session_id, client_id, client_libre, type_operation, montant, moyen_paiement,
            ref_flux_global, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [session_id, client_id || null, client_id ? null : (client_libre || null),
         typeOperation, amount, moyen_paiement || 'ESPECES', ref, caissierId(req)]
      );

      const entree = ['BUY_IN', 'DEPOT', 'REMBOURSEMENT_CREDIT'].includes(typeOperation);
      await recordFinancialTransaction(conn, {
        client_id: client_id || null,
        type_flux: entree ? 'ENTREE_CAISSE_CASINO' : 'SORTIE_CAISSE_CASINO',
        montant: amount,
        reference_id: result.insertId,
        ref_flux_global: ref,
        description: `${typeOperation} caisse casino`,
      });

      const [[row]] = await conn.query(`SELECT * FROM casino_cash_operations WHERE id = ?`, [result.insertId]);
      return row;
    });

    res.status(201).json(op);
  } catch (err) { next(err); }
}

exports.buyInHandler = (req, res, next) => insertCashOperation(req, res, next, 'BUY_IN');
exports.cashOutHandler = (req, res, next) => insertCashOperation(req, res, next, 'CASH_OUT');
exports.depositHandler = (req, res, next) => insertCashOperation(req, res, next, 'DEPOT');

// =====================================================================
// Crédits joueur
// =====================================================================

exports.grantCreditHandler = async (req, res, next) => {
  try {
    const { client_id, montant, echeance, session_id } = req.body;
    const amount = asMoney(montant);

    const credit = await withTransaction(async (conn) => {
      const config = await getScoringConfigMap(conn);
      const [[card]] = await conn.query(`SELECT plafond_credit FROM casino_cards WHERE client_id = ?`, [client_id]);
      const plafond = (card && card.plafond_credit != null) ? Number(card.plafond_credit) : Number(config.plafond_credit_defaut || 0);

      const [[encoursRow]] = await conn.query(
        `SELECT COALESCE(SUM(encours),0) AS total FROM casino_credits WHERE client_id = ? AND statut IN ('ACTIF','EN_RETARD')`,
        [client_id]
      );
      if (Number(encoursRow.total) + amount > plafond) {
        throw ApiError.conflict(`Plafond de crédit dépassé (plafond: ${plafond}, encours actuel: ${encoursRow.total})`);
      }

      const [result] = await conn.query(
        `INSERT INTO casino_credits (client_id, session_id, montant_accorde, encours, date_octroi, echeance, statut, created_by)
         VALUES (?, ?, ?, ?, NOW(), ?, 'ACTIF', ?)`,
        [client_id, session_id || null, amount, amount, echeance || null, caissierId(req)]
      );
      const [[row]] = await conn.query(`SELECT * FROM casino_credits WHERE id = ?`, [result.insertId]);
      return row;
    });

    res.status(201).json(credit);
  } catch (err) { next(err); }
};

exports.drawCreditHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { session_id, montant, moyen_paiement } = req.body;
    const amount = asMoney(montant);

    const op = await withTransaction(async (conn) => {
      const [[credit]] = await conn.query(`SELECT * FROM casino_credits WHERE id = ? AND statut IN ('ACTIF','EN_RETARD')`, [id]);
      if (!credit) throw ApiError.notFound('Crédit introuvable ou soldé');

      const session = await getOpenSession(conn, session_id);
      if (!session) throw ApiError.badRequest('Session de caisse introuvable ou fermée');

      const ref = genRef();
      const [result] = await conn.query(
        `INSERT INTO casino_cash_operations
           (cashier_session_id, client_id, type_operation, montant, moyen_paiement, credit_id, ref_flux_global, created_by, created_at)
         VALUES (?, ?, 'AVANCE_CREDIT', ?, ?, ?, ?, ?, NOW())`,
        [session_id, credit.client_id, amount, moyen_paiement || 'ESPECES', id, ref, caissierId(req)]
      );
      await recordFinancialTransaction(conn, {
        client_id: credit.client_id,
        type_flux: 'SORTIE_CAISSE_CASINO',
        montant: amount,
        reference_id: result.insertId,
        ref_flux_global: ref,
        description: `Avance sur crédit #${id}`,
      });

      const [[row]] = await conn.query(`SELECT * FROM casino_cash_operations WHERE id = ?`, [result.insertId]);
      return row;
    });

    res.status(201).json(op);
  } catch (err) { next(err); }
};

exports.repayCreditHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { montant, moyen_paiement, session_id } = req.body;
    const amount = asMoney(montant);

    const repayment = await withTransaction(async (conn) => {
      const [[credit]] = await conn.query(`SELECT * FROM casino_credits WHERE id = ?`, [id]);
      if (!credit) throw ApiError.notFound('Crédit introuvable');

      const delaiJours = credit.echeance
        ? Math.round((Date.now() - new Date(credit.echeance).getTime()) / 86400000)
        : null;

      const ref = genRef();
      const [repayResult] = await conn.query(
        `INSERT INTO casino_credit_repayments
           (credit_id, montant, date_remboursement, delai_jours, moyen_paiement, ref_flux_global, created_by, created_at)
         VALUES (?, ?, NOW(), ?, ?, ?, ?, NOW())`,
        [id, amount, delaiJours, moyen_paiement || 'ESPECES', ref, caissierId(req)]
      );

      const nouvelEncours = Math.max(0, Number(credit.encours) - amount);
      const nouveauStatut = nouvelEncours === 0 ? 'SOLDE' : (delaiJours && delaiJours > 0 ? 'EN_RETARD' : credit.statut);
      await conn.query(`UPDATE casino_credits SET encours = ?, statut = ? WHERE id = ?`, [nouvelEncours, nouveauStatut, id]);

      if (session_id) {
        await conn.query(
          `INSERT INTO casino_cash_operations
             (cashier_session_id, client_id, type_operation, montant, moyen_paiement, credit_id, created_by, created_at)
           VALUES (?, ?, 'REMBOURSEMENT_CREDIT', ?, ?, ?, ?, NOW())`,
          [session_id, credit.client_id, amount, moyen_paiement || 'ESPECES', id, caissierId(req)]
        );
      }

      await recordFinancialTransaction(conn, {
        client_id: credit.client_id,
        type_flux: 'ENTREE_CAISSE_CASINO',
        montant: amount,
        reference_id: repayResult.insertId,
        ref_flux_global: ref,
        description: `Remboursement crédit #${id}`,
      });

      const [[row]] = await conn.query(`SELECT * FROM casino_credit_repayments WHERE id = ?`, [repayResult.insertId]);
      return row;
    });

    res.status(201).json(repayment);
  } catch (err) { next(err); }
};

exports.activeCreditsByClientHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM casino_credits WHERE client_id = ? AND statut IN ('ACTIF','EN_RETARD') ORDER BY date_octroi DESC`,
      [clientId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// =====================================================================
// Scoring de crédit — configurable, traçable, jamais bloquant à lui seul
// =====================================================================

exports.getScoringConfigHandler = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM casino_scoring_config ORDER BY cle`);
    res.json(rows);
  } catch (err) { next(err); }
};

exports.updateScoringConfigHandler = async (req, res, next) => {
  try {
    const { cle, valeur } = req.body;
    if (!cle || valeur === undefined) throw ApiError.badRequest('cle et valeur requis');
    // Protégée par requireRole('admin','manager') au niveau de la route.
    const [result] = await pool.query(
      `UPDATE casino_scoring_config SET valeur = ?, updated_by = ?, updated_at = NOW() WHERE cle = ?`,
      [String(valeur), caissierId(req), cle]
    );
    if (result.affectedRows === 0) throw ApiError.notFound('Paramètre inconnu');
    const [[row]] = await pool.query(`SELECT * FROM casino_scoring_config WHERE cle = ?`, [cle]);
    res.json(row);
  } catch (err) { next(err); }
};

exports.computeScoreHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;

    const row = await withTransaction(async (conn) => {
      const config = await getScoringConfigMap(conn);
      const poids = {
        remboursement: Number(config.poids_ratio_remboursement || 0),
        retard: Number(config.poids_retard_moyen || 0),
        encours: Number(config.poids_encours_vs_plafond || 0),
        anciennete: Number(config.poids_anciennete || 0),
        regularite: Number(config.poids_regularite || 0),
      };
      const plafondDefaut = Number(config.plafond_credit_defaut || 0);
      const seuilBon = Number(config.seuil_bon_payeur || 75);
      const seuilMoyen = Number(config.seuil_moyen_payeur || 50);

      const [[card]] = await conn.query(`SELECT plafond_credit FROM casino_cards WHERE client_id = ?`, [clientId]);
      const plafond = (card && card.plafond_credit != null) ? Number(card.plafond_credit) : plafondDefaut;

      const [[creditAgg]] = await conn.query(
        `SELECT COALESCE(SUM(montant_accorde),0) AS accorde, COALESCE(SUM(encours),0) AS encours_actuel
           FROM casino_credits WHERE client_id = ?`, [clientId]
      );
      const [[repayAgg]] = await conn.query(
        `SELECT COALESCE(SUM(cr.montant),0) AS rembourse, AVG(GREATEST(cr.delai_jours,0)) AS retard_moyen
           FROM casino_credit_repayments cr JOIN casino_credits c ON c.id = cr.credit_id
          WHERE c.client_id = ?`, [clientId]
      );
      const [[anciennete]] = await conn.query(
        `SELECT MIN(entree_at) AS premiere_visite FROM casino_visits WHERE client_id = ?`, [clientId]
      );
      const [[regularite]] = await conn.query(
        `SELECT COUNT(*) AS nb_visites_12m FROM casino_visits
          WHERE client_id = ? AND entree_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)`, [clientId]
      );

      const ratioRemboursement = creditAgg.accorde > 0
        ? Math.min(1, Number(repayAgg.rembourse) / Number(creditAgg.accorde)) : 1;
      const retardMoyenJours = Number(repayAgg.retard_moyen || 0);
      const retardScore = Math.max(0, 1 - Math.min(retardMoyenJours, 30) / 30);
      const encoursRatio = plafond > 0 ? Math.min(1, Number(creditAgg.encours_actuel) / plafond) : 0;
      const encoursScore = 1 - encoursRatio;
      const ancienneteMois = anciennete.premiere_visite
        ? Math.max(0, (Date.now() - new Date(anciennete.premiere_visite).getTime()) / (30 * 86400000)) : 0;
      const ancienneteScore = Math.min(1, ancienneteMois / 24);
      const regulariteScore = Math.min(1, Number(regularite.nb_visites_12m || 0) / 24);

      const totalPoids = Object.values(poids).reduce((a, b) => a + b, 0) || 1;
      const score = 100 * (
        poids.remboursement * ratioRemboursement +
        poids.retard * retardScore +
        poids.encours * encoursScore +
        poids.anciennete * ancienneteScore +
        poids.regularite * regulariteScore
      ) / totalPoids;

      const categorie = score >= seuilBon ? 'BON' : (score >= seuilMoyen ? 'MOYEN' : 'MAUVAIS');

      const facteurs = {
        ratio_remboursement: { valeur: ratioRemboursement, poids: poids.remboursement },
        retard_moyen_jours: { valeur: retardMoyenJours, score: retardScore, poids: poids.retard },
        encours_vs_plafond: { encours: Number(creditAgg.encours_actuel), plafond, ratio: encoursRatio, poids: poids.encours },
        anciennete_mois: { valeur: Math.round(ancienneteMois), poids: poids.anciennete },
        regularite_visites_12m: { valeur: Number(regularite.nb_visites_12m || 0), poids: poids.regularite },
        seuils: { seuil_bon_payeur: seuilBon, seuil_moyen_payeur: seuilMoyen },
      };

      const [result] = await conn.query(
        `INSERT INTO casino_scores (client_id, score, categorie, facteurs, calcule_le, decision)
         VALUES (?, ?, ?, ?, NOW(), 'AUCUNE')`,
        [clientId, score.toFixed(2), categorie, JSON.stringify(facteurs)]
      );
      const [[scoreRow]] = await conn.query(`SELECT * FROM casino_scores WHERE id = ?`, [result.insertId]);
      return scoreRow;
    });

    // Important : ce calcul ne modifie JAMAIS casino_client_profiles.statut_special
    // automatiquement. Toute conséquence (restriction, surveillance, exclusion)
    // nécessite un appel explicite à /client-profiles/:clientId/statut par un
    // humain, après revue de /scoring/:scoreId/decision.
    res.status(201).json(row);
  } catch (err) { next(err); }
};

exports.scoreHistoryHandler = async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const [rows] = await pool.query(
      `SELECT * FROM casino_scores WHERE client_id = ? ORDER BY calcule_le DESC`, [clientId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

exports.scoreDecisionHandler = async (req, res, next) => {
  try {
    const { scoreId } = req.params;
    const { decision, commentaire } = req.body;
    const allowed = ['VALIDEE', 'CONTESTEE', 'ANNULEE'];
    if (!allowed.includes(decision)) throw ApiError.badRequest('decision invalide');

    const [result] = await pool.query(
      `UPDATE casino_scores SET decision = ?, decide_par = ?, decide_le = NOW(), commentaire_contestation = ?
       WHERE id = ?`,
      [decision, caissierId(req), commentaire || null, scoreId]
    );
    if (result.affectedRows === 0) throw ApiError.notFound('Score introuvable');
    const [[row]] = await pool.query(`SELECT * FROM casino_scores WHERE id = ?`, [scoreId]);
    res.json(row);
  } catch (err) { next(err); }
};

// =====================================================================
// Visites de salle (check-in / check-out, QR ou manuel)
// =====================================================================

exports.checkInHandler = async (req, res, next) => {
  try {
    const { room_id, client_id, qr_code, entree_via } = req.body;
    let resolvedClientId = client_id || null;
    let cardId = null;

    if (qr_code) {
      const [[card]] = await pool.query(`SELECT * FROM casino_cards WHERE qr_code = ?`, [qr_code]);
      if (!card) throw ApiError.notFound('QR code inconnu');
      resolvedClientId = card.client_id;
      cardId = card.id;
    }
    if (!resolvedClientId) throw ApiError.badRequest('client_id ou qr_code requis');

    const [result] = await pool.query(
      `INSERT INTO casino_visits (client_id, room_id, card_id, entree_at, entree_via)
       VALUES (?, ?, ?, NOW(), ?)`,
      [resolvedClientId, room_id, cardId, entree_via || (qr_code ? 'QR' : 'MANUEL')]
    );
    const [[visit]] = await pool.query(`SELECT * FROM casino_visits WHERE id = ?`, [result.insertId]);
    res.status(201).json(visit);
  } catch (err) { next(err); }
};

exports.checkOutHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`UPDATE casino_visits SET sortie_at = NOW() WHERE id = ? AND sortie_at IS NULL`, [id]);
    if (result.affectedRows === 0) throw ApiError.notFound('Visite introuvable ou déjà clôturée');
    const [[visit]] = await pool.query(`SELECT * FROM casino_visits WHERE id = ?`, [id]);
    res.json(visit);
  } catch (err) { next(err); }
};

exports.currentlyInRoomHandler = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const [rows] = await pool.query(
      `SELECT v.*, c.nom, c.prenom FROM casino_visits v
         JOIN clients c ON c.id = v.client_id
        WHERE v.room_id = ? AND v.sortie_at IS NULL
        ORDER BY v.entree_at`,
      [roomId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};