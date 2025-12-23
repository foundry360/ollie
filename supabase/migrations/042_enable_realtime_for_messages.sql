-- Enable Realtime for messages table
-- This allows Supabase Realtime to broadcast INSERT/UPDATE/DELETE events

-- Enable Realtime replication for messages table
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Note: Realtime is enabled by default in Supabase for all tables
-- But we need to ensure the table has REPLICA IDENTITY FULL for proper event broadcasting
-- This allows Realtime to send the full row data in events





