-- Migration: complétion du module de gestion de stock
-- Date: 2026-10-24
-- Objectif: traçabilité des mouvements, seuils max, stock initial,
--           inventaires physiques et journal des mouvements du Bar.
--
-- IMPORTANT: migration strictement additive et idempotente.
-- Aucune colonne, table ou donnée existante n'est supprimée ou réinitialisée.

DROP PROCEDURE IF EXISTS hda_stock_add_column;
DROP PROCEDURE IF EXISTS hda_stock_add_index;

DELIMITER $$

CREATE PROCEDURE hda_stock_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @hda_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE hda_stmt FROM @hda_sql;
    EXECUTE hda_stmt;
    DEALLOCATE PREPARE hda_stmt;
  END IF;
END$$

CREATE PROCEDURE hda_stock_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @hda_sql = CONCAT('ALTER TABLE `', p_table, '` ADD INDEX `', p_index, '` ', p_definition);
    PREPARE hda_stmt FROM @hda_sql;
    EXECUTE hda_stmt;
    DEALLOCATE PREPARE hda_stmt;
  END IF;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- 1. Catalogue produits
-- ---------------------------------------------------------------------------
CALL hda_stock_add_column('products', 'description', 'TEXT NULL');
CALL hda_stock_add_column('products', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
CALL hda_stock_add_column('products', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL hda_stock_add_column('bar_products', 'description', 'TEXT NULL');
CALL hda_stock_add_column('bar_products', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL hda_stock_add_column('restaurant_ingredients', 'description', 'TEXT NULL');

-- ---------------------------------------------------------------------------
-- 2. Soldes de stock : seuil maximum, stock initial et horodatage
-- ---------------------------------------------------------------------------
CALL hda_stock_add_column('stocks', 'seuil_maximum', 'DECIMAL(15,2) NULL');
CALL hda_stock_add_column('stocks', 'stock_initial', 'DECIMAL(15,2) NULL');
CALL hda_stock_add_column('stocks', 'stock_initial_date', 'DATE NULL');
CALL hda_stock_add_column('stocks', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
CALL hda_stock_add_column('stocks', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

CALL hda_stock_add_column('bar_stock', 'seuil_maximum', 'INT NULL');
CALL hda_stock_add_column('bar_stock', 'stock_initial', 'INT NULL');
CALL hda_stock_add_column('bar_stock', 'stock_initial_date', 'DATE NULL');
CALL hda_stock_add_column('bar_stock', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');

CALL hda_stock_add_column('restaurant_ingredient_stocks', 'seuil_minimum', 'DECIMAL(15,3) NOT NULL DEFAULT 0');
CALL hda_stock_add_column('restaurant_ingredient_stocks', 'seuil_maximum', 'DECIMAL(15,3) NULL');
CALL hda_stock_add_column('restaurant_ingredient_stocks', 'stock_initial', 'DECIMAL(15,3) NULL');
CALL hda_stock_add_column('restaurant_ingredient_stocks', 'stock_initial_date', 'DATE NULL');
CALL hda_stock_add_column('restaurant_ingredient_stocks', 'created_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP');
CALL hda_stock_add_column('restaurant_ingredient_stocks', 'updated_at', 'TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

-- ---------------------------------------------------------------------------
-- 3. Journaux de mouvements : date d'opération, référence externe, commentaire
-- ---------------------------------------------------------------------------
CALL hda_stock_add_column('stock_movements', 'date_operation', 'DATE NULL');
CALL hda_stock_add_column('stock_movements', 'reference_externe', 'VARCHAR(100) NULL');
CALL hda_stock_add_column('stock_movements', 'commentaire', 'VARCHAR(500) NULL');
CALL hda_stock_add_column('stock_movements', 'supplier_id', 'BIGINT UNSIGNED NULL');

CALL hda_stock_add_column('restaurant_ingredient_stock_movements', 'date_operation', 'DATE NULL');
CALL hda_stock_add_column('restaurant_ingredient_stock_movements', 'reference_externe', 'VARCHAR(100) NULL');
CALL hda_stock_add_column('restaurant_ingredient_stock_movements', 'commentaire', 'VARCHAR(500) NULL');
CALL hda_stock_add_column('restaurant_ingredient_stock_movements', 'supplier_id', 'BIGINT UNSIGNED NULL');

CALL hda_stock_add_index('stock_movements', 'idx_stock_movements_date_operation', '(date_operation, created_at)');
CALL hda_stock_add_index('restaurant_ingredient_stock_movements', 'idx_restaurant_ing_movement_date_op', '(date_operation, created_at)');

-- ---------------------------------------------------------------------------
-- 4. Journal des mouvements du Bar (le stock Bar n'avait aucun historique)
--    Les ventes restent portées par bar_transactions (source de vérité).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bar_stock_movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  location_id BIGINT UNSIGNED NOT NULL DEFAULT 3,
  type_mouvement VARCHAR(20) NOT NULL,
  quantite INT NOT NULL,
  source_module VARCHAR(50) NULL,
  reference_id BIGINT UNSIGNED NULL,
  reference_externe VARCHAR(100) NULL,
  date_operation DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stock_after INT NULL,
  motif VARCHAR(255) NULL,
  commentaire VARCHAR(500) NULL,
  user_id BIGINT UNSIGNED NULL,
  supplier_id BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_bar_stock_movements_product_date (product_id, date_operation, created_at),
  KEY idx_bar_stock_movements_source (source_module, reference_id),
  CONSTRAINT fk_bar_stock_movements_product
    FOREIGN KEY (product_id) REFERENCES bar_products (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Reprise de l'historique des ventes Bar déjà enregistrées dans
-- bar_transactions, sans créer de doublon ni modifier le stock.
INSERT INTO bar_stock_movements
  (product_id, location_id, type_mouvement, quantite, source_module, reference_id,
   date_operation, created_at, stock_after, motif)
SELECT bt.product_id, 3, 'SORTIE', bt.quantite, 'VENTE_BAR', bt.order_id,
       DATE(bt.created_at), bt.created_at, NULL,
       CONCAT('Vente – commande bar #', bt.order_id)
  FROM bar_transactions bt
 WHERE bt.order_id IS NOT NULL
   AND bt.statut <> 'ANNULEE'
   AND NOT EXISTS (
     SELECT 1 FROM bar_stock_movements m
      WHERE m.source_module = 'VENTE_BAR'
        AND m.reference_id = bt.order_id
        AND m.product_id = bt.product_id
   );

-- ---------------------------------------------------------------------------
-- 5. Inventaires physiques
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_inventories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_type ENUM('PRODUCT','BAR_PRODUCT','INGREDIENT') NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  ingredient_id BIGINT UNSIGNED NULL,
  location_id BIGINT UNSIGNED NULL,
  inventory_date DATE NOT NULL,
  stock_theorique DECIMAL(15,3) NOT NULL,
  stock_reel DECIMAL(15,3) NOT NULL,
  ecart DECIMAL(15,3) NOT NULL,
  motif VARCHAR(255) NULL,
  commentaire VARCHAR(500) NULL,
  user_id BIGINT UNSIGNED NULL,
  regularise TINYINT(1) NOT NULL DEFAULT 0,
  movement_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_inventories_item (item_type, product_id, ingredient_id, location_id, inventory_date),
  KEY idx_stock_inventories_date (inventory_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS hda_stock_add_column;
DROP PROCEDURE IF EXISTS hda_stock_add_index;
