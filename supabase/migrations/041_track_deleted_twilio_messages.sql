-- Track deleted Twilio message SIDs to prevent sync from re-inserting them
CREATE TABLE IF NOT EXISTS public.deleted_twilio_messages (
  twilio_message_sid TEXT PRIMARY KEY,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deleted_twilio_messages_sid ON public.deleted_twilio_messages(twilio_message_sid);

-- Enable RLS
ALTER TABLE public.deleted_twilio_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can read deleted messages" ON public.deleted_twilio_messages;
DROP POLICY IF EXISTS "Users can mark messages as deleted" ON public.deleted_twilio_messages;

-- Users can read deleted message records (for sync function)
CREATE POLICY "Users can read deleted messages" ON public.deleted_twilio_messages
  FOR SELECT USING (true);

-- Users can insert deleted message records (when they delete a message)
CREATE POLICY "Users can mark messages as deleted" ON public.deleted_twilio_messages
  FOR INSERT WITH CHECK (true);

COMMENT ON TABLE public.deleted_twilio_messages IS 'Tracks Twilio message SIDs that have been deleted to prevent sync from re-inserting them';

-- Function to automatically track deleted Twilio messages
CREATE OR REPLACE FUNCTION public.track_deleted_twilio_message()
RETURNS TRIGGER AS $$
BEGIN
  -- If the deleted message has a twilio_message_sid, track it
  IF OLD.twilio_message_sid IS NOT NULL AND OLD.twilio_message_sid != '' THEN
    INSERT INTO public.deleted_twilio_messages (twilio_message_sid, deleted_by)
    VALUES (OLD.twilio_message_sid, COALESCE(auth.uid(), NULL))
    ON CONFLICT (twilio_message_sid) DO UPDATE
    SET deleted_at = NOW(), deleted_by = COALESCE(auth.uid(), deleted_by);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS track_deleted_twilio_message_trigger ON public.messages;

-- Trigger to automatically track deleted messages
CREATE TRIGGER track_deleted_twilio_message_trigger
  AFTER DELETE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.track_deleted_twilio_message();






