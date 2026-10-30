const stock = require('../models/stockModel');
const { pool } = require('../config/db');
(async () => {
  const rows = await stock.stockOverview('2026-10');
  console.log('overview rows:', rows.length);
  const bar = rows.filter(r => r.module === 'BAR');
  const sample = bar.find(r => r.nom === 'Sirop de Fraise') || bar.find(r => r.vente_mensuel) || bar[0];
  console.log('sample:', JSON.stringify(sample, null, 2));
  const withSales = rows.filter(r => r.vente_mensuel);
  console.log('items with sales this month:', withSales.length, withSales.slice(0, 5).map(r => ({ nom: r.nom, vente: r.vente_mensuel, q: r.quantite, debut: r.stock_debut_mois })));
  const ing = rows.find(r => r.item_type === 'INGREDIENT');
  console.log('ingredient sample:', ing && { nom: ing.nom, q: ing.quantite, min: ing.seuil_minimum, debut: ing.stock_debut_mois });
  if (sample) {
    const details = await stock.stockItemDetails(sample.cle, '2026-10');
    console.log('details history:', details.history.length, details.history.slice(0, 2));
  }
  const history = await stock.listStockHistory({ month: '2026-10', limit: 5 });
  console.log('history:', history.length, history[0]);
  const inventories = await stock.listInventories({ month: '2026-10' });
  console.log('inventories:', inventories.length);
  await pool.end();
})().catch(async (e) => { console.error(e); await pool.end(); process.exit(1); });
