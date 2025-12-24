-- Enable realtime for pending_teen_signups table
-- This allows the app to listen for status changes via realtime subscriptions

-- Add table to supabase_realtime publication if not already added
-- This is required for realtime subscriptions to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'pending_teen_signups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_teen_signups;
  END IF;
END $$;

-- Set REPLICA IDENTITY FULL so that UPDATE events include the full row data
-- This is required for realtime to work properly with UPDATE events
ALTER TABLE public.pending_teen_signups REPLICA IDENTITY FULL;

