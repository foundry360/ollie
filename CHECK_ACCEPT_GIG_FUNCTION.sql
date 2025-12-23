-- Diagnostic query to check if accept_gig function exists
-- Run this in Supabase SQL Editor to verify the function was created

SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  n.nspname AS schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'accept_gig'
ORDER BY n.nspname, p.proname;

-- Also check permissions
SELECT 
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'accept_gig' 
  AND routine_schema = 'public';





















