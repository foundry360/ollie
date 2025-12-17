# Migration Verification Guide

## How to Test the Migration

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `TEST_NEIGHBOR_MIGRATION.sql`
4. Copy and paste the entire contents into the SQL Editor
5. Click **Run** or press `Cmd/Ctrl + Enter`
6. Check for any errors in the output

### Option 2: Run Migration Files Separately

1. Run `supabase/migrations/010_pending_neighbor_applications.sql` first
2. Then run `supabase/migrations/011_pending_neighbor_applications_rls.sql`
3. Check for errors after each

## Verification Steps

After running the migration, run the verification queries at the bottom of `TEST_NEIGHBOR_MIGRATION.sql`:

1. **Table Structure**: Should show 15 columns
2. **Indexes**: Should show 5 indexes created
3. **Users Table**: Should show `address` and `application_status` columns added
4. **Functions**: Should show 2 functions created
5. **Trigger**: Should show 1 trigger on the table
6. **RLS Policies**: Should show 5 policies created

## Expected Results

✅ **Table**: `pending_neighbor_applications` exists with all columns
✅ **Indexes**: 5 indexes created for performance
✅ **Users Table**: `address` and `application_status` columns added
✅ **Functions**: Both functions created successfully
✅ **Trigger**: Auto-update trigger active
✅ **RLS**: 5 policies protecting the table

## Common Issues

- **"relation already exists"**: Table already created, migration is idempotent (safe to re-run)
- **"permission denied"**: Make sure you're using the correct database role
- **"column already exists"**: The DO blocks handle this, safe to ignore

## Next Steps

Once migration is verified:
1. ✅ Phase 1 Complete
2. → Move to Phase 2: SMS Functions
