# Database Migration for Support Chat Feature

## Overview
This migration adds the `type` column to the `conversations` table to distinguish between LISTING chats and SUPPORT chats.

## Schema Changes
File: `src/db/schema/messages.ts`
- Added `type` field with enum `["LISTING", "SUPPORT"]`
- Default value: `"LISTING"`
- All existing conversations will default to LISTING type

## How to Run Migration

### Step 1: Generate Migration
The schema has already been updated in `src/db/schema/messages.ts`. 
Now generate the migration SQL file:

```bash
pnpm db:generate
```

This will create a new migration file in `src/db/migrations/` with a name like `0007_<random_name>.sql`

### Step 2: Review Generated Migration
Check the generated SQL file to ensure it contains:
- ALTER TABLE to add `type` column
- CHECK constraint for enum values
- Default value set to 'LISTING'

### Step 3: Run Migration
Apply the migration to your database:

```bash
pnpm db:migrate
```

This will execute all pending migrations in the `src/db/migrations/` folder.

### Step 4: Verify
After migration, verify the changes:

```sql
-- Check column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'conversations' AND column_name = 'type';

-- Check existing data
SELECT type, COUNT(*) 
FROM conversations 
GROUP BY type;
```

All existing conversations should have `type = 'LISTING'`.

## Rollback (if needed)
If you need to rollback, you can manually run:

```sql
ALTER TABLE conversations DROP COLUMN IF EXISTS type;
```

## Notes
- This is a non-breaking change
- Existing conversations will continue to work
- New support chats will be created with `type = 'SUPPORT'`
- The migration is safe to run on production
