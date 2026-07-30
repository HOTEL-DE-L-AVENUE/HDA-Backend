-- ============================================================
-- Bar & Lounge Module — External SQL Script
-- À exécuter séparément après l'import de hda.sql
-- ============================================================

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
-- Structure de la table `bar_cashiers`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_cashiers` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) DEFAULT NULL,
  `statut` enum('OUVERTE','FERMEE') DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_sessions`
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `cashier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ouverture_at` datetime DEFAULT NULL,
  `fermeture_at` datetime DEFAULT NULL,
  `fond_initial` bigint(20) DEFAULT NULL,
  `fond_final` bigint(20) DEFAULT NULL,
  `ecart` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `bar_sessions_ibfk_1` (`cashier_id`),
  KEY `bar_sessions_ibfk_2` (`user_id`),
  CONSTRAINT `bar_sessions_ibfk_1` FOREIGN KEY (`cashier_id`) REFERENCES `bar_cashiers` (`id`),
  CONSTRAINT `bar_sessions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_admin`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_products` (bar & lounge)
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_products` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) DEFAULT NULL,
  `ingredients` text DEFAULT NULL,
  `prix` decimal(10,2) DEFAULT NULL,
  `categorie` varchar(50) DEFAULT NULL,
  `alcool` tinyint(1) DEFAULT 1,
  `type_produit` varchar(50) DEFAULT 'PRODUIT_FINI',
  `source_module` varchar(50) DEFAULT 'BAR',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `bar_stock` — qte en stock par produit
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_stock` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) DEFAULT 0,
  `seuil_minimum` int(11) DEFAULT 5,
  `unite` varchar(20) DEFAULT 'unités',
  PRIMARY KEY (`id`),
  UNIQUE KEY `bar_stock_product_unique` (`product_id`),
  CONSTRAINT `bar_stock_product_fk` FOREIGN KEY (`product_id`) REFERENCES `bar_products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------
-- Structure de la table `products` (Bar Cocktails)
-- --------------------------------------------------------

-- ============================================================
-- Données de test — Bar Cocktails
-- ============================================================

INSERT IGNORE INTO `bar_products` (`id`, `nom`, `ingredients`, `prix`, `categorie`, `alcool`, `type_produit`, `source_module`) VALUES
(1,  'HDA Signature',    'Champagne, cognac VSOP, bitter orange, gold leaf',            48.00, 'Signature',   1, 'PRODUIT_FINI', 'BAR'),
(2,  'Negroni Prestige', 'Gin premium, Campari, Vermouth rouge, orange',                28.00, 'Classique',   1, 'PRODUIT_FINI', 'BAR'),
(3,  'Royal Mojito',     'Rhum blanc, citron vert, menthe fraîche, sucre, perrier',     22.00, 'Classique',   1, 'PRODUIT_FINI', 'BAR'),
(4,  'Whisky Sour Gold', 'Bourbon 18 ans, citron, blanc d\'œuf, Angostura',              35.00, 'Premium',     1, 'PRODUIT_FINI', 'BAR'),
(5,  'Coucher de Soleil','Jus d\'orange, grenadine, tequila premium, sel fumé',         24.00, 'Fruité',      1, 'PRODUIT_FINI', 'BAR'),
(6,  'Elixir Vert',      'Concombre, basilic, citron vert, eau pétillante',              18.00, 'Sans alcool', 0, 'PRODUIT_FINI', 'BAR'),
(7,  'Bellini Blanc',    'Prosecco, pêche blanche fraîche, touches florales',           26.00, 'Bulles',      1, 'PRODUIT_FINI', 'BAR'),
(8,  'Absinthe Rituel',  'Absinthe verte, louche d\'eau glacée, cube de sucre',         30.00, 'Tradition',   1, 'PRODUIT_FINI', 'BAR');

INSERT IGNORE INTO `bar_stock` (`product_id`, `quantite`, `seuil_minimum`, `unite`) VALUES
(1, 12, 5, 'unités'),
(2, 3,  5, 'unités'),
(3, 0,  5, 'unités'),
(4, 8,  3, 'unités'),
(5, 15, 5, 'unités'),
(6, 20, 10,'unités'),
(7, 6,  4, 'unités'),
(8, 2,  5, 'bouteilles');

-- --------------------------------------------------------
-- Structure de la table `bar_transactions` — commandes caisse
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS `bar_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `session_id` bigint(20) UNSIGNED DEFAULT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) NOT NULL DEFAULT 1,
  `prix_unitaire` decimal(10,2) NOT NULL,
  `montant` decimal(10,2) GENERATED ALWAYS AS (`quantite` * `prix_unitaire`) STORED,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `bar_transactions_ibfk_1` (`session_id`),
  KEY `bar_transactions_ibfk_2` (`product_id`),
  CONSTRAINT `bar_transactions_ibfk_1` FOREIGN KEY (`session_id`) REFERENCES `bar_sessions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `bar_transactions_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `bar_products` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
