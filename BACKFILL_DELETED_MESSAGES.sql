-- ONE-TIME SCRIPT: Backfill deleted_twilio_messages table
-- This finds all messages that exist in Twilio but NOT in your messages table
-- and marks them as deleted (in case they were deleted before the trigger was set up)

-- IMPORTANT: Run this AFTER migration 041 has been applied

-- Step 1: Check what's currently in deleted_messages
SELECT 
  COUNT(*) as total_tracked_deletions,
  MIN(deleted_at) as oldest_deletion,
  MAX(deleted_at) as newest_deletion
FROM public.deleted_twilio_messages;

-- Step 2: Find messages that have twilio_message_sid but might have been deleted
-- (This is just for reference - you can't automatically find deleted messages)
SELECT 
  COUNT(*) as messages_with_twilio_sid
FROM public.messages
WHERE twilio_message_sid IS NOT NULL;

-- Step 3: If you know specific twilio_message_sids that were deleted,
-- manually insert them here:
-- INSERT INTO public.deleted_twilio_messages (twilio_message_sid, deleted_by)
-- VALUES ('CHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', NULL)
-- ON CONFLICT (twilio_message_sid) DO NOTHING;

-- Step 4: Verify the trigger is working by checking recent activity
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE trigger_name = 'track_deleted_twilio_message_trigger';

-- Step 5: Test the trigger (CAREFUL - deletes a message!)
-- First, find a test message:
-- SELECT id, twilio_message_sid FROM public.messages WHERE twilio_message_sid IS NOT NULL LIMIT 1;
-- Then delete it and check if it was tracked:
-- DELETE FROM public.messages WHERE id = 'YOUR_TEST_MESSAGE_ID';
-- SELECT * FROM public.deleted_twilio_messages WHERE twilio_message_sid = 'THE_SID_FROM_ABOVE';






