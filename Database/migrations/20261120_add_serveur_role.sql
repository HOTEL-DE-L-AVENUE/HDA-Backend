-- Add the waiter role; page and action permissions will be assigned separately.
ALTER TABLE users
  MODIFY COLUMN role ENUM(
    'admin', 'manager', 'receptioniste', 'caisse', 'water',
    'housekeeping', 'croupier', 'hotesse', 'serveur'
  ) NOT NULL DEFAULT 'admin';
