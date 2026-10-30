-- Add a purchase price for bar products so it can be maintained from stock management.
ALTER TABLE bar_products
  ADD COLUMN prix_achat DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER prix;
