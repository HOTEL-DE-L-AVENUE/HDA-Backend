# Database Migration Instructions

## Etage Field Migration (2026-08-11)

### Overview
This migration adds the `etage` (floor) field to the `rooms` table to support multi-floor hotel management.

### Migration File
- **File**: `add_etage_to_rooms.sql`
- **Location**: `HDA-Backend/Database/migrations/`

### Manual Execution

#### Option 1: Using MySQL Command Line
```bash
mysql -u your_username -p hda < Database/migrations/add_etage_to_rooms.sql
```

#### Option 2: Using MySQL Workbench/phpMyAdmin
1. Open your MySQL client
2. Select the `hda` database
3. Execute the SQL from `add_etage_to_rooms.sql`:
```sql
ALTER TABLE `rooms` 
ADD COLUMN `etage` INT(11) DEFAULT 0 AFTER `statut`;

UPDATE `rooms` SET `etage` = 1 WHERE `id` = 1;
```

### Verification
After running the migration, verify the column was added:
```sql
DESCRIBE rooms;
```

You should see `etage` in the column list with type `int(11)` and default value `0`.

### Impact
- **Backend**: The `hebergementModel.js` has been updated to include `etage` in the Rooms model fields
- **Frontend**: The `hotel.service.ts` and `hotel.types.ts` have been updated to handle the `etage` field
- **Existing Data**: The migration sets a default floor of 0 for all existing rooms, then updates room ID 1 to floor 1 as an example

### Rollback (if needed)
If you need to rollback this migration:
```sql
ALTER TABLE `rooms` DROP COLUMN `etage`;
```

### Notes
- The `etage` field is now properly persisted in the database
- Frontend forms can now capture and display floor information
- Room filtering and sorting can now include floor/etage criteria