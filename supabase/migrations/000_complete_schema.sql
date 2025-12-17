-- Complete Database Schema for Ollie
-- Run this in your Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teen', 'poster', 'parent', 'admin')),
  phone TEXT,
  date_of_birth DATE,
  bio TEXT,
  profile_photo_url TEXT,
  parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  parent_email TEXT,
  skills TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT FALSE,
  expo_push_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  pay DECIMAL(10, 2) NOT NULL CHECK (pay >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'in_progress', 'completed', 'cancelled')),
  poster_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teen_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  location JSONB NOT NULL, -- {latitude: number, longitude: number}
  address TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  estimated_hours DECIMAL(4, 2),
  photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Earnings table (tracks completed tasks and payments)
CREATE TABLE IF NOT EXISTS public.earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teen_id, task_id)
);

-- Parent approvals table (for task approvals)
CREATE TABLE IF NOT EXISTS public.parent_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teen_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT, -- Optional reason for rejection
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teen_id, task_id)
);

-- Pending teen signups table
-- Stores signup data before parent approval
-- Email and password are nullable since they're set when account is created after approval
CREATE TABLE IF NOT EXISTS public.pending_teen_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  parent_email TEXT NOT NULL,
  approval_token TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  parent_ip_address TEXT -- Optional: for security logging
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON public.users(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_poster_id ON public.tasks(poster_id);
CREATE INDEX IF NOT EXISTS idx_tasks_teen_id ON public.tasks(teen_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_task_id ON public.messages(task_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_teen_id ON public.earnings(teen_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON public.earnings(status);
CREATE INDEX IF NOT EXISTS idx_parent_approvals_teen_id ON public.parent_approvals(teen_id);
CREATE INDEX IF NOT EXISTS idx_parent_approvals_parent_id ON public.parent_approvals(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_approvals_task_id ON public.parent_approvals(task_id);
CREATE INDEX IF NOT EXISTS idx_parent_approvals_status ON public.parent_approvals(status);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_token ON public.pending_teen_signups(approval_token);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_status ON public.pending_teen_signups(status);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_parent_email ON public.pending_teen_signups(parent_email);
CREATE INDEX IF NOT EXISTS idx_pending_teen_signups_created_at ON public.pending_teen_signups(created_at DESC);

-- Note: Email and password are collected after approval, not stored in pending table

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_earnings_updated_at ON public.earnings;
CREATE TRIGGER update_earnings_updated_at BEFORE UPDATE ON public.earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_parent_approvals_updated_at ON public.parent_approvals;
CREATE TRIGGER update_parent_approvals_updated_at BEFORE UPDATE ON public.parent_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically expire old pending signups
CREATE OR REPLACE FUNCTION expire_old_pending_signups()
RETURNS void AS $$
BEGIN
  UPDATE public.pending_teen_signups
  SET status = 'expired'
  WHERE status = 'pending'
    AND token_expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

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

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_teen_signups ENABLE ROW LEVEL SECURITY;

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

