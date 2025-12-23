-- Add twilio_message_sid to messages table for webhook deduplication
-- This allows us to track which Twilio messages have been synced to Supabase

ALTER TABLE IF EXISTS public.messages 
  ADD COLUMN IF NOT EXISTS twilio_message_sid TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_twilio_sid ON public.messages(twilio_message_sid) 
  WHERE twilio_message_sid IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.messages.twilio_message_sid IS 'Twilio Conversations message SID for deduplication and webhook tracking';







