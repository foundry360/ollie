import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getGigApplications,
  getPendingApplicationsForNeighbor,
  getTeenApplications,
  hasAppliedForGig,
  approveGigApplication,
  rejectGigApplication,
  getGigApplicationCounts,
  type GigApplication,
} from '@/lib/api/gigApplications';

// Query keys
export const gigApplicationKeys = {
  all: ['gigApplications'] as const,
  gig: (gigId: string) => [...gigApplicationKeys.all, 'gig', gigId] as const,
  neighbor: () => [...gigApplicationKeys.all, 'neighbor'] as const,
  teen: () => [...gigApplicationKeys.all, 'teen'] as const,
  hasApplied: (gigId: string) => [...gigApplicationKeys.all, 'hasApplied', gigId] as const,
};

// Get applications for a specific gig
export function useGigApplications(gigId: string | null) {
  return useQuery<GigApplication[]>({
    queryKey: gigApplicationKeys.gig(gigId || ''),
    queryFn: () => getGigApplications(gigId!),
    enabled: !!gigId,
    staleTime: 30000, // 30 seconds
  });
}

// Get pending applications for neighbor
export function usePendingApplicationsForNeighbor() {
  return useQuery<GigApplication[]>({
    queryKey: gigApplicationKeys.neighbor(),
    queryFn: getPendingApplicationsForNeighbor,
    staleTime: 30000,
  });
}

// Get applications for current teen
export function useTeenApplications() {
  return useQuery<GigApplication[]>({
    queryKey: gigApplicationKeys.teen(),
    queryFn: getTeenApplications,
    staleTime: 30000,
  });
}

// Check if teen has applied for a gig
export function useHasAppliedForGig(gigId: string | null) {
  return useQuery<boolean>({
    queryKey: gigApplicationKeys.hasApplied(gigId || ''),
    queryFn: () => hasAppliedForGig(gigId!),
    enabled: !!gigId,
    staleTime: 30000,
  });
}

// Approve application mutation
export function useApproveGigApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (applicationId: string) => approveGigApplication(applicationId),
    onSuccess: (_, applicationId) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: gigApplicationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

// Reject application mutation
export function useRejectGigApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) =>
      rejectGigApplication(applicationId, reason),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: gigApplicationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['gigs'] });
    },
  });
}

// Get application counts for multiple gigs
export function useGigApplicationCounts(gigIds: string[]) {
  return useQuery<Map<string, number>>({
    queryKey: [...gigApplicationKeys.all, 'counts', gigIds.sort().join(',')],
    queryFn: () => getGigApplicationCounts(gigIds),
    enabled: gigIds.length > 0,
    staleTime: 30000, // 30 seconds
  });
}











