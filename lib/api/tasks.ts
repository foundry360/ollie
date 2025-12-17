import { supabase } from '@/lib/supabase';
import { Task, TaskStatus } from '@/types';

export interface CreateTaskData {
  title: string;
  description: string;
  pay: number;
  location: { latitude: number; longitude: number };
  address: string;
  required_skills?: string[];
  estimated_hours?: number;
  photos?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  pay?: number;
  status?: TaskStatus;
  location?: { latitude: number; longitude: number };
  address?: string;
  required_skills?: string[];
  estimated_hours?: number;
  photos?: string[];
}

// Create a new task
export async function createTask(data: CreateTaskData): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      ...data,
      poster_id: user.id,
      status: 'open',
    })
    .select()
    .single();

  if (error) throw error;
  return task;
}

// Get all open tasks (for browsing)
export async function getOpenTasks(filters?: {
  minPay?: number;
  maxPay?: number;
  skills?: string[];
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (filters?.minPay !== undefined) {
    query = query.gte('pay', filters.minPay);
  }
  if (filters?.maxPay !== undefined) {
    query = query.lte('pay', filters.maxPay);
  }
  if (filters?.skills && filters.skills.length > 0) {
    query = query.contains('required_skills', filters.skills);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Get task by ID
export async function getTaskById(taskId: string): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;
  return data;
}

// Get completed tasks for a teen (for calculating ratings/reviews on public profile)
export async function getTeenCompletedTasks(teenId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('teen_id', teenId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get tasks for current user (as poster or teen)
export async function getUserTasks(filters?: {
  status?: TaskStatus;
  role?: 'poster' | 'teen';
}): Promise<Task[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  let query = supabase
    .from('tasks')
    .select('*');

  if (filters?.role === 'poster') {
    query = query.eq('poster_id', user.id);
  } else if (filters?.role === 'teen') {
    query = query.eq('teen_id', user.id);
  } else {
    query = query.or(`poster_id.eq.${user.id},teen_id.eq.${user.id}`);
  }

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  query = query.order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Update task
export async function updateTask(taskId: string, data: UpdateTaskData): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if user owns the task or is the assigned teen
  const { data: task } = await supabase
    .from('tasks')
    .select('poster_id, teen_id')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.poster_id !== user.id && task.teen_id !== user.id) {
    throw new Error('Unauthorized to update this task');
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update(data)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updatedTask;
}

// Accept a task (teen)
export async function acceptTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Check if user is a teen
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teen') {
    throw new Error('Only teens can accept tasks');
  }

  // Check if task is open
  const { data: task } = await supabase
    .from('tasks')
    .select('status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.status !== 'open') {
    throw new Error('Task is not available');
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({
      teen_id: user.id,
      status: 'accepted',
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updatedTask;
}

// Start a task (teen)
export async function startTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task } = await supabase
    .from('tasks')
    .select('teen_id, status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.teen_id !== user.id) {
    throw new Error('Unauthorized to start this task');
  }
  if (task.status !== 'accepted') {
    throw new Error('Task must be accepted before starting');
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({ status: 'in_progress' })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updatedTask;
}

// Complete a task (teen)
export async function completeTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task } = await supabase
    .from('tasks')
    .select('teen_id, status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.teen_id !== user.id) {
    throw new Error('Unauthorized to complete this task');
  }
  if (task.status !== 'in_progress') {
    throw new Error('Task must be in progress before completing');
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({ status: 'completed' })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updatedTask;
}

// Cancel a task (poster or teen)
export async function cancelTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task } = await supabase
    .from('tasks')
    .select('poster_id, teen_id, status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.poster_id !== user.id && task.teen_id !== user.id) {
    throw new Error('Unauthorized to cancel this task');
  }

  const { data: updatedTask, error } = await supabase
    .from('tasks')
    .update({ status: 'cancelled' })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return updatedTask;
}

// Delete a task (poster only, if not accepted)
export async function deleteTask(taskId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task } = await supabase
    .from('tasks')
    .select('poster_id, status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.poster_id !== user.id) {
    throw new Error('Unauthorized to delete this task');
  }
  if (task.status !== 'open') {
    throw new Error('Cannot delete a task that has been accepted');
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}

// Get active task (in progress) for a teen
export async function getActiveTask(): Promise<Task | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('teen_id', user.id)
    .eq('status', 'in_progress')
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Get upcoming tasks (accepted but not started) for a teen
export interface UpcomingTask extends Task {
  parent_approval_status?: 'pending' | 'approved' | 'rejected';
  scheduled_date?: string;
}

export async function getUpcomingTasks(): Promise<UpcomingTask[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('teen_id', user.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true });

  if (tasksError) throw tasksError;

  // Get parent approval status for each task
  const taskIds = tasks?.map(t => t.id) || [];
  if (taskIds.length === 0) return [];

  const { data: approvals, error: approvalsError } = await supabase
    .from('parent_approvals')
    .select('task_id, status')
    .in('task_id', taskIds)
    .eq('teen_id', user.id);

  if (approvalsError) throw approvalsError;

  const approvalMap = new Map(
    (approvals || []).map(a => [a.task_id, a.status])
  );

  return (tasks || []).map(task => ({
    ...task,
    parent_approval_status: approvalMap.get(task.id),
  }));
}

// Get tasks near user location
export interface TaskWithDistance extends Task {
  distance: number; // in miles
}

export async function getTasksNearUser(
  userLocation: { latitude: number; longitude: number },
  limit: number = 10
): Promise<TaskWithDistance[]> {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Get more to filter by distance

  if (error) throw error;

  // Calculate distance for each task and filter/sort
  const tasksWithDistance: TaskWithDistance[] = (tasks || [])
    .map(task => {
      const taskLocation = task.location as { latitude: number; longitude: number };
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );
      return { ...task, distance };
    })
    .filter(task => task.distance <= 25) // Within 25 miles
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return tasksWithDistance;
}

