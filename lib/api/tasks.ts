import { supabase, getUserProfile } from '@/lib/supabase';
import { Task, TaskStatus } from '@/types';
import { calculateDistance } from '@/lib/utils';

// Upload gig photo to Supabase Storage (returns public URL)
export async function uploadGigPhoto(uri: string, gigId?: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    // If it's already a URL (from Supabase Storage), return it
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    // Generate unique filename
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = gigId 
      ? `gig-${gigId}-${timestamp}-${randomId}.${fileExt}`
      : `${user.id}-${timestamp}-${randomId}.${fileExt}`;
    const filePath = `gig-photos/${fileName}`;

    // For React Native, read file as ArrayBuffer
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Determine content type based on file extension
    const contentType = fileExt === 'png' ? 'image/png' : 
                       fileExt === 'webp' ? 'image/webp' : 
                       'image/jpeg';

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gig-photos')
      .upload(filePath, arrayBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // Provide helpful error message for RLS policy violation
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('violates') || (uploadError as any).statusCode === 403) {
        throw new Error(
          'Storage upload blocked by security policy. Please add storage policies to allow authenticated users to upload gig photos.'
        );
      }
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error(
          'Storage bucket not found. Please create a "gig-photos" bucket in Supabase Storage.'
        );
      }
      
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('gig-photos')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    return publicUrl;
  } catch (error: any) {
    console.error('Error uploading gig photo:', error);
    throw new Error(error.message || 'Failed to upload gig photo');
  }
}

// Upload multiple gig photos
export async function uploadGigPhotos(uris: string[], gigId?: string): Promise<string[]> {
  const uploadPromises = uris.map(uri => uploadGigPhoto(uri, gigId));
  return Promise.all(uploadPromises);
}

export interface CreateTaskData {
  title: string;
  description: string;
  pay: number;
  location: { latitude: number; longitude: number };
  address: string;
  required_skills?: string[];
  estimated_hours?: number;
  photos?: string[];
  scheduled_date?: string; // ISO date string (YYYY-MM-DD)
  scheduled_start_time?: string; // 24-hour format (HH:MM)
  scheduled_end_time?: string; // 24-hour format (HH:MM)
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
  scheduled_date?: string; // ISO date string (YYYY-MM-DD)
  scheduled_start_time?: string; // 24-hour format (HH:MM)
  scheduled_end_time?: string; // 24-hour format (HH:MM)
}

// Create a new task
export async function createTask(data: CreateTaskData): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Upload photos to Supabase Storage if provided
  let photoUrls: string[] | undefined;
  if (data.photos && data.photos.length > 0) {
    try {
      photoUrls = await uploadGigPhotos(data.photos);
    } catch (photoError: any) {
      console.error('Error uploading photos:', photoError);
      throw new Error(`Failed to upload photos: ${photoError.message}`);
    }
  }

  const { data: task, error } = await supabase
    .from('gigs')
    .insert({
      ...data,
      photos: photoUrls,
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
  radius?: number;
  userLocation?: { latitude: number; longitude: number };
  limit?: number;
  offset?: number;
}): Promise<Task[]> {
  let query = supabase
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .is('teen_id', null) // Only show unassigned gigs
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
  
  // If radius and userLocation are provided, we need to filter by distance
  // Since Postgres doesn't have built-in distance calculation, we'll fetch more
  // and filter client-side
  const fetchLimit = filters?.radius && filters?.userLocation 
    ? (filters.limit || 50) * 3 // Fetch more to account for distance filtering
    : filters?.limit || 50;
  
  if (fetchLimit) {
    query = query.limit(fetchLimit);
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (fetchLimit || 20) - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  
  let tasks = data || [];
  
  // Filter by radius if provided
  if (filters?.radius && filters?.userLocation) {
    tasks = tasks
      .map(task => {
        try {
          const taskLocation = task.location as { latitude: number; longitude: number };
          
          if (!taskLocation || typeof taskLocation.latitude !== 'number' || typeof taskLocation.longitude !== 'number') {
            return null;
          }
          
          const distance = calculateDistance(
            filters.userLocation!.latitude,
            filters.userLocation!.longitude,
            taskLocation.latitude,
            taskLocation.longitude
          );
          
          return { ...task, distance };
        } catch (error) {
          console.error('Error calculating distance for task:', task.id, error);
          return null;
        }
      })
      .filter((task): task is Task & { distance: number } => 
        task !== null && task.distance <= filters.radius!
      )
      .sort((a, b) => a.distance - b.distance)
      .slice(0, filters.limit || 50)
      .map(({ distance, ...task }) => task); // Remove distance property
  }
  
  return tasks;
}

// Save a gig (bookmark for teenlancer)
export async function saveGig(gigId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  // Get user profile to check role
  const profile = await getUserProfile(user.id);
  if (profile.role !== 'teen') throw new Error('Only teenlancers can save gigs');

  const { error } = await supabase
    .from('saved_gigs')
    .insert({
      teen_id: user.id,
      gig_id: gigId,
    });

  if (error) {
    // If it's a unique constraint violation, the gig is already saved (ignore)
    if (error.code === '23505') {
      return; // Already saved, no error
    }
    throw error;
  }
}

// Unsave a gig
export async function unsaveGig(gigId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  // Get user profile to check role
  const profile = await getUserProfile(user.id);
  if (profile.role !== 'teen') throw new Error('Only teenlancers can unsave gigs');

  const { error } = await supabase
    .from('saved_gigs')
    .delete()
    .eq('teen_id', user.id)
    .eq('gig_id', gigId);

  if (error) throw error;
}

// Check if a gig is saved by the current user
export async function isGigSaved(gigId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  // Get user profile to check role
  try {
    const profile = await getUserProfile(user.id);
    if (profile.role !== 'teen') return false;
  } catch {
    // If profile doesn't exist, user can't have saved gigs
    return false;
  }

  const { data, error } = await supabase
    .from('saved_gigs')
    .select('id')
    .eq('teen_id', user.id)
    .eq('gig_id', gigId)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

// Get saved gigs for the current user
export async function getSavedGigs(): Promise<Task[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  // Get user profile to check role
  const profile = await getUserProfile(user.id);
  if (profile.role !== 'teen') throw new Error('Only teenlancers can view saved gigs');

  const { data: savedGigs, error: savedError } = await supabase
    .from('saved_gigs')
    .select('gig_id')
    .eq('teen_id', user.id);

  if (savedError) throw savedError;

  if (!savedGigs || savedGigs.length === 0) {
    return [];
  }

  const gigIds = savedGigs.map(sg => sg.gig_id);

  const { data: gigs, error: gigsError } = await supabase
    .from('gigs')
    .select('*')
    .in('id', gigIds)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (gigsError) throw gigsError;

  return (gigs || []) as Task[];
}

// Get task by ID
export async function getTaskById(taskId: string): Promise<Task> {
  const { data, error } = await supabase
    .from('gigs')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) throw error;
  return data;
}

// Get completed tasks for a teen (for calculating ratings/reviews on public profile)
export async function getTeenCompletedTasks(teenId: string) {
  const { data, error } = await supabase
    .from('gigs')
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
    .from('gigs')
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
    .from('gigs')
    .select('poster_id, teen_id, photos')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.poster_id !== user.id && task.teen_id !== user.id) {
    throw new Error('Unauthorized to update this task');
  }

  // Handle photo uploads if photos are provided
  let photoUrls: string[] | undefined;
  if (data.photos !== undefined) {
    try {
      // Separate existing URLs from new local URIs
      const existingPhotos = data.photos.filter(uri => uri.startsWith('http://') || uri.startsWith('https://'));
      const newPhotos = data.photos.filter(uri => !uri.startsWith('http://') && !uri.startsWith('https://'));
      
      // Upload new photos
      const uploadedPhotos = newPhotos.length > 0 
        ? await uploadGigPhotos(newPhotos, taskId)
        : [];
      
      // Combine existing and newly uploaded photos
      photoUrls = [...existingPhotos, ...uploadedPhotos];
    } catch (photoError: any) {
      console.error('Error uploading photos:', photoError);
      throw new Error(`Failed to upload photos: ${photoError.message}`);
    }
  }

  // Prepare update data
  const updateData = { ...data };
  if (photoUrls !== undefined) {
    updateData.photos = photoUrls;
  }

  const { data: updatedTask, error } = await supabase
    .from('gigs')
    .update(updateData)
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

  // Attempt to accept the gig using the database function (bypasses RLS)
  const { data: acceptedGig, error: rpcError } = await supabase.rpc('accept_gig', {
    p_gig_id: taskId,
  });

  if (rpcError) {
    // Log the full error for debugging
    console.error('Accept gig RPC error:', rpcError);
    
    // If the error is a specific database exception (e.g., from RAISE EXCEPTION in the function)
    if (rpcError.message?.includes('Gig not found') || 
        rpcError.message?.includes('Gig is not available') ||
        rpcError.message?.includes('Only teens can accept gigs') ||
        rpcError.message?.includes('Failed to accept gig') ||
        rpcError.message?.includes('User not authenticated')) {
      throw new Error(rpcError.message);
    }
    
    // If function not found, provide helpful error message
    if (rpcError.message?.includes('could not find') || 
        rpcError.message?.includes('function') && rpcError.message?.includes('does not exist')) {
      throw new Error('Database function not found. Please ensure migration 022_allow_teens_to_accept_gigs.sql has been applied.');
    }
    
    throw rpcError; // Re-throw other RPC errors
  }

  if (!acceptedGig) {
    throw new Error('Failed to accept gig through database function. Unknown error.');
  }
  
  // The RPC function returns a table-like structure, so we need to ensure it matches our Task interface.
  // Supabase RPC functions that return TABLE typically return an array
  if (Array.isArray(acceptedGig) && acceptedGig.length > 0) {
    return acceptedGig[0] as Task;
  } else if (acceptedGig && typeof acceptedGig === 'object' && !Array.isArray(acceptedGig)) {
    // If it returns a single object directly (depends on Supabase RPC return types)
    return acceptedGig as Task;
  }
  
  throw new Error('Failed to accept gig. Invalid response from database function.');
}

// Start a task (teen)
export async function startTask(taskId: string): Promise<Task> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: task } = await supabase
    .from('gigs')
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
    .from('gigs')
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
    .from('gigs')
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
    .from('gigs')
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
    .from('gigs')
    .select('poster_id, teen_id, status')
    .eq('id', taskId)
    .single();

  if (!task) throw new Error('Task not found');
  if (task.poster_id !== user.id && task.teen_id !== user.id) {
    throw new Error('Unauthorized to cancel this task');
  }

  const { data: updatedTask, error } = await supabase
    .from('gigs')
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
    .from('gigs')
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
    .from('gigs')
    .delete()
    .eq('id', taskId);

  if (error) throw error;
}

// Get active task (in progress) for a teen
export async function getActiveTask(): Promise<Task | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('gigs')
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
    .from('gigs')
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
    .select('gig_id, status')
    .in('gig_id', taskIds)
    .eq('teen_id', user.id);

  if (approvalsError) throw approvalsError;

  const approvalMap = new Map(
    (approvals || []).map(a => [a.gig_id, a.status])
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
    .from('gigs')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Get more to filter by distance

  if (error) throw error;

  // Calculate distance for each task and filter/sort
  const tasksWithDistance: TaskWithDistance[] = (tasks || [])
    .map(task => {
      try {
        const taskLocation = task.location as { latitude: number; longitude: number };
        
        // Validate location data
        if (!taskLocation || typeof taskLocation.latitude !== 'number' || typeof taskLocation.longitude !== 'number') {
          console.warn('Invalid location data for task:', task.id);
          return null;
        }
        
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          taskLocation.latitude,
          taskLocation.longitude
        );
        return { ...task, distance };
      } catch (error) {
        console.error('Error calculating distance for task:', task.id, error);
        return null;
      }
    })
    .filter((task): task is TaskWithDistance => task !== null && task.distance <= 25) // Within 25 miles
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return tasksWithDistance;
}

