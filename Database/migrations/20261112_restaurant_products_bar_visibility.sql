-- Adds the option to display restaurant dishes in Bar & Cocktails.
-- Safe to execute more than once.

DROP PROCEDURE IF EXISTS hda_add_restaurant_bar_visibility;

DELIMITER $$

CREATE PROCEDURE hda_add_restaurant_bar_visibility()
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'products'
       AND COLUMN_NAME = 'afficher_dans_bar'
  ) THEN
    ALTER TABLE products
      ADD COLUMN afficher_dans_bar TINYINT(1) NOT NULL DEFAULT 0;
  END IF;
END$$

DELIMITER ;

CALL hda_add_restaurant_bar_visibility();
DROP PROCEDURE hda_add_restaurant_bar_visibility;
