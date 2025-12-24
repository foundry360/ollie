-- Migration: Rename tasks table to gigs to match new terminology
-- This migration renames the tasks table and updates all related references

-- Step 1: Rename the table
ALTER TABLE IF EXISTS public.tasks RENAME TO gigs;

-- Step 2: Rename foreign key columns in related tables
-- Messages table: task_id -> gig_id
ALTER TABLE IF EXISTS public.messages 
  RENAME COLUMN task_id TO gig_id;

-- Earnings table: task_id -> gig_id  
ALTER TABLE IF EXISTS public.earnings 
  RENAME COLUMN task_id TO gig_id;

-- Parent approvals table: task_id -> gig_id
ALTER TABLE IF EXISTS public.parent_approvals 
  RENAME COLUMN task_id TO gig_id;

-- Step 3: Drop old foreign key constraints and recreate with new names
-- Messages table foreign key
ALTER TABLE IF EXISTS public.messages 
  DROP CONSTRAINT IF EXISTS messages_task_id_fkey;

ALTER TABLE IF EXISTS public.messages 
  ADD CONSTRAINT messages_gig_id_fkey 
  FOREIGN KEY (gig_id) REFERENCES public.gigs(id) ON DELETE CASCADE;

-- Earnings table foreign key
ALTER TABLE IF EXISTS public.earnings 
  DROP CONSTRAINT IF EXISTS earnings_task_id_fkey;

ALTER TABLE IF EXISTS public.earnings 
  ADD CONSTRAINT earnings_gig_id_fkey 
  FOREIGN KEY (gig_id) REFERENCES public.gigs(id) ON DELETE CASCADE;

-- Parent approvals table foreign key
ALTER TABLE IF EXISTS public.parent_approvals 
  DROP CONSTRAINT IF EXISTS parent_approvals_task_id_fkey;

ALTER TABLE IF EXISTS public.parent_approvals 
  ADD CONSTRAINT parent_approvals_gig_id_fkey 
  FOREIGN KEY (gig_id) REFERENCES public.gigs(id) ON DELETE CASCADE;

-- Step 4: Rename indexes
DROP INDEX IF EXISTS idx_tasks_poster_id;
CREATE INDEX IF NOT EXISTS idx_gigs_poster_id ON public.gigs(poster_id);

DROP INDEX IF EXISTS idx_tasks_teen_id;
CREATE INDEX IF NOT EXISTS idx_gigs_teen_id ON public.gigs(teen_id);

DROP INDEX IF EXISTS idx_tasks_status;
CREATE INDEX IF NOT EXISTS idx_gigs_status ON public.gigs(status);

DROP INDEX IF EXISTS idx_tasks_created_at;
CREATE INDEX IF NOT EXISTS idx_gigs_created_at ON public.gigs(created_at DESC);

DROP INDEX IF EXISTS idx_messages_task_id;
CREATE INDEX IF NOT EXISTS idx_messages_gig_id ON public.messages(gig_id);

DROP INDEX IF EXISTS idx_parent_approvals_task_id;
CREATE INDEX IF NOT EXISTS idx_parent_approvals_gig_id ON public.parent_approvals(gig_id);

-- Step 5: Rename triggers
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.gigs;
CREATE TRIGGER update_gigs_updated_at BEFORE UPDATE ON public.gigs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_task_accepted_create_approval ON public.gigs;
CREATE TRIGGER on_gig_accepted_create_approval
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status = 'open')
  EXECUTE FUNCTION create_parent_approval();

DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.gigs;
CREATE TRIGGER on_gig_completed_create_earnings
  AFTER UPDATE OF status ON public.gigs
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION create_earnings_on_completion();

-- Step 6: Update RLS policies (drop old, create new)
-- Drop old policies
DROP POLICY IF EXISTS "Anyone can read open tasks" ON public.gigs;
DROP POLICY IF EXISTS "Posters can create tasks" ON public.gigs;
DROP POLICY IF EXISTS "Posters can update own tasks" ON public.gigs;
DROP POLICY IF EXISTS "Teens can update accepted tasks" ON public.gigs;

-- Create new policies with updated names
CREATE POLICY "Anyone can read open gigs" ON public.gigs
  FOR SELECT USING (status = 'open' OR poster_id = auth.uid() OR teen_id = auth.uid());

CREATE POLICY "Posters can create gigs" ON public.gigs
  FOR INSERT WITH CHECK (poster_id = auth.uid());

CREATE POLICY "Posters can update own gigs" ON public.gigs
  FOR UPDATE USING (poster_id = auth.uid());

CREATE POLICY "Teens can update accepted gigs" ON public.gigs
  FOR UPDATE USING (teen_id = auth.uid() AND status IN ('accepted', 'in_progress', 'completed'));

-- Update messages policies to reference gigs
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    gig_id IN (
      SELECT id FROM public.gigs 
      WHERE poster_id = auth.uid() OR teen_id = auth.uid()
    )
  );

-- Update parent approvals policies
DROP POLICY IF EXISTS "Parents can update approvals" ON public.parent_approvals;
CREATE POLICY "Parents can update approvals" ON public.parent_approvals
  FOR UPDATE USING (parent_id = auth.uid());

-- Step 7: Update user profile policies to reference gigs
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT poster_id FROM public.gigs WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.gigs WHERE poster_id = auth.uid()
      UNION
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
      UNION
      SELECT parent_id FROM public.users WHERE id = auth.uid()
      UNION
      SELECT id FROM public.users WHERE parent_id = auth.uid()
    )
  );

-- Step 8: Ensure RLS is enabled on the renamed table
ALTER TABLE IF EXISTS public.gigs ENABLE ROW LEVEL SECURITY;

-- Step 9: Update functions that reference tasks
-- Update create_earnings_on_completion function
CREATE OR REPLACE FUNCTION create_earnings_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When gig is marked as completed, create earnings record
  IF NEW.status = 'completed' AND NEW.teen_id IS NOT NULL THEN
    INSERT INTO public.earnings (teen_id, gig_id, amount, status)
    VALUES (NEW.teen_id, NEW.id, NEW.pay, 'pending')
    ON CONFLICT (teen_id, gig_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update create_parent_approval function if it exists
CREATE OR REPLACE FUNCTION create_parent_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When gig is accepted, create parent approval request
  IF NEW.status = 'accepted' AND NEW.teen_id IS NOT NULL THEN
    INSERT INTO public.parent_approvals (teen_id, gig_id, parent_id, status)
    SELECT 
      NEW.teen_id,
      NEW.id,
      u.parent_id,
      'pending'
    FROM public.users u
    WHERE u.id = NEW.teen_id AND u.parent_id IS NOT NULL
    ON CONFLICT (teen_id, gig_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;























