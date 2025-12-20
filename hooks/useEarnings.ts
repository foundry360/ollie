import { useQuery } from '@tanstack/react-query';
import { getEarningsSummary, getEarningsHistory } from '@/lib/api/earnings';

// Query keys
export const earningsKeys = {
  all: ['earnings'] as const,
  summary: () => [...earningsKeys.all, 'summary'] as const,
  history: (filters?: { status?: string }) => [...earningsKeys.all, 'history', filters] as const,
};

// Get earnings summary
export function useEarningsSummary() {
  return useQuery({
    queryKey: earningsKeys.summary(),
    queryFn: getEarningsSummary,
    staleTime: 60000, // 1 minute
  });
}

// Get earnings history
export function useEarningsHistory(filters?: {
  status?: 'pending' | 'paid' | 'cancelled';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: earningsKeys.history(filters),
    queryFn: () => getEarningsHistory(filters),
    staleTime: 30000,
  });
}

