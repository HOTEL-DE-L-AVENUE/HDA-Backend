const { pool } = require('../config/db');
(async () => {
  const tables = ['stocks','bar_stock','bar_products','restaurant_ingredient_stocks','restaurant_ingredients','stock_movements','restaurant_ingredient_stock_movements','bar_transactions','bar_orders','stock_inventories','bar_stock_movements','stock_locations'];
  for (const t of tables) {
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${t}\``);
    console.log(`\n== ${t} ==`);
    console.log(cols.map(c => `${c.Field}:${c.Type}${c.Null==='NO'?' NOT NULL':''}${c.Key?` [${c.Key}]`:''}${c.Default!==null?` def=${c.Default}`:''}`).join(' | '));
    if (['stocks','bar_stock','bar_products','restaurant_ingredient_stocks','restaurant_ingredients','stock_movements','restaurant_ingredient_stock_movements','bar_transactions','bar_orders','stock_inventories','bar_stock_movements','stock_locations'].includes(t)) {
      const [[count]] = await pool.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      console.log('rows:', count.n);
    }
  }
  const [locs] = await pool.query('SELECT id, nom FROM stock_locations ORDER BY id');
  console.log('\nlocations:', JSON.stringify(locs));
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
