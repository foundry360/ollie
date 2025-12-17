# Run Migration 012 - Create Pending Application Function

## Quick Fix for RLS Error

The RLS error you're seeing is because the database function hasn't been created yet. Run this migration to fix it.

## Steps

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click **SQL Editor** in the left sidebar
   - Click **New Query**

3. **Run the Migration**
   - Copy the contents of `supabase/migrations/012_create_pending_application_function.sql`
   - Paste into the SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

4. **Verify**
   - You should see "Success. No rows returned"
   - The function is now created and ready to use

## Alternative: Run All Migrations

If you haven't run the previous migrations yet, you can run them all at once:

1. Run `supabase/migrations/010_pending_neighbor_applications.sql`
2. Run `supabase/migrations/011_pending_neighbor_applications_rls.sql`
3. Run `supabase/migrations/012_create_pending_application_function.sql`

Or use the combined test file: `TEST_NEIGHBOR_MIGRATION.sql` (but you'll need to add the function from 012)
