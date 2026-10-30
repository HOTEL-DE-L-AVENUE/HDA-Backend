// Database/_integrationStock.js
// Tests d'intégration HTTP du module stock (A à L) sur une base réelle.
// Un serveur Express temporaire est démarré (sans les dispatchers de fond) et
// toutes les données créées sont supprimées à la fin, même en cas d'échec.
/* eslint-disable no-console */
require('dotenv').config();
require('express-async-errors');

const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const apiRoutes = require('../routes');
const { notFoundHandler, errorHandler } = require('../middlewares/errorHandler');
const barOrder = require('../models/barOrder.model');

const results = [];
let failures = 0;
function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures += 1;
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition || !detail ? '' : ` — ${detail}`}`);
}

const stamp = Date.now();
const hotelName = `TEST-INT-HOTEL-${stamp}`;
const barName = `TEST-INT-BAR-${stamp}`;
const ingName = `TEST-INT-ING-${stamp}`;

(async () => {
  const [[admin]] = await pool.query(
    `SELECT id_admin, role, email, module FROM users
      WHERE statut = 'actif' AND role IN ('admin', 'manager', 'stock_manager')
      ORDER BY FIELD(role, 'admin', 'manager', 'stock_manager'), id_admin LIMIT 1`
  );
  if (!admin) throw new Error('Aucun utilisateur de gestion actif pour les tests');

  const makeToken = (role) => jwt.sign(
    { id_admin: admin.id_admin, role, email: admin.email, module: admin.module },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const token = makeToken(admin.role);
  const serverToken = makeToken('serveur');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, body, authToken = token) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = text; }
    return { status: response.status, body: payload };
  };
  const dataOf = (res) => res.body?.data;
  const findItem = async (cle) => {
    const res = await call('GET', '/api/stock/overview?month=2026-10');
    return (dataOf(res) || []).find((row) => row.cle === cle) || null;
  };

  let hotelCle = null;
  let barCle = null;
  let ingCle = null;
  let hotelProductId = null;
  let barProductId = null;
  let ingId = null;
  const orderIds = [];

  try {
    // A. Lecture consolidée + validation du mois
    {
      const res = await call('GET', '/api/stock/overview?month=2026-10');
      const rows = dataOf(res);
      const sample = rows?.find((row) => row.cle === 'BAR-85') || rows?.[0];
      check('A1 — GET /overview renvoie 200 et une liste', res.status === 200 && Array.isArray(rows), `status=${res.status}`);
      check('A2 — Chaque ligne expose les agrégats mensuels et le statut',
        sample && ['stock_debut_mois', 'entree_mensuel', 'sortie_mensuel', 'vente_mensuel', 'statut'].every((key) => key in sample),
        JSON.stringify(sample && Object.keys(sample)));
      const bad = await call('GET', '/api/stock/overview?month=2026-13');
      check('A3 — Un mois invalide est refusé (400)', bad.status === 400, `status=${bad.status}`);
    }

    // B. Création d'un article Hôtel (PRODUCT) + statut élevé
    {
      const res = await call('POST', '/api/stock/overview/articles', {
        module: 'HOTEL',
        nom: hotelName,
        categorie: 'Test intégration',
        unite: 'unités',
        quantite: 10,
        seuil_minimum: 2,
        seuil_maximum: 8,
        prix_achat: 1000,
        prix_vente: 1500,
      });
      hotelCle = dataOf(res)?.cle;
      check('B1 — Création article Hôtel (201 + clé STK-)', res.status === 201 && /^STK-\d+$/.test(hotelCle || ''), `status=${res.status} cle=${hotelCle}`);
      const item = hotelCle ? await findItem(hotelCle) : null;
      hotelProductId = item?.product_id ?? null;
      check('B2 — L’article créé apparaît avec quantité, seuils et statut élevé',
        item && Number(item.quantite) === 10 && Number(item.seuil_minimum) === 2
          && Number(item.seuil_maximum) === 8 && item.statut === 'eleve',
        JSON.stringify(item && { quantite: item.quantite, min: item.seuil_minimum, max: item.seuil_maximum, statut: item.statut }));
      const missing = await call('POST', '/api/stock/overview/articles', { module: 'HOTEL' });
      check('B3 — Création sans nom refusée (400)', missing.status === 400, `status=${missing.status}`);
      const badModule = await call('POST', '/api/stock/overview/articles', { module: 'INCONNU', nom: `${hotelName}-X` });
      check('B4 — Module inconnu refusé (400)', badModule.status === 400, `status=${badModule.status}`);
    }

    // C. Entrée manuelle
    {
      const res = await call('POST', `/api/stock/overview/${hotelCle}/movements`, {
        type: 'ENTREE', quantite: 5, motif: 'Réception test', reference_externe: `BL-${stamp}`,
      });
      check('C1 — Entrée de 5 acceptée (201)', res.status === 201, `status=${res.status}`);
      const item = await findItem(hotelCle);
      check('C2 — Stock porté à 15 et entrée du mois visible',
        item && Number(item.quantite) === 15 && Number(item.entree_mensuel) >= 5,
        JSON.stringify(item && { quantite: item.quantite, entree: item.entree_mensuel }));
    }

    // D. Quantités invalides
    {
      for (const quantite of [0, -1, 'abc']) {
        const res = await call('POST', `/api/stock/overview/${hotelCle}/movements`, { type: 'ENTREE', quantite });
        check(`D — Quantité ${JSON.stringify(quantite)} refusée (400)`, res.status === 400, `status=${res.status}`);
      }
      const item = await findItem(hotelCle);
      check('D4 — Stock inchangé après refus (15)', item && Number(item.quantite) === 15, `quantite=${item?.quantite}`);
    }

    // E. Sortie supérieure au stock
    {
      const res = await call('POST', `/api/stock/overview/${hotelCle}/movements`, { type: 'SORTIE', quantite: 9999 });
      check('E1 — Sortie supérieure au stock refusée (400)', res.status === 400, `status=${res.status}`);
      const item = await findItem(hotelCle);
      check('E2 — Stock inchangé après refus (15)', item && Number(item.quantite) === 15, `quantite=${item?.quantite}`);
    }

    // F. Sortie valide
    {
      const res = await call('POST', `/api/stock/overview/${hotelCle}/movements`, { type: 'SORTIE', quantite: 5, motif: 'Consommation test' });
      check('F1 — Sortie de 5 acceptée (201)', res.status === 201, `status=${res.status}`);
      const item = await findItem(hotelCle);
      check('F2 — Stock porté à 10 et sortie du mois visible',
        item && Number(item.quantite) === 10 && Number(item.sortie_mensuel) >= 5,
        JSON.stringify(item && { quantite: item.quantite, sortie: item.sortie_mensuel }));
    }

    // G. Inventaire sans régularisation
    {
      const res = await call('POST', `/api/stock/overview/${hotelCle}/inventories`, {
        stock_reel: 9, regularise: false, motif: 'Inventaire test sans régularisation',
      });
      const data = dataOf(res);
      check('G1 — Inventaire accepté (201) avec écart -1', res.status === 201 && Number(data?.difference) === -1 && data?.regularise === false, `status=${res.status} diff=${data?.difference}`);
      const item = await findItem(hotelCle);
      check('G2 — Stock non régularisé (10) mais stock réel 9 et écart -1',
        item && Number(item.quantite) === 10 && Number(item.stock_reel) === 9 && Number(item.ecart) === -1,
        JSON.stringify(item && { quantite: item.quantite, reel: item.stock_reel, ecart: item.ecart }));
    }

    // H. Inventaire avec régularisation
    {
      const res = await call('POST', `/api/stock/overview/${hotelCle}/inventories`, {
        stock_reel: 7, regularise: true, motif: 'Inventaire test régularisé',
      });
      const data = dataOf(res);
      check('H1 — Inventaire régularisé accepté (201) avec mouvement',
        res.status === 201 && Number(data?.difference) === -3 && data?.regularise === true && Boolean(data?.movement?.id),
        `status=${res.status} diff=${data?.difference}`);
      const item = await findItem(hotelCle);
      check('H2 — Stock aligné sur le réel (7) et dernier stock réel 7',
        item && Number(item.quantite) === 7 && Number(item.stock_reel) === 7,
        JSON.stringify(item && { quantite: item.quantite, reel: item.stock_reel }));

      const update = await call('PUT', `/api/stock/overview/${hotelCle}`, { quantite: 8 });
      const afterUpdate = await findItem(hotelCle);
      check('H3 — Modification directe de la quantité tracée (7 → 8)',
        update.status === 200 && afterUpdate && Number(afterUpdate.quantite) === 8,
        `status=${update.status} quantite=${afterUpdate?.quantite}`);
    }

    // I. Liste des inventaires
    {
      const res = await call('GET', `/api/stock/inventories?month=2026-10&cle=${encodeURIComponent(hotelCle)}`);
      const rows = dataOf(res);
      check('I1 — Les deux inventaires sont listés avec théorique/réel/écart',
        res.status === 200 && Array.isArray(rows) && rows.length === 2
          && rows.every((row) => 'stock_theorique' in row && 'stock_reel' in row && 'ecart' in row),
        `status=${res.status} rows=${rows?.length}`);
    }

    // J. Historique détaillé et consolidé
    {
      const detail = await call('GET', `/api/stock/overview/${hotelCle}?month=2026-10`);
      const history = dataOf(detail)?.history || [];
      const types = history.map((row) => row.type_mouvement);
      check('J1 — Détail de l’article expose l’historique', detail.status === 200 && history.length >= 4, `rows=${history.length}`);
      check('J2 — Entrée, sortie et régularisation d’inventaire présents',
        types.includes('ENTREE') && types.includes('SORTIE')
          && history.some((row) => row.motif === 'Inventaire test régularisé'),
        types.join(','));
      const consolidated = await call('GET', '/api/stock/history?month=2026-10&limit=200');
      const rows = dataOf(consolidated);
      const mine = Array.isArray(rows) ? rows.filter((row) => row.article_nom === hotelName) : [];
      check('J3 — Historique consolidé contient les mouvements de l’article',
        consolidated.status === 200 && mine.length >= 4 && mine.some((row) => row.module === 'HOTEL'),
        `status=${consolidated.status} rows=${mine.length}`);
      const filtered = await call('GET', `/api/stock/history?month=2026-10&cle=${encodeURIComponent(hotelCle)}&limit=200`);
      const filteredRows = dataOf(filtered);
      check('J4 — Historique filtré par clé STK- ne renvoie que cet article',
        filtered.status === 200 && Array.isArray(filteredRows) && filteredRows.length >= 4
          && filteredRows.every((row) => row.article_nom === hotelName),
        `status=${filtered.status} rows=${filteredRows?.length}`);
    }

    // K. Article Bar : entiers, vente unique, anti-double décrémentation, suppression protégée
    {
      const created = await call('POST', '/api/stock/overview/articles', {
        module: 'BAR', nom: barName, categorie: 'Test intégration', unite: 'unités',
        quantite: 10, seuil_minimum: 2, seuil_maximum: 20, prix_achat: 100, prix_vente: 200,
      });
      barCle = dataOf(created)?.cle;
      const item = barCle ? await findItem(barCle) : null;
      barProductId = item?.product_id ?? null;
      check('K1 — Création article Bar (201 + clé BAR-)', created.status === 201 && /^BAR-\d+$/.test(barCle || ''), `status=${created.status} cle=${barCle}`);

      const decimal = await call('POST', `/api/stock/overview/${barCle}/movements`, { type: 'ENTREE', quantite: 1.5 });
      check('K2 — Quantité décimale refusée pour le Bar (400)', decimal.status === 400, `status=${decimal.status}`);

      const entry = await call('POST', `/api/stock/overview/${barCle}/movements`, { type: 'ENTREE', quantite: 5, motif: 'Réception test bar' });
      check('K3 — Entrée entière de 5 acceptée (201)', entry.status === 201, `status=${entry.status}`);

      const before = await findItem(barCle);
      const order = await barOrder.createBarOrder({
        clientName: 'Client test intégration',
        items: [{ product_id: barProductId, quantite: 2, prix: 200, prix_unitaire: 200, nom: barName }],
        createdBy: admin.id_admin,
      });
      orderIds.push(order.id);
      const afterSale = await findItem(barCle);
      const [[ledger]] = await pool.query(
        `SELECT COUNT(*) AS total FROM bar_stock_movements
          WHERE product_id = ? AND source_module = 'VENTE_BAR' AND reference_id = ?`,
        [barProductId, order.id]
      );
      check('K4 — Une vente décrémente le stock une seule fois (15 → 13)',
        before && afterSale && Number(before.quantite) === 15 && Number(afterSale.quantite) === 13,
        `${before?.quantite} → ${afterSale?.quantite}`);
      check('K5 — Une seule ligne de journal VENTE_BAR pour la commande',
        Number(ledger.total) === 1, `lignes=${ledger.total}`);

      const second = await barOrder.createBarOrder({
        clientName: 'Client test intégration 2',
        items: [{ product_id: barProductId, quantite: 1, prix: 200, prix_unitaire: 200, nom: barName }],
        createdBy: admin.id_admin,
      });
      orderIds.push(second.id);
      const afterSecond = await findItem(barCle);
      check('K6 — Deuxième vente décrémente encore une seule fois (13 → 12)',
        afterSecond && Number(afterSecond.quantite) === 12, `quantite=${afterSecond?.quantite}`);

      const blockedDelete = await call('DELETE', `/api/stock/overview/${barCle}`);
      check('K7 — Suppression d’un produit vendu refusée (400)', blockedDelete.status === 400, `status=${blockedDelete.status}`);

      for (const id of [...orderIds]) {
        await barOrder.deleteBarOrder(id);
      }
      orderIds.length = 0;
      const restored = await findItem(barCle);
      const [[restoredLedger]] = await pool.query(
        `SELECT COUNT(*) AS total FROM bar_stock_movements WHERE product_id = ? AND source_module = 'VENTE_BAR'`,
        [barProductId]
      );
      check('K8 — Annulation des ventes restaure le stock (15) et retire le journal de vente',
        restored && Number(restored.quantite) === 15 && Number(restoredLedger.total) === 0,
        `quantite=${restored?.quantite} lignes=${restoredLedger.total}`);
    }

    // L. Article Restaurant (INGREDIENT) : décimales et régularisation
    {
      const created = await call('POST', '/api/stock/overview/articles', {
        module: 'RESTAURANT', nom: ingName, unite: 'kg',
        quantite: 2.5, seuil_minimum: 0.5, seuil_maximum: 10, prix_achat: 1000,
      });
      ingCle = dataOf(created)?.cle;
      const item = ingCle ? await findItem(ingCle) : null;
      ingId = item?.ingredient_id ?? null;
      check('L1 — Création ingrédient Restaurant (201 + clé ING-)', created.status === 201 && /^ING-\d+-\d+$/.test(ingCle || ''), `status=${created.status} cle=${ingCle}`);
      check('L2 — Quantité décimale acceptée (2,5 kg)', item && Number(item.quantite) === 2.5, `quantite=${item?.quantite}`);

      const entry = await call('POST', `/api/stock/overview/${ingCle}/movements`, { type: 'ENTREE', quantite: 1.25, motif: 'Réception test ingrédient' });
      const exit = await call('POST', `/api/stock/overview/${ingCle}/movements`, { type: 'SORTIE', quantite: 0.75, motif: 'Consommation test ingrédient' });
      const after = await findItem(ingCle);
      check('L3 — Entrée/sortie décimales acceptées (2,5 + 1,25 − 0,75 = 3)',
        entry.status === 201 && exit.status === 201 && after && Number(after.quantite) === 3,
        `${entry.status}/${exit.status} quantite=${after?.quantite}`);

      const inventory = await call('POST', `/api/stock/overview/${ingCle}/inventories`, {
        stock_reel: 2.9, regularise: true, motif: 'Inventaire test ingrédient',
      });
      const afterInventory = await findItem(ingCle);
      check('L4 — Inventaire ingrédient régularisé (3 → 2,9)',
        inventory.status === 201 && afterInventory && Number(afterInventory.quantite) === 2.9,
        `status=${inventory.status} quantite=${afterInventory?.quantite}`);

      const update = await call('PUT', `/api/stock/overview/${ingCle}`, {
        seuil_minimum: 0.4, seuil_maximum: 8,
      });
      const afterUpdate = await findItem(ingCle);
      check('L5 — Seuils d’un ingrédient modifiables (min 0,4 / max 8)',
        update.status === 200 && afterUpdate && Number(afterUpdate.seuil_minimum) === 0.4
          && Number(afterUpdate.seuil_maximum) === 8,
        `status=${update.status} min=${afterUpdate?.seuil_minimum} max=${afterUpdate?.seuil_maximum}`);
    }

    // M. Contrôle des rôles
    {
      const res = await call('GET', '/api/stock/overview', undefined, serverToken);
      check('M1 — Rôle non autorisé refusé (403)', res.status === 403, `status=${res.status}`);
    }

    // N. Suppressions via l’API
    {
      const hotelDelete = await call('DELETE', `/api/stock/overview/${hotelCle}`);
      check('N1 — Suppression de l’article Hôtel acceptée', [200, 204].includes(hotelDelete.status), `status=${hotelDelete.status}`);
      const hotelGone = await findItem(hotelCle);
      check('N2 — L’article Hôtel disparaît de la vue consolidée', hotelGone === null, `cle=${hotelCle}`);

      const ingDelete = await call('DELETE', `/api/stock/overview/${ingCle}`);
      const ingGone = await findItem(ingCle);
      check('N3 — Suppression de l’ingrédient acceptée et ligne retirée',
        [200, 204].includes(ingDelete.status) && ingGone === null,
        `status=${ingDelete.status}`);

      const barDelete = await call('DELETE', `/api/stock/overview/${barCle}`);
      const barGone = await findItem(barCle);
      check('N4 — Suppression de l’article Bar acceptée et ligne retirée',
        [200, 204].includes(barDelete.status) && barGone === null,
        `status=${barDelete.status}`);
      if ([200, 204].includes(hotelDelete.status)) hotelCle = null;
      if ([200, 204].includes(ingDelete.status)) ingCle = null;
      if ([200, 204].includes(barDelete.status)) barCle = null;
    }
  } finally {
    // Nettoyage direct de toute donnée de test résiduelle.
    for (const id of orderIds) {
      try { await barOrder.deleteBarOrder(id); } catch (err) { console.error('Nettoyage commande bar:', err.message); }
    }
    if (hotelProductId) {
      await pool.query("DELETE FROM stock_inventories WHERE item_type = 'PRODUCT' AND product_id = ?", [hotelProductId]);
      await pool.query('DELETE FROM stock_movements WHERE product_id = ?', [hotelProductId]);
      await pool.query('DELETE FROM stocks WHERE product_id = ?', [hotelProductId]);
      await pool.query('DELETE FROM products WHERE id = ?', [hotelProductId]);
    }
    await pool.query("DELETE FROM stock_inventories WHERE motif LIKE 'Inventaire test%'");
    if (barProductId) {
      await pool.query("DELETE FROM stock_inventories WHERE item_type = 'BAR_PRODUCT' AND product_id = ?", [barProductId]);
      await pool.query('DELETE FROM bar_stock_movements WHERE product_id = ?', [barProductId]);
      await pool.query('DELETE FROM bar_stock WHERE product_id = ?', [barProductId]);
      await pool.query('DELETE FROM bar_products WHERE id = ?', [barProductId]);
    }
    if (ingId) {
      await pool.query("DELETE FROM stock_inventories WHERE item_type = 'INGREDIENT' AND ingredient_id = ?", [ingId]);
      await pool.query('DELETE FROM recipe_items WHERE ingredient_id = ?', [ingId]);
      await pool.query('DELETE FROM restaurant_ingredient_stock_movements WHERE ingredient_id = ?', [ingId]);
      await pool.query('DELETE FROM restaurant_ingredient_stocks WHERE ingredient_id = ?', [ingId]);
      await pool.query('DELETE FROM restaurant_ingredients WHERE id = ?', [ingId]);
    }
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }

  const passed = results.length - failures;
  console.log(`\nRésultat : ${passed}/${results.length} tests réussis, ${failures} échec(s).`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
