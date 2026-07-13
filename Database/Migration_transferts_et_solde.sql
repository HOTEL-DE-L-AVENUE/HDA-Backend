-- =====================================================================
-- Migration : transferts de fonds entre caisses (inter-département)
--             + activation de client_accounts.solde comme source de
--               vérité du solde consolidé client (crédits casino)
-- =====================================================================

-- 1. Nouvelle table transversale des transferts inter-caisses.
--    Référence polymorphe (module + session_id) volontairement sans FK,
--    cohérent avec le reste du schéma (financial_transactions.reference_id
--    fonctionne déjà ainsi).
CREATE TABLE `caisse_transfers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `module_source` varchar(30) NOT NULL COMMENT 'CASINO, RESTAURANT, BAR, BOUTIQUE, HEBERGEMENT',
  `session_source_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Référence polymorphe vers la session de caisse émettrice',
  `module_destination` varchar(30) NOT NULL,
  `session_destination_id` bigint(20) UNSIGNED NOT NULL COMMENT 'Référence polymorphe vers la session de caisse réceptrice',
  `montant` bigint(20) UNSIGNED NOT NULL,
  `motif` varchar(255) DEFAULT NULL,
  `statut` enum('EN_ATTENTE','CONFIRME','REFUSE','ANNULE') NOT NULL DEFAULT 'EN_ATTENTE',
  `ref_flux_global_source` varchar(64) DEFAULT NULL,
  `ref_flux_global_destination` varchar(64) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED NOT NULL,
  `confirmed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `confirmed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `caisse_transfers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ct_module_source` (`module_source`, `session_source_id`),
  ADD KEY `idx_ct_module_destination` (`module_destination`, `session_destination_id`),
  ADD KEY `idx_ct_statut` (`statut`);

ALTER TABLE `caisse_transfers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

-- 2. casino_cash_operations : accueille le mouvement quand le casino est
--    source ou destination d'un transfert, pour que computeSessionTotals()
--    (résumé / clôture de session) reste exact sans changement de logique.
ALTER TABLE `casino_cash_operations`
  MODIFY COLUMN `type_operation`
    ENUM('BUY_IN','CASH_OUT','AVANCE_CREDIT','REMBOURSEMENT_CREDIT','DEPOT','TRANSFERT_ENTRANT','TRANSFERT_SORTANT','AUTRE')
    NOT NULL,
  ADD COLUMN `transfer_id` bigint(20) UNSIGNED DEFAULT NULL COMMENT 'Référence vers caisse_transfers si type TRANSFERT_*' AFTER `credit_id`;

-- 3. client_accounts : contrainte manquante pour servir de source de
--    vérité (ON DUPLICATE KEY UPDATE dans adjustClientAccountSolde()
--    nécessite une ligne unique par client).
ALTER TABLE `client_accounts`
  ADD UNIQUE KEY `uq_client_accounts_client` (`client_id`);

-- 4. Backfill : reconstitue le solde consolidé à partir de l'encours de
--    crédit casino déjà existant (exécuter UNE SEULE FOIS, après migration,
--    sur une base où adjustClientAccountSolde() n'a pas encore tourné).
INSERT INTO `client_accounts` (`client_id`, `solde`)
SELECT `client_id`, SUM(`encours`)
FROM `casino_credits`
WHERE `statut` IN ('ACTIF', 'EN_RETARD')
GROUP BY `client_id`
ON DUPLICATE KEY UPDATE `solde` = VALUES(`solde`);