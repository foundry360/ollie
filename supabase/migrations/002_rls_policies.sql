-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_approvals ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can read profiles of users they interact with (for tasks, messages)
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    id IN (
      SELECT poster_id FROM public.tasks WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.tasks WHERE poster_id = auth.uid()
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

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tasks table policies
-- Anyone can read open tasks
CREATE POLICY "Anyone can read open tasks" ON public.tasks
  FOR SELECT USING (status = 'open' OR poster_id = auth.uid() OR teen_id = auth.uid());

-- Posters can create tasks
CREATE POLICY "Posters can create tasks" ON public.tasks
  FOR INSERT WITH CHECK (poster_id = auth.uid());

-- Posters can update their own tasks
CREATE POLICY "Posters can update own tasks" ON public.tasks
  FOR UPDATE USING (poster_id = auth.uid());

-- Teens can update tasks they've accepted (status changes)
CREATE POLICY "Teens can update accepted tasks" ON public.tasks
  FOR UPDATE USING (teen_id = auth.uid() AND status IN ('accepted', 'in_progress', 'completed'));

-- Messages table policies
-- Users can read messages they sent or received
CREATE POLICY "Users can read own messages" ON public.messages
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can send messages for tasks they're involved in
CREATE POLICY "Users can send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    task_id IN (
      SELECT id FROM public.tasks 
      WHERE poster_id = auth.uid() OR teen_id = auth.uid()
    )
  );

-- Users can update read status of messages they received
CREATE POLICY "Users can update received messages" ON public.messages
  FOR UPDATE USING (recipient_id = auth.uid());

-- Earnings table policies
-- Teens can read their own earnings
CREATE POLICY "Teens can read own earnings" ON public.earnings
  FOR SELECT USING (teen_id = auth.uid());

-- System can create earnings (via service role or function)
-- Note: In production, use a service role function for this
CREATE POLICY "System can create earnings" ON public.earnings
  FOR INSERT WITH CHECK (true); -- Restrict this in production with service role

-- Earnings updates should be restricted (only via admin/service role)
-- For now, allow teens to see but not modify

-- Parent approvals table policies
-- Parents can read approvals for their teens
CREATE POLICY "Parents can read own approvals" ON public.parent_approvals
  FOR SELECT USING (
    parent_id = auth.uid() OR
    teen_id IN (SELECT id FROM public.users WHERE parent_id = auth.uid())
  );

-- Teens can read their own approval requests
CREATE POLICY "Teens can read own approvals" ON public.parent_approvals
  FOR SELECT USING (teen_id = auth.uid());

-- System can create approval requests (when teen accepts task)
-- Parents can update approval status
CREATE POLICY "Parents can update approvals" ON public.parent_approvals
  FOR UPDATE USING (parent_id = auth.uid());

-- Function to create parent approval when teen accepts task
CREATE OR REPLACE FUNCTION create_parent_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If teen accepts a task and has a parent, create approval request
  IF NEW.teen_id IS NOT NULL AND NEW.status = 'accepted' THEN
    INSERT INTO public.parent_approvals (teen_id, task_id, parent_id, status)
    SELECT NEW.teen_id, NEW.id, parent_id, 'pending'
    FROM public.users
    WHERE id = NEW.teen_id AND parent_id IS NOT NULL
    ON CONFLICT (teen_id, task_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create parent approval
DROP TRIGGER IF EXISTS on_task_accepted_create_approval ON public.tasks;
CREATE TRIGGER on_task_accepted_create_approval
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
  EXECUTE FUNCTION create_parent_approval();

-- Function to create earnings when task is completed
CREATE OR REPLACE FUNCTION create_earnings_on_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- When task is marked as completed, create earnings record
  IF NEW.status = 'completed' AND NEW.teen_id IS NOT NULL THEN
    INSERT INTO public.earnings (teen_id, task_id, amount, status)
    VALUES (NEW.teen_id, NEW.id, NEW.pay, 'pending')
    ON CONFLICT (teen_id, task_id) DO UPDATE
    SET amount = NEW.pay, status = 'pending', updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create earnings
DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.tasks;
CREATE TRIGGER on_task_completed_create_earnings
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL)
  EXECUTE FUNCTION create_earnings_on_completion();

