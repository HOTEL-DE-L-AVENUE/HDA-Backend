-- Migration: Add Hotel location to stock_locations for minibar management
-- Date: 2025-01-13
-- Description: Adds Hotel as a stock location to enable proper minibar stock tracking

INSERT INTO `stock_locations` (`id`, `nom`) VALUES
(5, 'Hotel');

-- Add constraint if not exists (may need to be adjusted based on existing constraints)
-- This ensures that stock movements can reference the Hotel location