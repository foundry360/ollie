-- Check current RLS policy for messages INSERT
-- This will show if migration 044 was applied

-- Check if the SECURITY DEFINER function exists
SELECT 
  proname as function_name,
  prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'user_has_message_history';

-- Check current INSERT policy
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'messages' 
  AND policyname = 'Users can send messages';

-- If the function doesn't exist or the policy doesn't use it, migration 044 wasn't applied




