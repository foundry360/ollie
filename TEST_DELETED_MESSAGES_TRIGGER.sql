-- Test script to verify deleted messages tracking is working
-- Run this in Supabase SQL Editor

-- 1. Check if the trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'track_deleted_twilio_message_trigger';

-- 2. Check if the function exists
SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines
WHERE routine_name = 'track_deleted_twilio_message';

-- 3. Check if the table exists
SELECT 
  table_name, 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_name = 'deleted_twilio_messages'
ORDER BY ordinal_position;

-- 4. Find a message with a twilio_message_sid to test with
SELECT 
  id, 
  twilio_message_sid, 
  content, 
  sender_id, 
  recipient_id,
  created_at
FROM public.messages
WHERE twilio_message_sid IS NOT NULL
LIMIT 5;

-- 5. Test the trigger (CAREFUL: This will delete a message!)
-- Replace 'YOUR_MESSAGE_ID_HERE' with an actual message ID from step 4
-- Uncomment the line below to test:
-- DELETE FROM public.messages WHERE id = 'YOUR_MESSAGE_ID_HERE';

-- 6. After deleting, check if it was tracked
SELECT * FROM public.deleted_twilio_messages
ORDER BY deleted_at DESC
LIMIT 10;

-- 7. Check recent deletions (if any)
SELECT COUNT(*) as total_deleted_messages
FROM public.deleted_twilio_messages;






