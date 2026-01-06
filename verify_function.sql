-- Run this in Supabase SQL Editor to verify the function and trigger exist

-- Check if function exists
SELECT 
  proname as function_name,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%v_neighbor_recipient_id%' THEN 'Has correct variables'
    ELSE 'Missing variables'
  END as function_status,
  LENGTH(pg_get_functiondef(oid)) as function_length
FROM pg_proc 
WHERE proname = 'notify_gig_completed';

-- Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as is_enabled,
  CASE 
    WHEN tgenabled = 'O' THEN 'Enabled'
    WHEN tgenabled = 'D' THEN 'Disabled'
    ELSE 'Unknown'
  END as trigger_status
FROM pg_trigger 
WHERE tgname = 'on_gig_completed_notify';

-- Check recent notifications to see if function is being called
SELECT 
  id,
  user_id,
  type,
  title,
  body,
  data->>'recipient_role' as recipient_role,
  data->>'gig_id' as gig_id,
  created_at
FROM public.notifications
WHERE type = 'gig_completed'
ORDER BY created_at DESC
LIMIT 10;

-- Check recent gig completions
SELECT 
  id,
  title,
  poster_id,
  teen_id,
  status,
  updated_at
FROM public.gigs
WHERE status = 'completed'
ORDER BY updated_at DESC
LIMIT 5;

