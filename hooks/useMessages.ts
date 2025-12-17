import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTaskMessages,
  getConversations,
  createMessage,
  markMessagesAsRead,
  CreateMessageData,
} from '@/lib/api/messages';
import { Message } from '@/types';

// Query keys
export const messageKeys = {
  all: ['messages'] as const,
  task: (taskId: string) => [...messageKeys.all, 'task', taskId] as const,
  conversations: () => [...messageKeys.all, 'conversations'] as const,
};

// Get messages for a task
export function useTaskMessages(taskId: string) {
  return useQuery({
    queryKey: messageKeys.task(taskId),
    queryFn: () => getTaskMessages(taskId),
    enabled: !!taskId,
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });
}

// Get conversations
export function useConversations() {
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: getConversations,
    staleTime: 30000,
  });
}

// Create message mutation
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageData) => createMessage(data),
    onSuccess: (data) => {
      // Invalidate task messages
      queryClient.invalidateQueries({ queryKey: messageKeys.task(data.task_id) });
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

// Mark messages as read mutation
export function useMarkMessagesAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, senderId }: { taskId: string; senderId: string }) =>
      markMessagesAsRead(taskId, senderId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: messageKeys.task(variables.taskId) });
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}

