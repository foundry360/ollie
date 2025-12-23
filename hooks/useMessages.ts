import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
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
export function useTaskMessages(taskId: string, recipientId?: string) {
  const stableRecipientId = useMemo(() => recipientId || 'all', [recipientId]);
  const queryKey = useMemo(() => [...messageKeys.task(taskId), stableRecipientId], [taskId, stableRecipientId]);
  
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      return getTaskMessages(taskId, stableRecipientId === 'all' ? undefined : stableRecipientId);
    },
    enabled: !!taskId,
    staleTime: Infinity, // Never consider stale - Realtime will handle updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false, // No polling - Realtime only
  });
  
  return query;
}

// Get conversations
export function useConversations() {
  return useQuery({
    queryKey: messageKeys.conversations(),
    queryFn: getConversations,
    staleTime: Infinity, // Never consider stale - Realtime will handle updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false, // No polling - Realtime only
  });
}

// Create message mutation
export function useCreateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMessageData) => {
      return createMessage(data);
    },
    onSuccess: (newMessage, variables) => {
      // Update the messages cache optimistically
      const stableRecipientId = variables.recipient_id || 'all';
      const queryKey = [...messageKeys.task(variables.gig_id), stableRecipientId];
      
      queryClient.setQueryData(queryKey, (oldData: Message[] | undefined) => {
        if (!oldData) return [newMessage];
        // Check if message already exists
        if (oldData.some(msg => msg.id === newMessage.id)) return oldData;
        // Add new message and sort by created_at
        return [...oldData, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      
      // Invalidate conversations list
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
      // Only invalidate conversations, not messages (prevents refetch)
      queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
    },
  });
}
