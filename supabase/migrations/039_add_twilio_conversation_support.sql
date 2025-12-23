-- Add Twilio Conversations support
-- This migration adds a table to track Twilio conversation SIDs mapped to gigs and participants

CREATE TABLE IF NOT EXISTS public.gig_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gig_id UUID NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  participant1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  twilio_conversation_sid TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gig_id, participant1_id, participant2_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_conversations_gig_id ON public.gig_conversations(gig_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_participant1_id ON public.gig_conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_participant2_id ON public.gig_conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_gig_conversations_twilio_sid ON public.gig_conversations(twilio_conversation_sid);

ALTER TABLE public.gig_conversations ENABLE ROW LEVEL SECURITY;

-- Users can read conversations they're part of
CREATE POLICY "Users can read own conversations" ON public.gig_conversations
  FOR SELECT USING (
    participant1_id = auth.uid() OR participant2_id = auth.uid()
  );

-- System can create conversations (via Edge Function with service role)
-- In production, restrict this to service role only
CREATE POLICY "System can create conversations" ON public.gig_conversations
  FOR INSERT WITH CHECK (true);

-- Trigger to update updated_at
CREATE TRIGGER update_gig_conversations_updated_at
  BEFORE UPDATE ON public.gig_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
