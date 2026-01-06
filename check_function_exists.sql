-- This query will show you if the notify_gig_completed FUNCTION exists
-- Functions are stored in pg_proc, not as tables you can see in the table list

-- Check if the FUNCTION exists
SELECT 
  'Function Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS ✓'
    ELSE 'DOES NOT EXIST ✗'
  END as status,
  COUNT(*) as count
FROM pg_proc 
WHERE proname = 'notify_gig_completed';

-- Show the function details if it exists
SELECT 
  'Function Details' as check_type,
  proname as function_name,
  pronargs as parameter_count,
  prorettype::regtype as return_type,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%v_neighbor_recipient_id%' THEN 'Has correct variables ✓'
    ELSE 'Missing variables ✗'
  END as has_correct_variables
FROM pg_proc 
WHERE proname = 'notify_gig_completed';

-- Check if the TRIGGER exists
SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN 'EXISTS ✓'
    ELSE 'DOES NOT EXIST ✗'
  END as status,
  COUNT(*) as count
FROM pg_trigger 
WHERE tgname = 'on_gig_completed_notify';

-- Show trigger details if it exists
SELECT 
  'Trigger Details' as check_type,
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE 
    WHEN tgenabled = 'O' THEN 'Enabled ✓'
    WHEN tgenabled = 'D' THEN 'Disabled ✗'
    ELSE 'Unknown'
  END as trigger_status
FROM pg_trigger 
WHERE tgname = 'on_gig_completed_notify';

-- Note: To check applied migrations, look in your Supabase Dashboard under Database → Migrations

