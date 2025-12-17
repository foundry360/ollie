-- Fix: Drop all triggers before recreating them
-- This migration fixes the "trigger already exists" error

-- Drop all update triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
DROP TRIGGER IF EXISTS update_earnings_updated_at ON public.earnings;
DROP TRIGGER IF EXISTS update_parent_approvals_updated_at ON public.parent_approvals;

-- Drop all function triggers
DROP TRIGGER IF EXISTS on_task_accepted_create_approval ON public.tasks;
DROP TRIGGER IF EXISTS on_task_completed_create_earnings ON public.tasks;

-- Recreate update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_earnings_updated_at BEFORE UPDATE ON public.earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_parent_approvals_updated_at BEFORE UPDATE ON public.parent_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Recreate function triggers
-- Note: These will only work if the corresponding functions exist
-- If you get errors, make sure create_parent_approval() and create_earnings_on_completion() functions exist
CREATE TRIGGER on_task_accepted_create_approval
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status != 'accepted')
  EXECUTE FUNCTION create_parent_approval();

CREATE TRIGGER on_task_completed_create_earnings
  AFTER UPDATE OF status ON public.tasks
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.teen_id IS NOT NULL)
  EXECUTE FUNCTION create_earnings_on_completion();

