-- Migration: Create a debug logging table to capture function execution details
-- This ensures we can see what's happening even if RAISE NOTICE doesn't show in logs

CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_level TEXT NOT NULL DEFAULT 'info',
  function_name TEXT,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON public.debug_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debug_logs_function_name ON public.debug_logs(function_name);

-- Enable RLS (but allow service role to insert)
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert debug logs" ON public.debug_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read debug logs" ON public.debug_logs
  FOR SELECT USING (true);
























