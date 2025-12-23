-- Check if REPLICA IDENTITY is set for messages table
-- Run this in Supabase SQL Editor to verify Realtime setup

SELECT 
  n.nspname as schemaname,
  c.relname as tablename,
  CASE c.relreplident
    WHEN 'd' THEN 'DEFAULT (needs migration 042)'
    WHEN 'n' THEN 'NOTHING'
    WHEN 'f' THEN 'FULL (correct - Realtime enabled)'
    WHEN 'i' THEN 'INDEX'
    ELSE 'UNKNOWN: ' || c.relreplident::text
  END as replica_identity_status,
  c.relreplident as replica_identity_code
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relname = 'messages';

-- Expected result: replica_identity_status should be 'FULL (correct - Realtime enabled)'
-- If it shows 'DEFAULT (needs migration 042)', run migration 042





