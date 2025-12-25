import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOpenTasks,
  getTaskById,
  getUserTasks,
  createTask,
  updateTask,
  acceptTask,
  startTask,
  completeTask,
  cancelTask,
  deleteTask,
  getActiveTask,
  getUpcomingTasks,
  getTasksNearUser,
  saveGig,
  unsaveGig,
  isGigSaved,
  getSavedGigs,
  CreateTaskData,
  UpdateTaskData,
  type UpcomingTask,
  type TaskWithDistance,
} from '@/lib/api/tasks';
import { Task, TaskStatus } from '@/types';
import { teenStatsKeys } from '@/hooks/useTeenStats';
import { activityKeys } from '@/hooks/useRecentActivity';

// Query keys
export const taskKeys = {
  all: ['tasks'] as const,
  open: () => [...taskKeys.all, 'open'] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
  user: (filters?: { status?: TaskStatus; role?: 'poster' | 'teen' }) =>
    [...taskKeys.all, 'user', filters] as const,
};

// Get open tasks (for browsing)
export function useOpenTasks(filters?: {
  minPay?: number;
  maxPay?: number;
  skills?: string[];
  radius?: number;
  userLocation?: { latitude: number; longitude: number };
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: [...taskKeys.open(), filters],
    queryFn: () => getOpenTasks(filters),
    staleTime: 30000, // 30 seconds
  });
}

// Get task by ID
export function useTask(taskId: string) {
  return useQuery({
    queryKey: taskKeys.detail(taskId),
    queryFn: () => getTaskById(taskId),
    enabled: !!taskId,
  });
}

// Get user's tasks
export function useUserTasks(filters?: {
  status?: TaskStatus;
  role?: 'poster' | 'teen';
}) {
  return useQuery({
    queryKey: taskKeys.user(filters),
    queryFn: () => getUserTasks(filters),
    staleTime: 30000,
  });
}

// Create task mutation
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaskData) => createTask(data),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: taskKeys.open() });
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
    },
  });
}

// Update task mutation
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskData }) =>
      updateTask(taskId, data),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(taskKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: taskKeys.open() });
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
    },
  });
}

// Accept task mutation
export function useAcceptTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => acceptTask(taskId),
    onSuccess: (data) => {
      // Update cache
      queryClient.setQueryData(taskKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: taskKeys.open() });
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
      queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
    },
  });
}

// Start task mutation
export function useStartTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => startTask(taskId),
    onSuccess: (data) => {
      queryClient.setQueryData(taskKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
      queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
    },
  });
}

// Complete task mutation
export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => completeTask(taskId),
    onSuccess: (data) => {
      queryClient.setQueryData(taskKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: activityKeys.all });
    },
  });
}

// Cancel task mutation
export function useCancelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => cancelTask(taskId),
    onSuccess: (data) => {
      queryClient.setQueryData(taskKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: taskKeys.open() });
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
      queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
    },
  });
}

// Delete task mutation
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      // Invalidate all task-related queries
      queryClient.invalidateQueries({ queryKey: taskKeys.open() });
      queryClient.invalidateQueries({ queryKey: taskKeys.user() });
      queryClient.invalidateQueries({ queryKey: ['gigApplications'] });
      queryClient.invalidateQueries({ queryKey: ['savedGigs'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Get active task (in progress)
export function useActiveTask() {
  return useQuery({
    queryKey: [...taskKeys.user(), 'active'],
    queryFn: getActiveTask,
    staleTime: 30000,
  });
}

// Get upcoming tasks (accepted but not started)
export function useUpcomingTasks() {
  return useQuery<UpcomingTask[]>({
    queryKey: [...taskKeys.user(), 'upcoming'],
    queryFn: getUpcomingTasks,
    staleTime: 30000,
  });
}

// Get tasks near user
export function useTasksNearUser(
  userLocation: { latitude: number; longitude: number } | null,
  limit: number = 10
) {
  return useQuery<TaskWithDistance[]>({
    queryKey: [...taskKeys.open(), 'nearUser', userLocation, limit],
    queryFn: () => userLocation ? getTasksNearUser(userLocation, limit) : Promise.resolve([]),
    enabled: !!userLocation,
    staleTime: 60000,
  });
}

// Check if a gig is saved
export function useIsGigSaved(gigId: string | null) {
  return useQuery<boolean>({
    queryKey: [...taskKeys.detail(gigId || ''), 'saved'],
    queryFn: () => isGigSaved(gigId!),
    enabled: !!gigId,
    staleTime: 30000,
  });
}

// Save gig mutation
export function useSaveGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gigId: string) => saveGig(gigId),
    onSuccess: (_, gigId) => {
      queryClient.invalidateQueries({ queryKey: [...taskKeys.detail(gigId), 'saved'] });
      queryClient.invalidateQueries({ queryKey: ['savedGigs'] });
    },
  });
}

// Unsave gig mutation
export function useUnsaveGig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gigId: string) => unsaveGig(gigId),
    onSuccess: (_, gigId) => {
      queryClient.invalidateQueries({ queryKey: [...taskKeys.detail(gigId), 'saved'] });
      queryClient.invalidateQueries({ queryKey: ['savedGigs'] });
    },
  });
}

// Get saved gigs for the current user
export function useSavedGigs() {
  return useQuery<Task[]>({
    queryKey: ['savedGigs'],
    queryFn: getSavedGigs,
    staleTime: 30000, // 30 seconds
  });
}
