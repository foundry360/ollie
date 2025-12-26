-- Check if the config table exists and has the correct values
SELECT * FROM public.neighbor_approval_email_config WHERE id = 'default';

-- Check if the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_neighbor_approval_update_address';

-- Check recent application status changes (to see if trigger is firing)
SELECT 
  id,
  email,
  full_name,
  status,
  updated_at
FROM public.pending_neighbor_applications
ORDER BY updated_at DESC
LIMIT 5;

