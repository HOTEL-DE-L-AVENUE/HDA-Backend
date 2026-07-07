-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1
-- Généré le : mar. 07 juil. 2026 à 10:34
-- Version du serveur : 10.4.32-MariaDB
-- Version de PHP : 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `hda`
--

-- --------------------------------------------------------

--
-- Structure de la table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `action` varchar(255) DEFAULT NULL,
  `entite` varchar(100) DEFAULT NULL,
  `entite_id` bigint(20) DEFAULT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `user_id`, `action`, `entite`, `entite_id`, `payload`, `created_at`) VALUES
(1, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:51:03'),
(2, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:51:42'),
(3, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:53:27'),
(4, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:53:49'),
(5, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:55:14'),
(6, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:57:05'),
(7, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:58:10'),
(8, 1, 'LOGIN', 'users', 1, NULL, '2026-07-03 14:58:44'),
(9, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:33:54'),
(10, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:33:58'),
(11, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:34:03'),
(12, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:34:09'),
(13, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:34:22'),
(14, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:34:23'),
(15, 1, 'LOGIN', 'users', 1, NULL, '2026-07-06 09:36:31');

-- --------------------------------------------------------

--
-- Structure de la table `casino_cards`
--

CREATE TABLE `casino_cards` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `numero_carte` varchar(100) NOT NULL,
  `qr_code` varchar(150) NOT NULL COMMENT 'Valeur encodée dans le QR, scannée en caisse',
  `niveau` enum('STANDARD','SILVER','GOLD','VIP') NOT NULL DEFAULT 'STANDARD',
  `points` bigint(20) NOT NULL DEFAULT 0,
  `plafond_credit` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Surcharge du plafond par défaut (direction)',
  `statut` enum('ACTIVE','SUSPENDUE','PERDUE') NOT NULL DEFAULT 'ACTIVE',
  `date_emission` date DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_cards`
--

INSERT INTO `casino_cards` (`id`, `client_id`, `numero_carte`, `qr_code`, `niveau`, `points`, `plafond_credit`, `statut`, `date_emission`, `created_at`, `updated_at`) VALUES
(1, 1, 'CARD-001', 'QR-CARD-001', 'STANDARD', 0, 1000000, 'ACTIVE', '2026-07-07', '2026-07-07 11:24:15', '2026-07-07 11:24:15');

-- --------------------------------------------------------

--
-- Structure de la table `casino_cashiers`
--

CREATE TABLE `casino_cashiers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `statut` enum('OUVERTE','FERMEE','MAINTENANCE') NOT NULL DEFAULT 'FERMEE',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_cashiers`
--

INSERT INTO `casino_cashiers` (`id`, `room_id`, `code`, `nom`, `statut`, `created_at`, `updated_at`) VALUES
(1, 1, 'CAISSE-01', 'Caisse N-01', 'OUVERTE', '2026-07-07 11:18:30', '2026-07-07 11:18:30'),
(2, 1, 'CAISSE-02', 'Caisse N-02', 'OUVERTE', '2026-07-07 11:19:07', '2026-07-07 11:19:07');

-- --------------------------------------------------------

--
-- Structure de la table `casino_cashier_sessions`
--

CREATE TABLE `casino_cashier_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cashier_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Caissier connecté',
  `ouverture_at` datetime NOT NULL,
  `fermeture_at` datetime DEFAULT NULL,
  `fond_initial` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `fond_final_declare` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Comptage physique à la fermeture',
  `fond_final_theorique` bigint(20) DEFAULT NULL COMMENT 'fond_initial + entrées - sorties',
  `ecart` bigint(20) DEFAULT NULL COMMENT 'déclaré - théorique',
  `statut` enum('OUVERTE','FERMEE') NOT NULL DEFAULT 'OUVERTE',
  `commentaire` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_cashier_sessions`
--

INSERT INTO `casino_cashier_sessions` (`id`, `cashier_id`, `user_id`, `ouverture_at`, `fermeture_at`, `fond_initial`, `fond_final_declare`, `fond_final_theorique`, `ecart`, `statut`, `commentaire`, `created_at`) VALUES
(1, 1, 1, '2026-07-07 11:20:03', NULL, 10000, NULL, NULL, NULL, 'OUVERTE', NULL, '2026-07-07 11:20:03');

-- --------------------------------------------------------

--
-- Structure de la table `casino_cash_operations`
--

CREATE TABLE `casino_cash_operations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cashier_session_id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'NULL si aucune carte/aucun client sélectionné',
  `client_libre` varchar(150) DEFAULT NULL COMMENT 'Nom libre si client non enregistré',
  `type_operation` enum('BUY_IN','CASH_OUT','AVANCE_CREDIT','REMBOURSEMENT_CREDIT','DEPOT','AUTRE') NOT NULL,
  `montant` bigint(20) UNSIGNED NOT NULL,
  `moyen_paiement` enum('ESPECES','CARTE','MOBILE_MONEY','VIREMENT') NOT NULL DEFAULT 'ESPECES',
  `credit_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Référence si AVANCE_CREDIT / REMBOURSEMENT_CREDIT',
  `ref_flux_global` varchar(64) DEFAULT NULL COMMENT 'Référence de liaison vers financial_transactions',
  `created_by` bigint(20) UNSIGNED NOT NULL COMMENT 'Caissier connecté',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_cash_operations`
--

INSERT INTO `casino_cash_operations` (`id`, `cashier_session_id`, `client_id`, `client_libre`, `type_operation`, `montant`, `moyen_paiement`, `credit_id`, `ref_flux_global`, `created_by`, `created_at`) VALUES
(1, 1, 1, NULL, 'BUY_IN', 10000, 'ESPECES', NULL, '832f139e-07d2-4c7e-aee3-7a0c50fe96c0', 1, '2026-07-07 11:20:58'),
(2, 1, 1, NULL, 'BUY_IN', 10000, 'ESPECES', NULL, '194efdde-5228-475f-8e6b-3eaa1e848cd2', 1, '2026-07-07 11:21:18');

-- --------------------------------------------------------

--
-- Structure de la table `casino_chip_transactions`
--

CREATE TABLE `casino_chip_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `chip_type_id` bigint(20) UNSIGNED NOT NULL,
  `cashier_session_id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `client_libre` varchar(150) DEFAULT NULL,
  `type_operation` enum('ACHAT','REPRISE') NOT NULL COMMENT 'ACHAT = client prend des jetons, REPRISE = client rend des jetons',
  `quantite` int(11) UNSIGNED NOT NULL,
  `valeur_unitaire` bigint(20) UNSIGNED NOT NULL COMMENT 'Copie du prix du jeton au moment T',
  `montant_total` bigint(20) UNSIGNED GENERATED ALWAYS AS (`quantite` * `valeur_unitaire`) STORED,
  `moyen_paiement` enum('ESPECES','CARTE','MOBILE_MONEY','VIREMENT') NOT NULL DEFAULT 'ESPECES',
  `ref_flux_global` varchar(64) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_chip_types`
--

CREATE TABLE `casino_chip_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `valeur_nominale` bigint(20) UNSIGNED NOT NULL COMMENT 'Prix / valeur du jeton en Ariary',
  `couleur` varchar(30) DEFAULT NULL,
  `statut` enum('ACTIF','INACTIF') NOT NULL DEFAULT 'ACTIF',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_client_profiles`
--

CREATE TABLE `casino_client_profiles` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `statut_special` enum('NORMAL','VIP','A_SURVEILLER','EXCLU','AUTO_EXCLU') NOT NULL DEFAULT 'NORMAL',
  `motif` text DEFAULT NULL,
  `date_effet` date DEFAULT NULL,
  `decide_par` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'user_id ayant validé la décision (toujours humaine)',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_credits`
--

CREATE TABLE `casino_credits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `session_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Session de caisse à l''origine de l''octroi',
  `montant_accorde` bigint(20) UNSIGNED NOT NULL,
  `encours` bigint(20) UNSIGNED NOT NULL,
  `date_octroi` datetime NOT NULL DEFAULT current_timestamp(),
  `echeance` date DEFAULT NULL,
  `statut` enum('ACTIF','SOLDE','EN_RETARD','LITIGE') NOT NULL DEFAULT 'ACTIF',
  `ref_flux_global` varchar(64) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_credit_repayments`
--

CREATE TABLE `casino_credit_repayments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `credit_id` bigint(20) UNSIGNED NOT NULL,
  `montant` bigint(20) UNSIGNED NOT NULL,
  `date_remboursement` datetime NOT NULL DEFAULT current_timestamp(),
  `delai_jours` int(11) DEFAULT NULL COMMENT 'delta vs échéance, négatif = en avance',
  `moyen_paiement` enum('ESPECES','CARTE','MOBILE_MONEY','VIREMENT') DEFAULT NULL,
  `ref_flux_global` varchar(64) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_incidents`
--

CREATE TABLE `casino_incidents` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `session_id` bigint(20) UNSIGNED DEFAULT NULL,
  `type` enum('INCIDENT','LITIGE') NOT NULL,
  `gravite` enum('FAIBLE','MOYENNE','ELEVEE') NOT NULL DEFAULT 'FAIBLE',
  `description` text NOT NULL,
  `statut` enum('OUVERT','EN_COURS','RESOLU') NOT NULL DEFAULT 'OUVERT',
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `resolved_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_rooms`
--

CREATE TABLE `casino_rooms` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(30) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `type_salle` enum('VIP','POKER','MACHINES','TABLE_JEUX','AUTRE') NOT NULL DEFAULT 'AUTRE',
  `statut` enum('OUVERTE','FERMEE','EN_TRAVAUX') NOT NULL DEFAULT 'OUVERTE',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_rooms`
--

INSERT INTO `casino_rooms` (`id`, `code`, `nom`, `type_salle`, `statut`, `created_at`, `updated_at`) VALUES
(1, 'SALLES-VIP', 'salle VIP', 'VIP', 'OUVERTE', '2026-07-07 11:14:02', '2026-07-07 11:14:02');

-- --------------------------------------------------------

--
-- Structure de la table `casino_scores`
--

CREATE TABLE `casino_scores` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `categorie` enum('BON','MOYEN','MAUVAIS') NOT NULL,
  `facteurs` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Détail des facteurs et poids ayant produit le score (traçabilité)' CHECK (json_valid(`facteurs`)),
  `calcule_le` datetime NOT NULL DEFAULT current_timestamp(),
  `decision` enum('AUCUNE','VALIDEE','CONTESTEE','ANNULEE') NOT NULL DEFAULT 'AUCUNE' COMMENT 'Le score seul ne bloque jamais : toute conséquence lourde exige une décision humaine',
  `decide_par` bigint(20) UNSIGNED DEFAULT NULL,
  `decide_le` datetime DEFAULT NULL,
  `commentaire_contestation` text DEFAULT NULL COMMENT 'Explication/contestation du client ou du staff'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `casino_scoring_config`
--

CREATE TABLE `casino_scoring_config` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cle` varchar(80) NOT NULL COMMENT 'ex: plafond_credit_defaut, poids_ratio_remboursement, seuil_bon_payeur',
  `valeur` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_scoring_config`
--

INSERT INTO `casino_scoring_config` (`id`, `cle`, `valeur`, `description`, `updated_by`, `updated_at`) VALUES
(1, 'plafond_credit_defaut', '500000', 'Plafond de crédit par défaut (Ariary), surchargeable par carte', NULL, '2026-07-07 11:11:18'),
(2, 'poids_ratio_remboursement', '0.40', 'Poids du ratio (montants remboursés / accordés)', NULL, '2026-07-07 11:11:18'),
(3, 'poids_retard_moyen', '0.25', 'Poids du retard moyen de remboursement (jours)', NULL, '2026-07-07 11:11:18'),
(4, 'poids_encours_vs_plafond', '0.20', 'Poids du taux d\'utilisation du plafond', NULL, '2026-07-07 11:11:18'),
(5, 'poids_anciennete', '0.10', 'Poids de l\'ancienneté du client (mois)', NULL, '2026-07-07 11:11:18'),
(6, 'poids_regularite', '0.05', 'Poids de la régularité des visites/opérations', NULL, '2026-07-07 11:11:18'),
(7, 'seuil_bon_payeur', '75', 'Score >= seuil => catégorie BON', NULL, '2026-07-07 11:11:18'),
(8, 'seuil_moyen_payeur', '50', 'Score >= seuil (et < seuil_bon_payeur) => catégorie MOYEN, sinon MAUVAIS', NULL, '2026-07-07 11:11:18');

-- --------------------------------------------------------

--
-- Structure de la table `casino_visits`
--

CREATE TABLE `casino_visits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `card_id` bigint(20) UNSIGNED DEFAULT NULL,
  `entree_at` datetime NOT NULL,
  `sortie_at` datetime DEFAULT NULL,
  `entree_via` enum('QR','MANUEL') NOT NULL DEFAULT 'MANUEL',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `casino_visits`
--

INSERT INTO `casino_visits` (`id`, `client_id`, `room_id`, `card_id`, `entree_at`, `sortie_at`, `entree_via`, `created_at`) VALUES
(1, 1, 1, NULL, '2026-07-07 11:24:59', '2026-07-07 11:25:16', 'MANUEL', '2026-07-07 11:24:59'),
(2, 1, 1, NULL, '2026-07-07 11:25:08', '2026-07-07 11:25:17', 'MANUEL', '2026-07-07 11:25:08');

-- --------------------------------------------------------

--
-- Structure de la table `categories`
--

CREATE TABLE `categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `categories`
--

INSERT INTO `categories` (`id`, `nom`) VALUES
(1, 'Viandes'),
(2, 'Poissons & Fruits de mer'),
(3, 'Légumes'),
(4, 'Fruits'),
(5, 'Produits laitiers'),
(6, 'Céréales & Farines'),
(7, 'Épices & Condiments'),
(8, 'Huiles & Graisses'),
(9, 'Boissons non alcoolisées'),
(10, 'Boissons alcoolisées'),
(11, 'Desserts'),
(12, 'Produits surgelés'),
(13, 'Produits d\'entretien'),
(14, 'Consommables'),
(15, 'Plats cuisinés');

-- --------------------------------------------------------

--
-- Structure de la table `clients`
--

CREATE TABLE `clients` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code_client` varchar(50) DEFAULT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `adresse` text DEFAULT NULL,
  `date_naissance` date DEFAULT NULL,
  `type_piece` varchar(50) DEFAULT NULL,
  `numero_piece` varchar(100) DEFAULT NULL,
  `photo_url` text DEFAULT NULL,
  `is_casino_player` tinyint(1) DEFAULT 0,
  `statut` varchar(30) DEFAULT 'ACTIF',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `clients`
--

INSERT INTO `clients` (`id`, `code_client`, `nom`, `prenom`, `telephone`, `email`, `adresse`, `date_naissance`, `type_piece`, `numero_piece`, `photo_url`, `is_casino_player`, `statut`, `created_at`, `updated_at`) VALUES
(1, '111', 'Feno', 'Mahefa', '+261 34 12 345 69', 'mahefafenosoanobel@gmail.com', 'Vatofotsy', '2026-07-11', 'CNI', '10', NULL, 0, 'BLOCKED', NULL, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `client_accounts`
--

CREATE TABLE `client_accounts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `solde` bigint(20) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `equipments`
--

CREATE TABLE `equipments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `nom` varchar(100) NOT NULL,
  `categorie` varchar(50) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `financial_transactions`
--

CREATE TABLE `financial_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `module` varchar(30) DEFAULT NULL,
  `type_flux` varchar(30) DEFAULT NULL,
  `montant` bigint(20) DEFAULT NULL,
  `reference_id` bigint(20) DEFAULT NULL,
  `ref_flux_global` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `statut_sync` enum('PENDING','SYNCED','ERROR') NOT NULL DEFAULT 'PENDING',
  `synced_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `financial_transactions`
--

INSERT INTO `financial_transactions` (`id`, `client_id`, `module`, `type_flux`, `montant`, `reference_id`, `ref_flux_global`, `description`, `statut_sync`, `synced_at`, `created_at`) VALUES
(1, 1, 'CASINO', 'ENTREE_CAISSE_CASINO', 10000, 1, '832f139e-07d2-4c7e-aee3-7a0c50fe96c0', 'BUY_IN caisse casino', 'SYNCED', NULL, '2026-07-07 11:20:58'),
(2, 1, 'CASINO', 'ENTREE_CAISSE_CASINO', 10000, 2, '194efdde-5228-475f-8e6b-3eaa1e848cd2', 'BUY_IN caisse casino', 'SYNCED', NULL, '2026-07-07 11:21:18');

-- --------------------------------------------------------

--
-- Structure de la table `housekeeping_tasks`
--

CREATE TABLE `housekeeping_tasks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `assigned_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `type_tache` enum('NETTOYAGE','DESINFECTION','CHANGEMENT_DRAPS','CONTROLE') DEFAULT NULL,
  `statut` enum('A_FAIRE','EN_COURS','TERMINE') DEFAULT 'A_FAIRE',
  `commentaire` text DEFAULT NULL,
  `planned_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `invoices`
--

CREATE TABLE `invoices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `montant_total` bigint(20) DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `montant` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `lost_and_found`
--

CREATE TABLE `lost_and_found` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED DEFAULT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `objet` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `date_trouvee` datetime DEFAULT NULL,
  `statut` enum('TROUVE','RESTITUE','DETRUIT') DEFAULT 'TROUVE',
  `date_restitution` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `loyalty_points`
--

CREATE TABLE `loyalty_points` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `points` bigint(20) DEFAULT NULL,
  `motif` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `minibar_consumptions`
--

CREATE TABLE `minibar_consumptions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) NOT NULL,
  `prix_unitaire` bigint(20) NOT NULL,
  `montant` bigint(20) NOT NULL,
  `facturee` tinyint(1) DEFAULT 0,
  `consumed_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `titre` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `source_module` varchar(30) DEFAULT NULL,
  `montant_total` bigint(20) DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `order_items`
--

CREATE TABLE `order_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED DEFAULT NULL,
  `product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantite` decimal(15,2) DEFAULT NULL,
  `prix_unitaire` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `payments`
--

CREATE TABLE `payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `montant` bigint(20) DEFAULT NULL,
  `moyen_paiement` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `products`
--

CREATE TABLE `products` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `code` varchar(50) DEFAULT NULL,
  `nom` varchar(150) DEFAULT NULL,
  `unite` varchar(20) DEFAULT NULL,
  `prix_achat` bigint(20) DEFAULT NULL,
  `prix_vente` bigint(20) DEFAULT NULL,
  `actif` tinyint(1) DEFAULT 1,
  `type_produit` enum('MATIERE_PREMIERE','PRODUIT_FINI','CONSOMMABLE','SERVICE') DEFAULT 'MATIERE_PREMIERE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `product_types`
--

CREATE TABLE `product_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `product_types`
--

INSERT INTO `product_types` (`id`, `nom`, `description`, `actif`, `created_at`, `updated_at`) VALUES
(1, 'MATIERE_PREMIERE', 'Produits utilisés pour préparer les recettes', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13'),
(2, 'PRODUIT_FINI', 'Produits prêts à être vendus', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13'),
(3, 'BOISSON', 'Boissons alcoolisées et non alcoolisées', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13'),
(4, 'CONSOMMABLE', 'Produits consommables non alimentaires', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13'),
(5, 'EMBALLAGE', 'Boîtes, sacs, cartons, emballages', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13'),
(6, 'SERVICE', 'Prestations de service', 1, '2026-06-30 08:31:13', '2026-06-30 08:31:13');

-- --------------------------------------------------------

--
-- Structure de la table `purchases`
--

CREATE TABLE `purchases` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `montant_total` bigint(20) DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `purchase_items`
--

CREATE TABLE `purchase_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `purchase_id` bigint(20) UNSIGNED DEFAULT NULL,
  `product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantite` decimal(15,2) DEFAULT NULL,
  `prix_unitaire` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `recipes`
--

CREATE TABLE `recipes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `recipe_items`
--

CREATE TABLE `recipe_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `recipe_id` bigint(20) UNSIGNED NOT NULL,
  `ingredient_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` decimal(15,3) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reservations`
--

CREATE TABLE `reservations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `client_id` bigint(20) UNSIGNED DEFAULT NULL,
  `room_id` bigint(20) UNSIGNED DEFAULT NULL,
  `date_arrivee` date DEFAULT NULL,
  `date_depart` date DEFAULT NULL,
  `montant_total` bigint(20) DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `reservation_guests`
--

CREATE TABLE `reservation_guests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `reservation_id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) DEFAULT NULL,
  `date_naissance` date DEFAULT NULL,
  `type_piece` varchar(50) DEFAULT NULL,
  `numero_piece` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `restaurant_cashiers`
--

CREATE TABLE `restaurant_cashiers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) DEFAULT NULL,
  `statut` enum('OUVERTE','FERMEE') DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `restaurant_sessions`
--

CREATE TABLE `restaurant_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cashier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ouverture_at` datetime DEFAULT NULL,
  `fermeture_at` datetime DEFAULT NULL,
  `fond_initial` bigint(20) DEFAULT NULL,
  `fond_final` bigint(20) DEFAULT NULL,
  `ecart` bigint(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `rooms`
--

CREATE TABLE `rooms` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_type_id` bigint(20) UNSIGNED DEFAULT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `capacite` int(11) DEFAULT NULL,
  `prix_nuit` bigint(20) DEFAULT NULL,
  `statut` enum('LIBRE','OCCUPEE','RESERVEE','NETTOYAGE','MAINTENANCE','HORS_SERVICE') DEFAULT 'LIBRE'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `rooms`
--

INSERT INTO `rooms` (`id`, `room_type_id`, `numero`, `capacite`, `prix_nuit`, `statut`) VALUES
(1, 1, 'FA', 3, 6000, 'LIBRE');

-- --------------------------------------------------------

--
-- Structure de la table `room_equipments`
--

CREATE TABLE `room_equipments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `equipment_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) DEFAULT 1,
  `statut` enum('BON','EN_PANNE','REMPLACE','HORS_SERVICE') DEFAULT 'BON',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `room_maintenance`
--

CREATE TABLE `room_maintenance` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `equipment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `type_intervention` enum('PREVENTIVE','CORRECTIVE','URGENCE') NOT NULL,
  `description` text DEFAULT NULL,
  `statut` enum('OUVERT','EN_COURS','TERMINE','ANNULE') DEFAULT 'OUVERT',
  `date_declaration` datetime NOT NULL,
  `date_resolution` datetime DEFAULT NULL,
  `cout` bigint(20) DEFAULT 0,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `room_minibar`
--

CREATE TABLE `room_minibar` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED NOT NULL,
  `quantite` int(11) NOT NULL DEFAULT 0,
  `seuil_alerte` int(11) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `room_status_history`
--

CREATE TABLE `room_status_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `room_id` bigint(20) UNSIGNED NOT NULL,
  `ancien_statut` varchar(30) DEFAULT NULL,
  `nouveau_statut` varchar(30) DEFAULT NULL,
  `commentaire` text DEFAULT NULL,
  `changed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `changed_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `room_types`
--

CREATE TABLE `room_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `room_types`
--

INSERT INTO `room_types` (`id`, `nom`, `description`) VALUES
(1, 'Da', 'DADA');

-- --------------------------------------------------------

--
-- Structure de la table `stays`
--

CREATE TABLE `stays` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `reservation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `checkin_at` datetime DEFAULT NULL,
  `checkout_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stocks`
--

CREATE TABLE `stocks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `location_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantite` decimal(15,2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `stock_locations`
--

CREATE TABLE `stock_locations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `stock_locations`
--

INSERT INTO `stock_locations` (`id`, `nom`) VALUES
(2, 'Restaurant'),
(3, 'Bar & Lounge'),
(4, 'Casino');

-- --------------------------------------------------------

--
-- Structure de la table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `product_id` bigint(20) UNSIGNED DEFAULT NULL,
  `location_id` bigint(20) UNSIGNED DEFAULT NULL,
  `type_mouvement` varchar(30) DEFAULT NULL,
  `quantite` decimal(15,2) DEFAULT NULL,
  `source_module` varchar(30) DEFAULT NULL,
  `reference_id` bigint(20) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(150) DEFAULT NULL,
  `telephone` varchar(50) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `tables_restaurant`
--

CREATE TABLE `tables_restaurant` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `capacite` int(11) DEFAULT NULL,
  `statut` varchar(30) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `tables_restaurant`
--

INSERT INTO `tables_restaurant` (`id`, `numero`, `capacite`, `statut`) VALUES
(1, '15', 4, 'LIBRE');

-- --------------------------------------------------------

--
-- Structure de la table `units`
--

CREATE TABLE `units` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(20) DEFAULT NULL,
  `nom` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `units`
--

INSERT INTO `units` (`id`, `code`, `nom`) VALUES
(1, 'KG', 'Kilogrammes'),
(2, 'G', 'Grammes'),
(3, 'L', 'Litre'),
(4, 'CL', 'Centilitre'),
(5, 'ML', 'Mililitre'),
(6, 'PIECE', 'Pièce'),
(7, 'PORTION', 'Portion'),
(8, 'BOUTEILLE', 'Bouteille'),
(9, 'BOITE', 'Boite'),
(10, 'SACHET', 'Sachet');

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id_admin` bigint(20) UNSIGNED NOT NULL,
  `nom` varchar(100) NOT NULL,
  `prenom` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `role` enum('admin','manager','receptioniste','caisse','water','housekeeping') NOT NULL DEFAULT 'admin',
  `statut` enum('actif','inactif') NOT NULL DEFAULT 'actif',
  `date_creation` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id_admin`, `nom`, `prenom`, `email`, `mot_de_passe`, `role`, `statut`, `date_creation`) VALUES
(1, 'Admin', 'Super', 'admin@hda.com', '$2b$10$8w.JmgRVauS1ciHTxEi0jOiaUAN5mMr4GxyG6Qrp7ERTo7bbUD4ne', 'admin', 'actif', '2026-06-30 11:31:12'),
(2, 'Dupont', 'Jean', 'jean.manager@hda.com', '$2b$10$YbodZ1JKLUT8N/HBPYRLb.J7T.0omn.yaNV9MMQhCTVSgBThlaaKG', 'manager', 'actif', '2026-06-30 11:31:12'),
(3, 'Martin', 'Sophie', 'sophie.reception@hda.com', '$2b$10$ErLLgrT6aspas8CG6GD0..0etjHA8WqmBbZi0tLkErV8F23PNPn7S', 'receptioniste', 'actif', '2026-06-30 11:31:12'),
(4, 'Dubois', 'Philippe', 'philippe.caisse@hda.com', '$2b$10$tYejOeNoxJmlS4NvE5dTC.nnGs3ozbQzzDI.a989jDXVRbPpHo4lq', 'caisse', 'actif', '2026-06-30 11:31:13'),
(5, 'Lefevre', 'Nicolas', 'nicolas.water@hda.com', '$2b$10$ckkBl6c1ImigmKR/eEwkEutKH4uzn1tD28ZxJqLwovbsWPsju5mlS', 'water', 'actif', '2026-06-30 11:31:13'),
(6, 'Rousseau', 'Claire', 'claire.housekeeping@hda.com', '$2b$10$ibosLGjTRMDUkrGHUF2k6uJDVI97V2uoygzQQ5WSaRZ9qaYfOioUW', 'housekeeping', 'actif', '2026-06-30 11:31:13');

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_casino_ecarts_caisse`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_casino_ecarts_caisse` (
`session_id` bigint(20) unsigned
,`caisse` varchar(100)
,`salle` varchar(100)
,`user_id` bigint(20) unsigned
,`ouverture_at` datetime
,`fermeture_at` datetime
,`fond_initial` bigint(20) unsigned
,`fond_final_theorique` bigint(20)
,`fond_final_declare` bigint(20) unsigned
,`ecart` bigint(20)
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_casino_encours_credit`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_casino_encours_credit` (
`client_id` bigint(20) unsigned
,`client` varchar(201)
,`nb_credits_actifs` bigint(21)
,`encours_total` decimal(42,0)
,`prochaine_echeance` date
);

-- --------------------------------------------------------

--
-- Doublure de structure pour la vue `v_casino_produit_net_jour`
-- (Voir ci-dessous la vue réelle)
--
CREATE TABLE `v_casino_produit_net_jour` (
`room_id` bigint(20) unsigned
,`salle` varchar(100)
,`jour` date
,`total_entrees` decimal(42,0)
,`total_sorties` decimal(42,0)
,`produit_net` decimal(43,0)
);

-- --------------------------------------------------------

--
-- Structure de la vue `v_casino_ecarts_caisse`
--
DROP TABLE IF EXISTS `v_casino_ecarts_caisse`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_casino_ecarts_caisse`  AS SELECT `cs`.`id` AS `session_id`, `c`.`nom` AS `caisse`, `r`.`nom` AS `salle`, `cs`.`user_id` AS `user_id`, `cs`.`ouverture_at` AS `ouverture_at`, `cs`.`fermeture_at` AS `fermeture_at`, `cs`.`fond_initial` AS `fond_initial`, `cs`.`fond_final_theorique` AS `fond_final_theorique`, `cs`.`fond_final_declare` AS `fond_final_declare`, `cs`.`ecart` AS `ecart` FROM ((`casino_cashier_sessions` `cs` join `casino_cashiers` `c` on(`c`.`id` = `cs`.`cashier_id`)) join `casino_rooms` `r` on(`r`.`id` = `c`.`room_id`)) ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_casino_encours_credit`
--
DROP TABLE IF EXISTS `v_casino_encours_credit`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_casino_encours_credit`  AS SELECT `cl`.`id` AS `client_id`, concat(`cl`.`nom`,' ',coalesce(`cl`.`prenom`,'')) AS `client`, count(`cr`.`id`) AS `nb_credits_actifs`, sum(`cr`.`encours`) AS `encours_total`, max(`cr`.`echeance`) AS `prochaine_echeance` FROM (`casino_credits` `cr` join `clients` `cl` on(`cl`.`id` = `cr`.`client_id`)) WHERE `cr`.`statut` in ('ACTIF','EN_RETARD') GROUP BY `cl`.`id`, `cl`.`nom`, `cl`.`prenom` ;

-- --------------------------------------------------------

--
-- Structure de la vue `v_casino_produit_net_jour`
--
DROP TABLE IF EXISTS `v_casino_produit_net_jour`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_casino_produit_net_jour`  AS SELECT `r`.`id` AS `room_id`, `r`.`nom` AS `salle`, cast(`co`.`created_at` as date) AS `jour`, sum(case when `co`.`type_operation` in ('BUY_IN','DEPOT') then `co`.`montant` else 0 end) AS `total_entrees`, sum(case when `co`.`type_operation` in ('CASH_OUT','REMBOURSEMENT_CREDIT') then `co`.`montant` else 0 end) AS `total_sorties`, sum(case when `co`.`type_operation` in ('BUY_IN','DEPOT') then `co`.`montant` else 0 end) - sum(case when `co`.`type_operation` in ('CASH_OUT','REMBOURSEMENT_CREDIT') then `co`.`montant` else 0 end) AS `produit_net` FROM (((`casino_cash_operations` `co` join `casino_cashier_sessions` `cs` on(`cs`.`id` = `co`.`cashier_session_id`)) join `casino_cashiers` `c` on(`c`.`id` = `cs`.`cashier_id`)) join `casino_rooms` `r` on(`r`.`id` = `c`.`room_id`)) GROUP BY `r`.`id`, `r`.`nom`, cast(`co`.`created_at` as date) ;

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Index pour la table `casino_cards`
--
ALTER TABLE `casino_cards`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cards_numero` (`numero_carte`),
  ADD UNIQUE KEY `uq_cards_qr` (`qr_code`),
  ADD KEY `idx_cards_client` (`client_id`);

--
-- Index pour la table `casino_cashiers`
--
ALTER TABLE `casino_cashiers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_casino_cashiers_code` (`code`),
  ADD KEY `idx_casino_cashiers_room` (`room_id`);

--
-- Index pour la table `casino_cashier_sessions`
--
ALTER TABLE `casino_cashier_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_one_open_session_per_cashier` (`cashier_id`,`statut`),
  ADD KEY `idx_sessions_cashier` (`cashier_id`),
  ADD KEY `idx_sessions_user` (`user_id`),
  ADD KEY `idx_sessions_statut` (`statut`);

--
-- Index pour la table `casino_cash_operations`
--
ALTER TABLE `casino_cash_operations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_cashops_ref_flux` (`ref_flux_global`),
  ADD KEY `idx_cashops_session` (`cashier_session_id`),
  ADD KEY `idx_cashops_client` (`client_id`),
  ADD KEY `idx_cashops_type` (`type_operation`),
  ADD KEY `fk_cashops_credit` (`credit_id`);

--
-- Index pour la table `casino_chip_transactions`
--
ALTER TABLE `casino_chip_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chiptx_ref_flux` (`ref_flux_global`),
  ADD KEY `idx_chiptx_session` (`cashier_session_id`),
  ADD KEY `idx_chiptx_client` (`client_id`),
  ADD KEY `idx_chiptx_type` (`chip_type_id`);

--
-- Index pour la table `casino_chip_types`
--
ALTER TABLE `casino_chip_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_chip_types_code` (`code`);

--
-- Index pour la table `casino_client_profiles`
--
ALTER TABLE `casino_client_profiles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_profile_client` (`client_id`);

--
-- Index pour la table `casino_credits`
--
ALTER TABLE `casino_credits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_credits_client` (`client_id`);

--
-- Index pour la table `casino_credit_repayments`
--
ALTER TABLE `casino_credit_repayments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_repayments_credit` (`credit_id`);

--
-- Index pour la table `casino_incidents`
--
ALTER TABLE `casino_incidents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_incidents_client` (`client_id`);

--
-- Index pour la table `casino_rooms`
--
ALTER TABLE `casino_rooms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_casino_rooms_code` (`code`);

--
-- Index pour la table `casino_scores`
--
ALTER TABLE `casino_scores`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_scores_client` (`client_id`);

--
-- Index pour la table `casino_scoring_config`
--
ALTER TABLE `casino_scoring_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_scoring_config_cle` (`cle`);

--
-- Index pour la table `casino_visits`
--
ALTER TABLE `casino_visits`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_visits_client` (`client_id`),
  ADD KEY `idx_visits_room` (`room_id`);

--
-- Index pour la table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `clients`
--
ALTER TABLE `clients`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code_client` (`code_client`),
  ADD KEY `idx_client_nom` (`nom`);

--
-- Index pour la table `client_accounts`
--
ALTER TABLE `client_accounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`);

--
-- Index pour la table `equipments`
--
ALTER TABLE `equipments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`);

--
-- Index pour la table `financial_transactions`
--
ALTER TABLE `financial_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_financial_ref_flux` (`ref_flux_global`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `idx_financial_module` (`module`);

--
-- Index pour la table `housekeeping_tasks`
--
ALTER TABLE `housekeeping_tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `assigned_user_id` (`assigned_user_id`);

--
-- Index pour la table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`);

--
-- Index pour la table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `invoice_id` (`invoice_id`);

--
-- Index pour la table `lost_and_found`
--
ALTER TABLE `lost_and_found`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `client_id` (`client_id`);

--
-- Index pour la table `loyalty_points`
--
ALTER TABLE `loyalty_points`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`);

--
-- Index pour la table `minibar_consumptions`
--
ALTER TABLE `minibar_consumptions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Index pour la table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_orders_client` (`client_id`);

--
-- Index pour la table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Index pour la table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `invoice_id` (`invoice_id`);

--
-- Index pour la table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `category_id` (`category_id`);

--
-- Index pour la table `product_types`
--
ALTER TABLE `product_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_product_types_nom` (`nom`);

--
-- Index pour la table `purchases`
--
ALTER TABLE `purchases`
  ADD PRIMARY KEY (`id`),
  ADD KEY `supplier_id` (`supplier_id`);

--
-- Index pour la table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `purchase_id` (`purchase_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Index pour la table `recipes`
--
ALTER TABLE `recipes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`);

--
-- Index pour la table `recipe_items`
--
ALTER TABLE `recipe_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `recipe_id` (`recipe_id`),
  ADD KEY `ingredient_id` (`ingredient_id`);

--
-- Index pour la table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `client_id` (`client_id`),
  ADD KEY `room_id` (`room_id`);

--
-- Index pour la table `reservation_guests`
--
ALTER TABLE `reservation_guests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reservation_id` (`reservation_id`);

--
-- Index pour la table `restaurant_cashiers`
--
ALTER TABLE `restaurant_cashiers`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `restaurant_sessions`
--
ALTER TABLE `restaurant_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cashier_id` (`cashier_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Index pour la table `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero` (`numero`),
  ADD KEY `room_type_id` (`room_type_id`);

--
-- Index pour la table `room_equipments`
--
ALTER TABLE `room_equipments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_room_equipment_room` (`room_id`),
  ADD KEY `fk_room_equipment_equipment` (`equipment_id`);

--
-- Index pour la table `room_maintenance`
--
ALTER TABLE `room_maintenance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `equipment_id` (`equipment_id`),
  ADD KEY `created_by` (`created_by`);

--
-- Index pour la table `room_minibar`
--
ALTER TABLE `room_minibar`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `product_id` (`product_id`);

--
-- Index pour la table `room_status_history`
--
ALTER TABLE `room_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `room_id` (`room_id`),
  ADD KEY `changed_by` (`changed_by`);

--
-- Index pour la table `room_types`
--
ALTER TABLE `room_types`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stays`
--
ALTER TABLE `stays`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reservation_id` (`reservation_id`);

--
-- Index pour la table `stocks`
--
ALTER TABLE `stocks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `location_id` (`location_id`);

--
-- Index pour la table `stock_locations`
--
ALTER TABLE `stock_locations`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `location_id` (`location_id`);

--
-- Index pour la table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `tables_restaurant`
--
ALTER TABLE `tables_restaurant`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `units`
--
ALTER TABLE `units`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id_admin`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT pour la table `casino_cards`
--
ALTER TABLE `casino_cards`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `casino_cashiers`
--
ALTER TABLE `casino_cashiers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `casino_cashier_sessions`
--
ALTER TABLE `casino_cashier_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `casino_cash_operations`
--
ALTER TABLE `casino_cash_operations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `casino_chip_transactions`
--
ALTER TABLE `casino_chip_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_chip_types`
--
ALTER TABLE `casino_chip_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_client_profiles`
--
ALTER TABLE `casino_client_profiles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_credits`
--
ALTER TABLE `casino_credits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_credit_repayments`
--
ALTER TABLE `casino_credit_repayments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_incidents`
--
ALTER TABLE `casino_incidents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_rooms`
--
ALTER TABLE `casino_rooms`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `casino_scores`
--
ALTER TABLE `casino_scores`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `casino_scoring_config`
--
ALTER TABLE `casino_scoring_config`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT pour la table `casino_visits`
--
ALTER TABLE `casino_visits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT pour la table `clients`
--
ALTER TABLE `clients`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `client_accounts`
--
ALTER TABLE `client_accounts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `equipments`
--
ALTER TABLE `equipments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `financial_transactions`
--
ALTER TABLE `financial_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `housekeeping_tasks`
--
ALTER TABLE `housekeeping_tasks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `lost_and_found`
--
ALTER TABLE `lost_and_found`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `loyalty_points`
--
ALTER TABLE `loyalty_points`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `minibar_consumptions`
--
ALTER TABLE `minibar_consumptions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `products`
--
ALTER TABLE `products`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `product_types`
--
ALTER TABLE `product_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT pour la table `purchases`
--
ALTER TABLE `purchases`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `purchase_items`
--
ALTER TABLE `purchase_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `recipes`
--
ALTER TABLE `recipes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `recipe_items`
--
ALTER TABLE `recipe_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `reservation_guests`
--
ALTER TABLE `reservation_guests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `restaurant_cashiers`
--
ALTER TABLE `restaurant_cashiers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `restaurant_sessions`
--
ALTER TABLE `restaurant_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `room_equipments`
--
ALTER TABLE `room_equipments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `room_maintenance`
--
ALTER TABLE `room_maintenance`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `room_minibar`
--
ALTER TABLE `room_minibar`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `room_status_history`
--
ALTER TABLE `room_status_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `room_types`
--
ALTER TABLE `room_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `stays`
--
ALTER TABLE `stays`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stocks`
--
ALTER TABLE `stocks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `stock_locations`
--
ALTER TABLE `stock_locations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `tables_restaurant`
--
ALTER TABLE `tables_restaurant`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT pour la table `units`
--
ALTER TABLE `units`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id_admin` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_admin`);

--
-- Contraintes pour la table `casino_cards`
--
ALTER TABLE `casino_cards`
  ADD CONSTRAINT `fk_cards_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `casino_cashiers`
--
ALTER TABLE `casino_cashiers`
  ADD CONSTRAINT `fk_cashiers_room` FOREIGN KEY (`room_id`) REFERENCES `casino_rooms` (`id`);

--
-- Contraintes pour la table `casino_cashier_sessions`
--
ALTER TABLE `casino_cashier_sessions`
  ADD CONSTRAINT `fk_sessions_cashier` FOREIGN KEY (`cashier_id`) REFERENCES `casino_cashiers` (`id`);

--
-- Contraintes pour la table `casino_cash_operations`
--
ALTER TABLE `casino_cash_operations`
  ADD CONSTRAINT `fk_cashops_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `fk_cashops_credit` FOREIGN KEY (`credit_id`) REFERENCES `casino_credits` (`id`),
  ADD CONSTRAINT `fk_cashops_session` FOREIGN KEY (`cashier_session_id`) REFERENCES `casino_cashier_sessions` (`id`);

--
-- Contraintes pour la table `casino_chip_transactions`
--
ALTER TABLE `casino_chip_transactions`
  ADD CONSTRAINT `fk_chiptx_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `fk_chiptx_session` FOREIGN KEY (`cashier_session_id`) REFERENCES `casino_cashier_sessions` (`id`),
  ADD CONSTRAINT `fk_chiptx_type` FOREIGN KEY (`chip_type_id`) REFERENCES `casino_chip_types` (`id`);

--
-- Contraintes pour la table `casino_client_profiles`
--
ALTER TABLE `casino_client_profiles`
  ADD CONSTRAINT `fk_profile_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `casino_credits`
--
ALTER TABLE `casino_credits`
  ADD CONSTRAINT `fk_credits_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `casino_credit_repayments`
--
ALTER TABLE `casino_credit_repayments`
  ADD CONSTRAINT `fk_repayments_credit` FOREIGN KEY (`credit_id`) REFERENCES `casino_credits` (`id`);

--
-- Contraintes pour la table `casino_incidents`
--
ALTER TABLE `casino_incidents`
  ADD CONSTRAINT `fk_incidents_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `casino_scores`
--
ALTER TABLE `casino_scores`
  ADD CONSTRAINT `fk_scores_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `casino_visits`
--
ALTER TABLE `casino_visits`
  ADD CONSTRAINT `fk_visits_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `fk_visits_room` FOREIGN KEY (`room_id`) REFERENCES `casino_rooms` (`id`);

--
-- Contraintes pour la table `client_accounts`
--
ALTER TABLE `client_accounts`
  ADD CONSTRAINT `client_accounts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `financial_transactions`
--
ALTER TABLE `financial_transactions`
  ADD CONSTRAINT `financial_transactions_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `housekeeping_tasks`
--
ALTER TABLE `housekeeping_tasks`
  ADD CONSTRAINT `housekeeping_tasks_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  ADD CONSTRAINT `housekeeping_tasks_ibfk_2` FOREIGN KEY (`assigned_user_id`) REFERENCES `users` (`id_admin`);

--
-- Contraintes pour la table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `invoice_items_ibfk_1` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`);

--
-- Contraintes pour la table `lost_and_found`
--
ALTER TABLE `lost_and_found`
  ADD CONSTRAINT `lost_and_found_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  ADD CONSTRAINT `lost_and_found_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `loyalty_points`
--
ALTER TABLE `loyalty_points`
  ADD CONSTRAINT `loyalty_points_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `minibar_consumptions`
--
ALTER TABLE `minibar_consumptions`
  ADD CONSTRAINT `minibar_consumptions_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  ADD CONSTRAINT `minibar_consumptions_ibfk_2` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `minibar_consumptions_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`);

--
-- Contraintes pour la table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`);

--
-- Contraintes pour la table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`);

--
-- Contraintes pour la table `purchases`
--
ALTER TABLE `purchases`
  ADD CONSTRAINT `purchases_ibfk_1` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`);

--
-- Contraintes pour la table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD CONSTRAINT `purchase_items_ibfk_1` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`),
  ADD CONSTRAINT `purchase_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `recipes`
--
ALTER TABLE `recipes`
  ADD CONSTRAINT `recipes_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `recipe_items`
--
ALTER TABLE `recipe_items`
  ADD CONSTRAINT `recipe_items_ibfk_1` FOREIGN KEY (`recipe_id`) REFERENCES `recipes` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `recipe_items_ibfk_2` FOREIGN KEY (`ingredient_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `reservations_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`),
  ADD CONSTRAINT `reservations_ibfk_2` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`);

--
-- Contraintes pour la table `reservation_guests`
--
ALTER TABLE `reservation_guests`
  ADD CONSTRAINT `reservation_guests_ibfk_1` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `restaurant_sessions`
--
ALTER TABLE `restaurant_sessions`
  ADD CONSTRAINT `restaurant_sessions_ibfk_1` FOREIGN KEY (`cashier_id`) REFERENCES `restaurant_cashiers` (`id`),
  ADD CONSTRAINT `restaurant_sessions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id_admin`);

--
-- Contraintes pour la table `rooms`
--
ALTER TABLE `rooms`
  ADD CONSTRAINT `rooms_ibfk_1` FOREIGN KEY (`room_type_id`) REFERENCES `room_types` (`id`);

--
-- Contraintes pour la table `room_equipments`
--
ALTER TABLE `room_equipments`
  ADD CONSTRAINT `fk_room_equipment_equipment` FOREIGN KEY (`equipment_id`) REFERENCES `equipments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_room_equipment_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `room_maintenance`
--
ALTER TABLE `room_maintenance`
  ADD CONSTRAINT `room_maintenance_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  ADD CONSTRAINT `room_maintenance_ibfk_2` FOREIGN KEY (`equipment_id`) REFERENCES `equipments` (`id`),
  ADD CONSTRAINT `room_maintenance_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id_admin`);

--
-- Contraintes pour la table `room_minibar`
--
ALTER TABLE `room_minibar`
  ADD CONSTRAINT `room_minibar_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `room_minibar_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

--
-- Contraintes pour la table `room_status_history`
--
ALTER TABLE `room_status_history`
  ADD CONSTRAINT `room_status_history_ibfk_1` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`),
  ADD CONSTRAINT `room_status_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id_admin`);

--
-- Contraintes pour la table `stays`
--
ALTER TABLE `stays`
  ADD CONSTRAINT `stays_ibfk_1` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`);

--
-- Contraintes pour la table `stocks`
--
ALTER TABLE `stocks`
  ADD CONSTRAINT `stocks_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `stocks_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `stock_locations` (`id`);

--
-- Contraintes pour la table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `stock_movements_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `stock_movements_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `stock_locations` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
