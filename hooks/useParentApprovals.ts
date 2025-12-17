import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getParentApprovals,
  getPendingApprovals,
  approveTask,
  rejectTask,
} from '@/lib/api/parentApprovals';

// Query keys
export const parentApprovalKeys = {
  all: ['parent-approvals'] as const,
  list: () => [...parentApprovalKeys.all, 'list'] as const,
  pending: () => [...parentApprovalKeys.all, 'pending'] as const,
};

// Get all parent approvals
export function useParentApprovals() {
  return useQuery({
    queryKey: parentApprovalKeys.list(),
    queryFn: getParentApprovals,
    staleTime: 30000,
  });
}

// Get pending approvals
export function usePendingApprovals() {
  return useQuery({
    queryKey: parentApprovalKeys.pending(),
    queryFn: getPendingApprovals,
    staleTime: 30000,
  });
}

// Approve task mutation
export function useApproveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalId: string) => approveTask(approvalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentApprovalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// Reject task mutation
export function useRejectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ approvalId, reason }: { approvalId: string; reason?: string }) =>
      rejectTask(approvalId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentApprovalKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

