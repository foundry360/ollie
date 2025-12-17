-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for location data (if available, otherwise we'll use JSONB)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

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

-- Parent approvals table
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

