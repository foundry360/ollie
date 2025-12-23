import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  needsParentApprovalForStripe,
  getStripeAccountApprovalStatus,
  requestStripeAccountApproval,
  getStripeAccountApprovalsForParent,
  getPendingStripeAccountApprovals,
  approveStripeAccount,
  rejectStripeAccount,
} from '@/lib/api/stripeAccountApprovals';

// Query keys
export const stripeAccountApprovalKeys = {
  all: ['stripe-account-approvals'] as const,
  status: () => [...stripeAccountApprovalKeys.all, 'status'] as const,
  needsApproval: () => [...stripeAccountApprovalKeys.all, 'needs-approval'] as const,
  parentList: () => [...stripeAccountApprovalKeys.all, 'parent-list'] as const,
  parentPending: () => [...stripeAccountApprovalKeys.all, 'parent-pending'] as const,
};

// Check if parent approval is needed
export function useNeedsParentApprovalForStripe() {
  return useQuery({
    queryKey: stripeAccountApprovalKeys.needsApproval(),
    queryFn: needsParentApprovalForStripe,
    staleTime: 60000, // Cache for 1 minute
  });
}

// Get Stripe account approval status for current user (teen)
export function useStripeAccountApprovalStatus() {
  return useQuery({
    queryKey: stripeAccountApprovalKeys.status(),
    queryFn: getStripeAccountApprovalStatus,
    staleTime: 30000, // Cache for 30 seconds
  });
}

// Request parent approval mutation
export function useRequestStripeAccountApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: requestStripeAccountApproval,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripeAccountApprovalKeys.status() });
      queryClient.invalidateQueries({ queryKey: stripeAccountApprovalKeys.parentPending() });
    },
  });
}

// Get all Stripe account approvals for a parent
export function useStripeAccountApprovalsForParent() {
  return useQuery({
    queryKey: stripeAccountApprovalKeys.parentList(),
    queryFn: getStripeAccountApprovalsForParent,
    staleTime: 30000,
  });
}

// Get pending Stripe account approvals for a parent
export function usePendingStripeAccountApprovals() {
  return useQuery({
    queryKey: stripeAccountApprovalKeys.parentPending(),
    queryFn: getPendingStripeAccountApprovals,
    staleTime: 30000,
  });
}

// Approve Stripe account mutation
export function useApproveStripeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approvalId: string) => approveStripeAccount(approvalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripeAccountApprovalKeys.all });
    },
  });
}

// Reject Stripe account mutation
export function useRejectStripeAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ approvalId, reason }: { approvalId: string; reason?: string }) =>
      rejectStripeAccount(approvalId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stripeAccountApprovalKeys.all });
    },
  });
}

