// src/Models/restaurant.model.js
const { getPool } = require('../Config/connectDatabase');

class RestaurantModel {
  // ==================== TABLES RESTAURANT ====================
  
  static async createTable(tableData) {
    const pool = getPool();
    const { numero, capacite, statut = 'LIBRE' } = tableData;
    
    const query = `
      INSERT INTO tables_restaurant (numero, capacite, statut) 
      VALUES (?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [numero, capacite, statut]);
    return result.insertId;
  }

  static async findAllTables(filters = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM tables_restaurant WHERE 1=1';
    const values = [];

    if (filters.statut) {
      query += ' AND statut = ?';
      values.push(filters.statut);
    }

    if (filters.capacite_min) {
      query += ' AND capacite >= ?';
      values.push(filters.capacite_min);
    }

    query += ' ORDER BY numero ASC';
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async findTableById(id) {
    const pool = getPool();
    const query = 'SELECT * FROM tables_restaurant WHERE id = ?';
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async updateTable(id, tableData) {
    const pool = getPool();
    const updates = [];
    const values = [];
    
    for (const [key, value] of Object.entries(tableData)) {
      if (['numero', 'capacite', 'statut'].includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (updates.length === 0) return false;
    
    values.push(id);
    const query = `UPDATE tables_restaurant SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(query, values);
    return result.affectedRows > 0;
  }

  static async deleteTable(id) {
    const pool = getPool();
    const query = 'DELETE FROM tables_restaurant WHERE id = ?';
    const [result] = await pool.execute(query, [id]);
    return result.affectedRows > 0;
  }

  // ==================== COMMANDES ====================

  static async createOrder(orderData) {
    const pool = getPool();
    const { client_id, table_id, source_module = 'RESTAURANT', statut = 'EN_ATTENTE' } = orderData;
    
    const query = `
      INSERT INTO orders (client_id, source_module, montant_total, statut, created_at) 
      VALUES (?, ?, 0, ?, NOW())
    `;
    
    const [result] = await pool.execute(query, [client_id, source_module, statut]);
    return result.insertId;
  }

  static async addOrderItem(itemData) {
    const pool = getPool();
    const { order_id, product_id, quantite, prix_unitaire } = itemData;
    
    const query = `
      INSERT INTO order_items (order_id, product_id, quantite, prix_unitaire) 
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [order_id, product_id, quantite, prix_unitaire]);
    return result.insertId;
  }

  static async updateOrderTotal(orderId) {
    const pool = getPool();
    const query = `
      UPDATE orders o 
      SET o.montant_total = (
        SELECT COALESCE(SUM(oi.quantite * oi.prix_unitaire), 0)
        FROM order_items oi 
        WHERE oi.order_id = o.id
      )
      WHERE o.id = ?
    `;
    
    const [result] = await pool.execute(query, [orderId]);
    return result.affectedRows > 0;
  }

  static async findOrderById(orderId) {
    const pool = getPool();
    const query = `
      SELECT 
        o.*,
        c.nom as client_nom,
        c.prenom as client_prenom,
        c.telephone as client_telephone
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.id = ?
    `;
    
    const [rows] = await pool.execute(query, [orderId]);
    
    if (rows[0]) {
      const itemsQuery = `
        SELECT 
          oi.*,
          p.nom as product_nom,
          p.code as product_code,
          p.unite as product_unite
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `;
      const [items] = await pool.execute(itemsQuery, [orderId]);
      rows[0].items = items;
    }
    
    return rows[0] || null;
  }

  static async findAllOrders(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT 
        o.*,
        c.nom as client_nom,
        c.prenom as client_prenom
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.source_module = 'RESTAURANT'
    `;
    const values = [];

    if (filters.statut) {
      query += ' AND o.statut = ?';
      values.push(filters.statut);
    }

    if (filters.client_id) {
      query += ' AND o.client_id = ?';
      values.push(filters.client_id);
    }

    if (filters.date_debut && filters.date_fin) {
      query += ' AND o.created_at BETWEEN ? AND ?';
      values.push(filters.date_debut, filters.date_fin);
    }

    query += ' ORDER BY o.created_at DESC';
    
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async updateOrderStatus(orderId, statut) {
    const pool = getPool();
    const query = 'UPDATE orders SET statut = ? WHERE id = ?';
    const [result] = await pool.execute(query, [statut, orderId]);
    return result.affectedRows > 0;
  }

  // ==================== PRODUITS & MENUS ====================

  static async findAllProducts(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT 
        p.*,
        c.nom as category_nom,
        u.code as unite_code,
        u.nom as unite_nom
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN units u ON p.unite = u.code
      WHERE 1=1
    `;
    const values = [];

    if (filters.type_produit) {
      query += ' AND p.type_produit = ?';
      values.push(filters.type_produit);
    }

    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      values.push(filters.category_id);
    }

    if (filters.actif !== undefined) {
      query += ' AND p.actif = ?';
      values.push(filters.actif);
    }

    query += ' ORDER BY p.nom ASC';
    
    const [rows] = await pool.execute(query, values);
    return rows;
  }

  static async findProductById(id) {
    const pool = getPool();
    const query = `
      SELECT 
        p.*,
        c.nom as category_nom,
        u.code as unite_code,
        u.nom as unite_nom
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN units u ON p.unite = u.code
      WHERE p.id = ?
    `;
    const [rows] = await pool.execute(query, [id]);
    return rows[0] || null;
  }

  static async getMenuItems() {
    const pool = getPool();
    const query = `
      SELECT 
        p.*,
        c.nom as category_nom,
        r.id as recipe_id,
        r.nom as recipe_nom
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN recipes r ON p.id = r.product_id
      WHERE p.type_produit = 'PRODUIT_FINI' 
        AND p.actif = 1
      ORDER BY c.nom, p.nom
    `;
    
    const [rows] = await pool.execute(query);
    return rows;
  }

  // ==================== RECETTES ====================

  static async createRecipe(recipeData) {
    const pool = getPool();
    const { product_id, nom } = recipeData;
    
    const query = `
      INSERT INTO recipes (product_id, nom, created_at, updated_at) 
      VALUES (?, ?, NOW(), NOW())
    `;
    
    const [result] = await pool.execute(query, [product_id, nom]);
    return result.insertId;
  }

  static async addRecipeIngredient(ingredientData) {
    const pool = getPool();
    const { recipe_id, ingredient_id, quantite } = ingredientData;
    
    const query = `
      INSERT INTO recipe_items (recipe_id, ingredient_id, quantite) 
      VALUES (?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [recipe_id, ingredient_id, quantite]);
    return result.insertId;
  }

  static async getRecipeWithIngredients(recipeId) {
    const pool = getPool();
    const recipeQuery = `
      SELECT r.*, p.nom as product_nom
      FROM recipes r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.id = ?
    `;
    
    const [recipes] = await pool.execute(recipeQuery, [recipeId]);
    
    if (recipes[0]) {
      const ingredientsQuery = `
        SELECT 
          ri.*,
          p.nom as ingredient_nom,
          p.code as ingredient_code,
          p.unite as ingredient_unite
        FROM recipe_items ri
        LEFT JOIN products p ON ri.ingredient_id = p.id
        WHERE ri.recipe_id = ?
      `;
      const [ingredients] = await pool.execute(ingredientsQuery, [recipeId]);
      recipes[0].ingredients = ingredients;
    }
    
    return recipes[0] || null;
  }

  static async getProductRecipe(productId) {
    const pool = getPool();
    const query = `
      SELECT r.* FROM recipes r 
      WHERE r.product_id = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(query, [productId]);
    return rows[0] || null;
  }

  // ==================== STOCK & DÉSTOCKAGE ====================

  static async getStockByProduct(productId, locationId) {
    const pool = getPool();
    const query = `
      SELECT * FROM stocks 
      WHERE product_id = ? AND location_id = ?
    `;
    const [rows] = await pool.execute(query, [productId, locationId]);
    return rows[0] || null;
  }

  static async updateStock(stockId, quantite) {
    const pool = getPool();
    const query = 'UPDATE stocks SET quantite = ? WHERE id = ?';
    const [result] = await pool.execute(query, [quantite, stockId]);
    return result.affectedRows > 0;
  }

  static async addStockMovement(movementData) {
    const pool = getPool();
    const { product_id, location_id, type_mouvement, quantite, source_module, reference_id } = movementData;
    
    const query = `
      INSERT INTO stock_movements 
        (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    
    const [result] = await pool.execute(query, [
      product_id, location_id, type_mouvement, quantite, source_module, reference_id
    ]);
    return result.insertId;
  }

  static async deduireStock(orderId, locationId = 1) {
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Récupérer les items de la commande
      const [orderItems] = await connection.execute(
        `SELECT oi.*, p.type_produit 
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      for (const item of orderItems) {
        // Chercher la recette du produit
        const [recipes] = await connection.execute(
          'SELECT id FROM recipes WHERE product_id = ? LIMIT 1',
          [item.product_id]
        );

        if (recipes.length > 0) {
          // Récupérer les ingrédients de la recette
          const [ingredients] = await connection.execute(
            `SELECT ri.* 
             FROM recipe_items ri 
             WHERE ri.recipe_id = ?`,
            [recipes[0].id]
          );

          // Déduire chaque ingrédient du stock
          for (const ingredient of ingredients) {
            const quantiteNecessaire = ingredient.quantite * item.quantite;
            
            // Vérifier le stock disponible
            const [stock] = await connection.execute(
              'SELECT * FROM stocks WHERE product_id = ? AND location_id = ?',
              [ingredient.ingredient_id, locationId]
            );

            if (stock.length > 0) {
              const nouvelleQuantite = stock[0].quantite - quantiteNecessaire;
              
              // Mettre à jour le stock
              await connection.execute(
                'UPDATE stocks SET quantite = ? WHERE id = ?',
                [nouvelleQuantite, stock[0].id]
              );

              // Enregistrer le mouvement de stock
              await connection.execute(
                `INSERT INTO stock_movements 
                 (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at) 
                 VALUES (?, ?, 'SORTIE', ?, 'RESTAURANT', ?, NOW())`,
                [ingredient.ingredient_id, locationId, quantiteNecessaire, orderId]
              );
            }
          }
        } else {
          // Si pas de recette, déduire directement le produit du stock
          const [stock] = await connection.execute(
            'SELECT * FROM stocks WHERE product_id = ? AND location_id = ?',
            [item.product_id, locationId]
          );

          if (stock.length > 0) {
            const nouvelleQuantite = stock[0].quantite - item.quantite;
            
            await connection.execute(
              'UPDATE stocks SET quantite = ? WHERE id = ?',
              [nouvelleQuantite, stock[0].id]
            );

            await connection.execute(
              `INSERT INTO stock_movements 
               (product_id, location_id, type_mouvement, quantite, source_module, reference_id, created_at) 
               VALUES (?, ?, 'SORTIE', ?, 'RESTAURANT', ?, NOW())`,
              [item.product_id, locationId, item.quantite, orderId]
            );
          }
        }
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== CAISSE ====================

  static async createCashier(cashierData) {
    const pool = getPool();
    const { nom, statut = 'OUVERTE' } = cashierData;
    
    const query = `
      INSERT INTO restaurant_cashiers (nom, statut) 
      VALUES (?, ?)
    `;
    
    const [result] = await pool.execute(query, [nom, statut]);
    return result.insertId;
  }

  static async findAllCashiers() {
    const pool = getPool();
    const query = 'SELECT * FROM restaurant_cashiers';
    const [rows] = await pool.execute(query);
    return rows;
  }

  static async openSession(sessionData) {
    const pool = getPool();
    const { cashier_id, user_id, fond_initial } = sessionData;
    
    const query = `
      INSERT INTO restaurant_sessions (cashier_id, user_id, ouverture_at, fond_initial) 
      VALUES (?, ?, NOW(), ?)
    `;
    
    const [result] = await pool.execute(query, [cashier_id, user_id, fond_initial]);
    
    // Mettre à jour le statut de la caisse
    await pool.execute('UPDATE restaurant_cashiers SET statut = ? WHERE id = ?', ['OUVERTE', cashier_id]);
    
    return result.insertId;
  }

  static async closeSession(sessionId, fond_final) {
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Fermer la session
      const [result] = await connection.execute(
        `UPDATE restaurant_sessions 
         SET fermeture_at = NOW(), fond_final = ?, ecart = ? - fond_initial 
         WHERE id = ? AND fermeture_at IS NULL`,
        [fond_final, fond_final, sessionId]
      );

      if (result.affectedRows > 0) {
        // Récupérer la session pour avoir le cashier_id
        const [sessions] = await connection.execute(
          'SELECT cashier_id FROM restaurant_sessions WHERE id = ?',
          [sessionId]
        );
        
        if (sessions.length > 0) {
          await connection.execute(
            'UPDATE restaurant_cashiers SET statut = ? WHERE id = ?',
            ['FERMEE', sessions[0].cashier_id]
          );
        }
      }

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getCurrentSession(cashierId) {
    const pool = getPool();
    const query = `
      SELECT * FROM restaurant_sessions 
      WHERE cashier_id = ? AND fermeture_at IS NULL
      ORDER BY ouverture_at DESC 
      LIMIT 1
    `;
    
    const [rows] = await pool.execute(query, [cashierId]);
    return rows[0] || null;
  }

  static async getSessionTransactions(sessionId) {
    const pool = getPool();
    // Pour le restaurant, les transactions sont liées aux commandes
    const query = `
      SELECT 
        o.id,
        o.client_id,
        o.montant_total,
        o.statut,
        o.created_at,
        c.nom as client_nom,
        c.prenom as client_prenom
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      WHERE o.created_at >= (
        SELECT ouverture_at FROM restaurant_sessions WHERE id = ?
      )
      AND (
        SELECT fermeture_at FROM restaurant_sessions WHERE id = ?
      ) IS NULL
      AND o.source_module = 'RESTAURANT'
    `;
    
    const [rows] = await pool.execute(query, [sessionId, sessionId]);
    return rows;
  }

  // ==================== PAIEMENTS ====================

  static async createPayment(paymentData) {
    const pool = getPool();
    const { client_id, invoice_id, montant, moyen_paiement } = paymentData;
    
    const query = `
      INSERT INTO payments (client_id, invoice_id, montant, moyen_paiement) 
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [client_id, invoice_id || null, montant, moyen_paiement]);
    return result.insertId;
  }

  static async getOrderPayments(orderId) {
    const pool = getPool();
    // Les paiements sont liés via les factures
    const query = `
      SELECT p.* 
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      WHERE i.id IN (
        SELECT ii.invoice_id 
        FROM invoice_items ii 
        WHERE ii.description LIKE CONCAT('%commande ', ?, '%')
      )
    `;
    
    const [rows] = await pool.execute(query, [orderId]);
    return rows;
  }

  // ==================== FACTURATION CHAMBRE ====================

  static async facturerChambre(orderId, roomId) {
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Récupérer la commande
      const [orders] = await connection.execute(
        'SELECT * FROM orders WHERE id = ?',
        [orderId]
      );

      if (orders.length === 0) {
        throw new Error('Commande non trouvée');
      }

      const order = orders[0];

      // Trouver le séjour en cours pour la chambre
      const [stays] = await connection.execute(
        `SELECT s.*, r.client_id 
         FROM stays s
         LEFT JOIN reservations r ON s.reservation_id = r.id
         WHERE r.room_id = ? 
           AND s.checkout_at IS NULL
         LIMIT 1`,
        [roomId]
      );

      if (stays.length === 0) {
        throw new Error('Aucun séjour en cours pour cette chambre');
      }

      // Créer ou récupérer une facture
      let invoiceId;
      const [invoices] = await connection.execute(
        'SELECT * FROM invoices WHERE client_id = ? AND statut = ? LIMIT 1',
        [stays[0].client_id, 'EN_ATTENTE']
      );

      if (invoices.length > 0) {
        invoiceId = invoices[0].id;
      } else {
        const [newInvoice] = await connection.execute(
          'INSERT INTO invoices (client_id, montant_total, statut) VALUES (?, ?, ?)',
          [stays[0].client_id, 0, 'EN_ATTENTE']
        );
        invoiceId = newInvoice.insertId;
      }

      // Ajouter les items de la commande à la facture
      const [orderItems] = await connection.execute(
        `SELECT oi.*, p.nom as product_nom
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [orderId]
      );

      for (const item of orderItems) {
        await connection.execute(
          'INSERT INTO invoice_items (invoice_id, description, montant) VALUES (?, ?, ?)',
          [invoiceId, `Commande ${orderId} - ${item.product_nom} x${item.quantite}`, item.quantite * item.prix_unitaire]
        );
      }

      // Mettre à jour le montant total de la facture
      await connection.execute(
        `UPDATE invoices 
         SET montant_total = (
           SELECT COALESCE(SUM(montant), 0) 
           FROM invoice_items 
           WHERE invoice_id = ?
         )
         WHERE id = ?`,
        [invoiceId, invoiceId]
      );

      // Marquer la commande comme facturée
      await connection.execute(
        'UPDATE orders SET statut = ? WHERE id = ?',
        ['FACTUREE', orderId]
      );

      await connection.commit();
      return invoiceId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ==================== REPORTING ====================

  static async getRestaurantStats(dateDebut, dateFin) {
    const pool = getPool();
    const query = `
      SELECT 
        COUNT(DISTINCT o.id) as total_commandes,
        COALESCE(SUM(o.montant_total), 0) as chiffre_affaires,
        AVG(o.montant_total) as panier_moyen,
        COUNT(DISTINCT o.client_id) as clients_uniques
      FROM orders o
      WHERE o.source_module = 'RESTAURANT'
        AND o.created_at BETWEEN ? AND ?
    `;
    
    const [rows] = await pool.execute(query, [dateDebut, dateFin]);
    return rows[0];
  }

  static async getTopProducts(dateDebut, dateFin, limit = 10) {
    const pool = getPool();
    const query = `
      SELECT 
        p.id,
        p.nom,
        c.nom as category_nom,
        SUM(oi.quantite) as quantite_vendue,
        SUM(oi.quantite * oi.prix_unitaire) as montant_total
      FROM order_items oi
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.source_module = 'RESTAURANT'
        AND o.created_at BETWEEN ? AND ?
      GROUP BY p.id, p.nom, c.nom
      ORDER BY quantite_vendue DESC
      LIMIT ?
    `;
    
    const [rows] = await pool.execute(query, [dateDebut, dateFin, limit.toString()]);
    return rows;
  }

  static async getSalesByCategory(dateDebut, dateFin) {
    const pool = getPool();
    const query = `
      SELECT 
        c.id,
        c.nom,
        COUNT(DISTINCT o.id) as total_commandes,
        SUM(oi.quantite * oi.prix_unitaire) as montant_total
      FROM order_items oi
      LEFT JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.source_module = 'RESTAURANT'
        AND o.created_at BETWEEN ? AND ?
      GROUP BY c.id, c.nom
      ORDER BY montant_total DESC
    `;
    
    const [rows] = await pool.execute(query, [dateDebut, dateFin]);
    return rows;
  }
}

module.exports = RestaurantModel;