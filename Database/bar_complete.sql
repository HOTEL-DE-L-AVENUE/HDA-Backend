--             Bar & Lounge Module — Complete SQL Script

CREATE TABLE IF NOT EXISTS `bar_products` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` varchar(150) NOT NULL,
  `ingredients` text DEFAULT NULL,
  `prix` decimal(10,2) NOT NULL DEFAULT 0.00,
  `categorie` varchar(50) DEFAULT 'Bar',
  `alcool` tinyint(1) DEFAULT 0,
  `type_produit` varchar(50) DEFAULT 'PRODUIT_FINI',
  `source_module` varchar(50) DEFAULT 'BAR',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_products_categorie` (`categorie`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_stock`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_stock` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) NOT NULL DEFAULT 0,
  `seuil_minimum` int(11) DEFAULT 5,
  `unite` varchar(50) DEFAULT 'unités',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bar_stock_product_id` (`product_id`),
  CONSTRAINT `fk_bar_stock_product` FOREIGN KEY (`product_id`) REFERENCES `bar_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_cashiers`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_cashiers` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `statut` enum('ACTIF','INACTIF') DEFAULT 'ACTIF',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_sessions`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `cashier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `fond_initial` decimal(10,2) DEFAULT 0.00,
  `fond_final` decimal(10,2) DEFAULT NULL,
  `ouverture_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `fermeture_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_bar_sessions_cashier_id` (`cashier_id`),
  CONSTRAINT `fk_bar_sessions_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `bar_cashiers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_clients`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_clients` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `telephone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `adresse` text DEFAULT NULL,
  `statut` enum('ACTIF','INACTIF') DEFAULT 'ACTIF',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_tables`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_tables` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `numero` varchar(20) DEFAULT NULL,
  `capacite` int(11) DEFAULT NULL,
  `statut` varchar(30) DEFAULT 'LIBRE',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_transactions` — commandes caisse
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) UNSIGNED DEFAULT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `table_id` bigint(20) UNSIGNED DEFAULT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) NOT NULL DEFAULT 1,
  `prix_unitaire` decimal(10,2) NOT NULL,
  `montant` decimal(10,2) GENERATED ALWAYS AS (`quantite` * `prix_unitaire`) STORED,
  `statut` enum('EN_ATTENTE','EN_COURS','SERVIE','PAYEE','ANNULEE') NOT NULL DEFAULT 'EN_ATTENTE',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_transactions_session_id` (`session_id`),
  KEY `idx_bar_transactions_product_id` (`product_id`),
  KEY `idx_bar_transactions_client_id` (`client_id`),
  KEY `idx_bar_transactions_table_id` (`table_id`),
  CONSTRAINT `fk_bar_transactions_session` FOREIGN KEY (`session_id`) REFERENCES `bar_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bar_transactions_product` FOREIGN KEY (`product_id`) REFERENCES `bar_products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_bar_transactions_client` FOREIGN KEY (`client_id`) REFERENCES `bar_clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_bar_transactions_table` FOREIGN KEY (`table_id`) REFERENCES `bar_tables` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_orders`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_orders` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_name` varchar(150) DEFAULT NULL,
  `table_id` bigint(20) UNSIGNED DEFAULT NULL,
  `statut` varchar(30) DEFAULT 'EN_ATTENTE',
  `montant_total` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_orders_table_id` (`table_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_order_items`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_order_items` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(150) DEFAULT NULL,
  `quantite` int(11) DEFAULT 1,
  `prix` decimal(10,2) DEFAULT 0.00,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bar_order_items_order_id` (`order_id`),
  CONSTRAINT `fk_bar_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `bar_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Données de test — Bar Products
-- ============================================================

INSERT IGNORE INTO `bar_products` (`id`, `nom`, `ingredients`, `prix`, `categorie`, `alcool`, `type_produit`, `source_module`) VALUES
(1, 'Rhum Arrangé', 'Rhum blanc, fruits tropicaux', 50.00, 'Cocktails', 1, 'PRODUIT_FINI', 'BAR'),
(2, 'Mojito', 'Rhum, menthe, citron, sucre', 35.00, 'Cocktails', 1, 'PRODUIT_FINI', 'BAR'),
(3, 'Piña Colada', 'Rhum, lait de coco, ananas', 40.00, 'Cocktails', 1, 'PRODUIT_FINI', 'BAR'),
(4, 'Margarita', 'Tequila, triple sec, citron', 45.00, 'Cocktails', 1, 'PRODUIT_FINI', 'BAR'),
(5, 'Daiquiri', 'Rhum blanc, citron frais, sucre', 38.00, 'Cocktails', 1, 'PRODUIT_FINI', 'BAR'),
(6, 'Coca-Cola', 'Boisson gazeuse', 15.00, 'Boissons', 0, 'PRODUIT_FINI', 'BAR'),
(7, 'Jus d''Orange', 'Jus frais', 12.00, 'Boissons', 0, 'PRODUIT_FINI', 'BAR'),
(8, 'Bière Local', 'Bière blonde 33cl', 20.00, 'Bières', 1, 'PRODUIT_FINI', 'BAR'),
(9, 'Cachaça', 'Rhum brésilien 50ml', 30.00, 'Alcools', 1, 'PRODUIT_FINI', 'BAR'),
(10, 'Verre d''eau', 'Eau minérale', 5.00, 'Boissons', 0, 'PRODUIT_FINI', 'BAR');

INSERT IGNORE INTO `bar_stock` (`product_id`, `quantite`, `seuil_minimum`, `unite`) VALUES
(1, 50, 10, 'bouteilles'),
(2, 100, 20, 'portions'),
(3, 75, 15, 'portions'),
(4, 60, 15, 'portions'),
(5, 80, 20, 'portions'),
(6, 150, 30, 'bouteilles'),
(7, 120, 25, 'verres'),
(8, 200, 50, 'bouteilles'),
(9, 100, 20, 'bouteilles'),
(10, 500, 100, 'verres');

-- ============================================================
-- Données de test — Bar Tables & Clients
-- ============================================================

INSERT IGNORE INTO `bar_clients` (`id`, `nom`, `prenom`, `telephone`, `email`, `statut`) VALUES
(1, 'Razafy', 'Jean', '+261 34 12 345 67', 'jean@example.com', 'ACTIF'),
(2, 'Ramanantsoa', 'Marie', '+261 32 98 765 43', 'marie@example.com', 'ACTIF'),
(3, 'Rakoto', 'Paul', '+261 33 45 678 90', 'paul@example.com', 'ACTIF'),
(4, 'Rajaonarison', 'Claire', NULL, NULL, 'ACTIF');

INSERT IGNORE INTO `bar_tables` (`id`, `numero`, `capacite`, `statut`) VALUES
(1, 'T1', 4, 'LIBRE'),
(2, 'T2', 2, 'LIBRE'),
(3, 'T3', 6, 'OCCUPEE'),
(4, 'T4', 4, 'LIBRE'),
(5, 'T5', 8, 'RESERVEE'),
(6, 'T6', 2, 'LIBRE');

INSERT IGNORE INTO `bar_cashiers` (`id`, `nom`, `statut`) VALUES
(1, 'Caisse 1', 'ACTIF'),
(2, 'Caisse 2', 'ACTIF');
