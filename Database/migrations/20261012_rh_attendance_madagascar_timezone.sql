-- Corrige une seule fois les pointages existants précédemment stockés en UTC.
-- Faire une sauvegarde et arrêter le backend avant l'exécution.
-- node Database/runMigration.js Database/migrations/20261012_rh_attendance_madagascar_timezone.sql
-- Ne pas exécuter une seconde fois : les nouvelles heures seront déjà en UTC+3.

UPDATE rh_attendance
SET check_in = SEC_TO_TIME(MOD(TIME_TO_SEC(check_in) + 10800, 86400)),
    check_out = SEC_TO_TIME(MOD(TIME_TO_SEC(check_out) + 10800, 86400)),
    status = CASE
      WHEN status IN ('PRESENT', 'RETARD') AND check_in IS NOT NULL
        THEN IF(check_in > '08:15:00', 'RETARD', 'PRESENT')
      ELSE status
    END
WHERE check_in IS NOT NULL OR check_out IS NOT NULL;
