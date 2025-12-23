-- Enable Realtime for messages table
-- This ensures the table is included in the Realtime publication

-- Add messages table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Verify it was added (run this separately to check)
-- SELECT schemaname, tablename 
-- FROM pg_publication_tables 
-- WHERE pubname = 'supabase_realtime' AND tablename = 'messages';





