// Database/seedRestaurantStockArticles.js
// Articles du stock cuisine repris des fiches de stock de l'hôtel (avr-24) :
// légumes / fruits, VFM viandes / poissons, épices, PPN, produits laitiers, sauces
// et kit de valorisation. Prix unitaire = colonne PU, unité = « unité de sortie ».
//
// Les recettes des plats (seedRestaurantIngredients.js) sont ensuite rattachées à ces
// articles réels : une commande au restaurant déduit donc du stock « Blanc de poulet »,
// « Riz basmati »… (voir models/restaurantModel.js, syncOrderIngredients).
const { pool } = require('../config/db');

const RESTAURANT_LOCATION_ID = 2;

// [nom, unité, prix unitaire (Ar) ou null si absent de la fiche]
// Les denrées sont des produits finis : elles apparaissent dans le Menu du restaurant
// (prix de vente initial = PU de la fiche, modifiable ensuite dans le Menu) et une
// commande de l'article le sort du stock. Le kit de valorisation reste en consommable.
const SECTIONS = [
  {
    category: 'Légumes', type: 'PRODUIT_FINI', items: [
      ['Ail', 'kg', 8000], ['Basilic', 'boîte', 1500], ['Carotte', 'kg', 2000], ['Ciboulette', 'botte', 1500],
      ['Citron vert', 'kg', 7000], ['Citronnelle', 'botte', 1000], ['Chou vert', 'pcs', 1500], ['Chou rouge', 'pcs', 3500],
      ['Concombre', 'kg', 2000], ['Combava', 'pcs', 1000], ['Coriandre', 'botte', 1500], ['Courgette', 'kg', 2000],
      ['Gingembre', 'kg', 8000], ['Haricot vert', 'kg', 2400], ['Mélange de brèdes', 'botte', 1000], ['Menthe', 'botte', 1500],
      ['Oignon', 'kg', 3000], ['Persil', 'botte', 1500], ['Petit pois', 'cup', 1500], ['Piment rouge (piment chilly)', 'cup', 3000],
      ['Piment vert', 'cup', 3000], ['Poivre vert', 'botte', 3000], ['Poivron vert', 'kg', 2500], ['Pomme de terre', 'kg', 2000],
      ['Salade rouge', 'pcs', 900], ['Salade verte', 'pcs', 700], ['Thym', 'botte', 1500], ['Tomate', 'kg', 2500],
      ['Laurier', 'botte', 1000], ['Romarin', 'botte', 1500], ['Piment bocal', 'bocal', null],
    ],
  },
  {
    category: 'Fruits', type: 'PRODUIT_FINI', items: [
      ['Banane', 'kg', 2000], ['Ananas', 'pcs', 3000], ['Papaye', 'pcs', 5000], ['Pastèque', 'pcs', 3500],
      ['Corossol', 'kg', 3000], ['Orange', 'kg', 3000], ['Pomme', 'kg', 3000], ['Prune', 'kg', 4000],
      ['Pok pok', 'cup', 1500], ['Grenadelle', 'kg', 3000], ['Litchis', 'kg', 2500],
    ],
  },
  {
    category: 'VFM - Viandes', type: 'PRODUIT_FINI', items: [
      ['Blanc de poulet', 'kg', 13000], ['Cuisse de poulet', 'kg', 12000], ['Aile de poulet', 'pcs', 13000],
      ['Poulet entier', 'pcs', 13200], ['Magret de canard', 'kg', 40000], ['Basse côte', 'kg', 13000],
      ['Saucisses', 'pcs', 13000], ['Filet de zébu', 'kg', 20000], ['Viande hachée', 'kg', 13000],
      ['Agneau désossé (gigot)', 'kg', 17000], ['Jambon de volaille', 'kg', 26500], ['Merguez', 'kg', 20000],
      ['Sambos poulet', 'pcs', 350], ['Sambos viande', 'pcs', 350], ['Blanc de poulet 200 g', 'pcs', null],
    ],
  },
  {
    category: 'VFM - Poissons / Fruits de mer', type: 'PRODUIT_FINI', items: [
      ['Crevette entête NN décortiquée 151 up', 'kg', 32500], ['Filet de sole', 'kg', 24000],
    ],
  },
  {
    category: 'Épices', type: 'PRODUIT_FINI', items: [
      ['Amande douce (30 g)', 'sachet', 3000], ['Cannelle poudre (150 g)', 'sachet', 1000], ['Carry en boîte étui 30 g', 'boîte', 720],
      ['Essence parfum gâteau (25 ml)', 'pcs', 3000], ['Jumbo', 'pcs', 150], ['Massala épice', 'sachet', 3000],
      ['Origan (100 g)', 'sachet', 1000], ['Pili pili - Sakay', 'bocal', 3500], ['Poivre en boîte étui 30 g', 'boîte', 720],
      ['Colorant rouge', 'boîte', 3000], ['Raisin sec', 'sachet', 3000], ['Tige de cannelle (5 bâtons)', 'sachet', 2000],
      ['Vanille (tige)', 'sachet', 5000], ['5 épices', 'sachet', 3000], ['Paprika', 'sachet', 2000],
      ['Cardamome', 'sachet', 5000], ['Tandoori', 'sachet', null],
    ],
  },
  {
    category: 'PPN', type: 'PRODUIT_FINI', items: [
      ['Cacao poudre 250 g', 'sachet', 3500], ['Café arabica 250 g', 'sachet', 7360], ['Supremo 10 pcs', 'pcs', 1042],
      ['Cremoso 10 pcs', 'pcs', 1041], ['Decaffeinato intenso', 'pcs', 1041], ['Corposo', 'pcs', 1041],
      ['Thé nature (20 infusions)', 'boîte', 3500], ['Confiture', 'bocal', 9500], ['Cornichon', 'bocal', 8000],
      ['Champignon de Paris', 'boîte', 4000], ['Lait de coco', 'bocal', 4920], ['Maïs doux', 'boîte', 3500],
      ['Câpres', 'bocal', 10000], ['Olive noire (800 g)', 'boîte', 11051], ['Olive verte dénoyautée 100 g', 'boîte', 11299],
      ['Miel Tantely 250 ml', 'btl', 4000], ['Thon en boîte', 'boîte', 3500], ['Tomate concentrée', 'boîte', 1000],
      ['Olive 250 g', 'boîte', null], ['Café en grain arabica 1 kg', 'sachet', null], ['Farine', 'kg', 2600],
      ['Couscous grain moyen (500 g)', 'boîte', 6000], ['Levure boulangère (500 g)', 'sachet', 7000],
      ['Levure chimique (35 g)', 'sachet', 300], ['Riz basmati', 'kg', 7000], ['Riz blanc', 'kg', 2200],
      ['Sel', 'sachet', 840], ['Spaghetti (500 g)', 'sachet', 1980], ['Sucre glace (100 g)', 'sachet', 3000],
      ['Sucre', 'kg', 2868], ['Chapelure 100 g', 'sachet', 500], ['Vinaigre balsamique', 'btl', null],
      ["Huile d'olive", 'L', 30360], ['Huile tournesol (1 L)', 'btl', 5200], ['Vinaigre blanc (1 L)', 'L', 840],
      ['Jus en brique pomme', 'brique', 3800], ['Jus en brique orange', 'brique', null],
      ['Chocolat de couverture noir', 'kg', 32000], ['Chocolat de couverture blanc', 'kg', 32000],
      ['Mini chocolat blanc (10 pcs)', 'paquet', 2000], ['Mini chocolat noir (10 pcs)', 'paquet', 2000],
      ['Popcorn 250 g', 'sachet', 5000], ['Œufs', 'pcs', 500], ['Bois de chauffage', 'unité', 55000],
      ["Maïs'nah", 'unité', null], ['Anchois', 'boîte', null], ['Olive 4 kg', 'seau', null],
    ],
  },
  {
    category: 'PPN - Produits laitiers', type: 'PRODUIT_FINI', items: [
      ['Beurre de feuilletage', 'kg', 30000], ['Beurre margarine', 'pcs', 3500], ['Crème neutre 1 L', 'brique', 14000],
      ['Crème pâtissière (100 g)', 'sachet', 2800], ['Crème sucrée 1 L', 'brique', 11550], ['Fromage dur Antsira', 'kg', 20000],
      ['Fromage fondu (8 portions)', 'pcs', 425], ['Fromage mozzarella', 'kg', 40000], ['Lait demi-écrémé (1 L)', 'brique', 3720],
      ['Yaourt nature', 'pcs', 800], ['Lait concentré PM', 'boîte', 3300], ['Fromage camembert', 'kg', 50000],
      ['Fromage parmesan', 'kg', 60000], ['Cheddar', 'kg', null], ['Mozzarella carrée', 'kg', null],
    ],
  },
  {
    category: 'PPN - Sauces', type: 'PRODUIT_FINI', items: [
      ['Ketchup', 'flacon', 5500], ['Mayonnaise', 'flacon', 9500], ['Moutarde', 'bocal', 4000],
      ['Sauce huître', 'btl', 7000], ['Sauce soja (1 L)', 'btl', 1500], ['Sauce chilly', 'btl', 2500],
    ],
  },
  {
    category: 'Kit de valorisation', type: 'CONSOMMABLE', items: [
      ['Boîte pizza GM 4 en 1', 'pcs', 1000], ['Boîte pizza GM 29×29', 'pcs', null], ['Cure-dent (douzaine)', 'paquet', 2000],
      ['Éponge', 'pcs', 500], ['Filtre café (40 feuilles)', 'boîte', 4500], ['Gaz (12,5 kg)', 'btl', 73000],
      ['Paille de fer', 'pcs', 300], ['Paille (pipette) 50 pcs', 'sachet', 2500], ['Papier aluminium 30 m', 'rouleau', 5000],
      ['Papier film 30 m', 'rouleau', 4000], ['Papier hygiénique Soft Pros', 'rouleau', 10680], ['Sac poubelle 30/50 L', 'paquet', 6000],
      ['Serviette papier Bloom', 'paquet', 2200], ['Tige de brochette', 'boîte', 2000], ['Savon (barre)', 'pcs', 5500],
      ['Sac poubelle 100 L', 'rouleau', 6000], ['Essuie-tout', 'rouleau', null], ['Papier cuisson', 'rouleau', 6500],
      ['Lave-main', 'btl', null], ['Eau de Javel', 'btl', 1700], ['Klin', 'pcs', 300], ['Détartrant', 'btl', 3200],
      ['Savonnette', 'pcs', 270], ['Cire GM', 'boîte', 15000], ['Synapole', 'btl', null], ['Surgibac', 'btl', null],
      ['C-Ramic', 'btl', null], ['Manifold autocopiant', 'pcs', null], ['Rouleau de caisse', 'rouleau', null],
      ['Rouleau TPE', 'rouleau', null], ['Rame papier A4', 'rame', null], ["Feu d'artifice PM", 'pcs', null],
      ["Feu d'artifice MM", 'pcs', null],
    ],
  },
];

// Ingrédients génériques des recettes (ING_*) remplacés par l'article réel de la fiche.
// factor = nombre d'unités de l'article pour 1 unité de l'ingrédient générique
// (ex. 1 kg de pâtes = 2 sachets de spaghetti 500 g ; 1 kg de curry = 33,3 boîtes de 30 g).
const RECIPE_MAPPING = [
  { from: 'ING_POULET', to: 'Blanc de poulet', factor: 1 },
  { from: 'ING_BOEUF', to: 'Filet de zébu', factor: 1 },
  { from: 'ING_MOUTON', to: 'Agneau désossé (gigot)', factor: 1 },
  { from: 'ING_CREVETTES', to: 'Crevette entête NN décortiquée 151 up', factor: 1 },
  { from: 'ING_OIGNONS', to: 'Oignon', factor: 1 },
  { from: 'ING_TOMATES', to: 'Tomate', factor: 1 },
  { from: 'ING_AIL', to: 'Ail', factor: 1 },
  { from: 'ING_GINGEMBRE', to: 'Gingembre', factor: 1 },
  { from: 'ING_POMMES_DE_TERRE', to: 'Pomme de terre', factor: 1 },
  { from: 'ING_CAROTTES', to: 'Carotte', factor: 1 },
  { from: 'ING_POIVRONS', to: 'Poivron vert', factor: 1 },
  { from: 'ING_CITRONS', to: 'Citron vert', factor: 1 },
  { from: 'ING_RIZ', to: 'Riz basmati', factor: 1 },
  { from: 'ING_FARINE', to: 'Farine', factor: 1 },
  { from: 'ING_HUILE', to: 'Huile tournesol (1 L)', factor: 1 },
  { from: 'ING_HUILE_OLIVE', to: "Huile d'olive", factor: 1 },
  { from: 'ING_LAIT', to: 'Lait demi-écrémé (1 L)', factor: 1 },
  { from: 'ING_CREME', to: 'Crème neutre 1 L', factor: 1 },
  { from: 'ING_FROMAGE', to: 'Fromage mozzarella', factor: 1 },
  { from: 'ING_OEUF', to: 'Œufs', factor: 1 },
  { from: 'ING_SAUCE_SOJA', to: 'Sauce soja (1 L)', factor: 1 },
  { from: 'ING_PATES', to: 'Spaghetti (500 g)', factor: 2 },
  { from: 'ING_CURRY', to: 'Carry en boîte étui 30 g', factor: 1 / 0.03 },
  { from: 'ING_POIVRE', to: 'Poivre en boîte étui 30 g', factor: 1 / 0.03 },
  { from: 'ING_LEVURE', to: 'Levure boulangère (500 g)', factor: 2 },
];

const slug = (text) => text
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/œ/gi, 'OE').toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  .slice(0, 40);

class SeedRestaurantStockArticles {
  async run() {
    console.log('🚀 Articles du stock cuisine (fiches de stock)...');

    const productIds = {};
    let created = 0;
    let updated = 0;

    for (const section of SECTIONS) {
      const [cat] = await pool.query('SELECT id FROM categories WHERE nom = ? LIMIT 1', [section.category]);
      const categoryId = cat.length ? cat[0].id : (await pool.query('INSERT INTO categories (nom) VALUES (?)', [section.category]))[0].insertId;

      for (const [nom, unite, prix] of section.items) {
        const code = `RST_${slug(nom)}`;
        const [existing] = await pool.query('SELECT id FROM products WHERE code = ? LIMIT 1', [code]);
        if (existing.length) {
          await pool.query(
            `UPDATE products SET nom = ?, category_id = ?, unite = ?, prix_achat = ?, prix_vente = COALESCE(NULLIF(prix_vente, 0), ?), type_produit = ?, source_module = 'RESTAURANT', actif = 1
             WHERE id = ?`,
            [nom, categoryId, unite, prix, section.type === 'PRODUIT_FINI' ? (prix || 0) : null, section.type, existing[0].id]
          );
          productIds[nom] = existing[0].id;
          updated++;
        } else {
          const [result] = await pool.query(
            `INSERT INTO products (category_id, code, nom, unite, prix_achat, prix_vente, actif, type_produit, source_module)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'RESTAURANT')`,
            [categoryId, code, nom, unite, prix, section.type === 'PRODUIT_FINI' ? (prix || 0) : null, section.type]
          );
          productIds[nom] = result.insertId;
          created++;
        }
      }
    }
    console.log(`📦 Articles : ${created} créés, ${updated} mis à jour`);

    // Rattachement des recettes : l'ingrédient générique est remplacé par l'article réel,
    // son stock de départ est reporté (converti) puis la ligne générique est retirée.
    let remappedItems = 0;
    const mappedTargets = new Set();
    for (const { from, to, factor } of RECIPE_MAPPING) {
      const [[generic]] = await pool.query('SELECT id FROM products WHERE code = ? LIMIT 1', [from]);
      const articleId = productIds[to];
      if (!generic || !articleId) continue;
      mappedTargets.add(articleId);

      const [res] = await pool.query(
        'UPDATE recipe_items SET ingredient_id = ?, quantite = ROUND(quantite * ?, 3) WHERE ingredient_id = ?',
        [articleId, factor, generic.id]
      );
      remappedItems += res.affectedRows;

      const [[genericStock]] = await pool.query(
        'SELECT id, quantite FROM stocks WHERE product_id = ? AND location_id = ?',
        [generic.id, RESTAURANT_LOCATION_ID]
      );
      const [[articleStock]] = await pool.query(
        'SELECT id FROM stocks WHERE product_id = ? AND location_id = ?',
        [articleId, RESTAURANT_LOCATION_ID]
      );
      if (!articleStock) {
        const initial = genericStock ? Math.round(Number(genericStock.quantite) * factor * 100) / 100 : 0;
        await pool.query(
          'INSERT INTO stocks (product_id, location_id, quantite) VALUES (?, ?, ?)',
          [articleId, RESTAURANT_LOCATION_ID, initial]
        );
      }
      if (genericStock) await pool.query('DELETE FROM stocks WHERE id = ?', [genericStock.id]);
      await pool.query('UPDATE products SET actif = 0 WHERE id = ?', [generic.id]);
    }
    console.log(`🍽️ Recettes rattachées aux articles réels : ${remappedItems} lignes`);

    // Les autres articles ont une ligne de stock au restaurant (stock initial des fiches : 0).
    let stockCreated = 0;
    for (const id of Object.values(productIds)) {
      if (mappedTargets.has(id)) continue;
      const [res] = await pool.query(
        `INSERT INTO stocks (product_id, location_id, quantite)
         SELECT ?, ?, 0 FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM stocks WHERE product_id = ? AND location_id = ?)`,
        [id, RESTAURANT_LOCATION_ID, id, RESTAURANT_LOCATION_ID]
      );
      stockCreated += res.affectedRows;
    }
    console.log(`📊 Lignes de stock restaurant créées : ${stockCreated}`);
    console.log('✅ Articles du stock cuisine terminés');
  }
}

if (require.main === module) {
  new SeedRestaurantStockArticles().run()
    .then(() => process.exit(0))
    .catch((error) => { console.error('❌', error); process.exit(1); });
}

module.exports = SeedRestaurantStockArticles;
