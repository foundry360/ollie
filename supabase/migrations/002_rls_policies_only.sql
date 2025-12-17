-- Row Level Security Policies
-- Run this after creating the tables

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_teen_signups ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read related profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can read open tasks" ON public.tasks;
DROP POLICY IF EXISTS "Posters can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Posters can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Teens can update accepted tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;
DROP POLICY IF EXISTS "Teens can read own earnings" ON public.earnings;
DROP POLICY IF EXISTS "System can create earnings" ON public.earnings;
DROP POLICY IF EXISTS "Parents can read own approvals" ON public.parent_approvals;
DROP POLICY IF EXISTS "Teens can read own approvals" ON public.parent_approvals;
DROP POLICY IF EXISTS "Parents can update approvals" ON public.parent_approvals;
DROP POLICY IF EXISTS "Anyone can create pending signup" ON public.pending_teen_signups;
DROP POLICY IF EXISTS "Can read pending signup by parent email" ON public.pending_teen_signups;
DROP POLICY IF EXISTS "Can update pending signup by token" ON public.pending_teen_signups;

-- Users table policies
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can read profiles of users they interact with (for tasks, messages)
-- Note: Parent/child relationships removed to avoid infinite recursion
CREATE POLICY "Users can read related profiles" ON public.users
  FOR SELECT USING (
    -- Allow reading profiles of users involved in tasks
    id IN (
      SELECT poster_id FROM public.tasks WHERE teen_id = auth.uid()
      UNION
      SELECT teen_id FROM public.tasks WHERE poster_id = auth.uid()
    )
    OR
    -- Allow reading profiles of users in message threads
    id IN (
      SELECT sender_id FROM public.messages WHERE recipient_id = auth.uid()
      UNION
      SELECT recipient_id FROM public.messages WHERE sender_id = auth.uid()
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

-- Parents can update approval status
CREATE POLICY "Parents can update approvals" ON public.parent_approvals
  FOR UPDATE USING (parent_id = auth.uid());

-- Pending teen signups table policies
-- Allow public insert (for signup requests)
CREATE POLICY "Anyone can create pending signup" ON public.pending_teen_signups
  FOR INSERT WITH CHECK (true);

-- Allow reading by parent email (for checking status)
-- Note: In production, you may want to restrict this further
CREATE POLICY "Can read pending signup by parent email" ON public.pending_teen_signups
  FOR SELECT USING (true); -- Allow reading for status checks

-- Allow updating by token (for approval/rejection)
CREATE POLICY "Can update pending signup by token" ON public.pending_teen_signups
  FOR UPDATE USING (true); -- Token is validated in application logic

