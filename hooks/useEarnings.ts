import { useQuery } from '@tanstack/react-query';
import { getEarningsSummary, getEarningsHistory } from '@/lib/api/earnings';

// Query keys
export const earningsKeys = {
  all: ['earnings'] as const,
  summary: (filters?: { startDate?: string; endDate?: string }) => [...earningsKeys.all, 'summary', filters] as const,
  history: (filters?: { status?: string; startDate?: string; endDate?: string }) => [...earningsKeys.all, 'history', filters] as const,
};

// Get earnings summary
export function useEarningsSummary(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: earningsKeys.summary(filters),
    queryFn: () => getEarningsSummary(filters),
    staleTime: 60000, // 1 minute
  });
}

// Get earnings history
export function useEarningsHistory(filters?: {
  status?: 'pending' | 'paid' | 'cancelled';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: earningsKeys.history(filters),
    queryFn: () => getEarningsHistory(filters),
    staleTime: 30000,
  });
}

