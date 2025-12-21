import { useQuery } from '@tanstack/react-query';
import { 
  getEarningsSummary, 
  getEarningsHistory,
  getNeighborSpendingSummary,
  getNeighborSpendingHistory 
} from '@/lib/api/earnings';

// Query keys
export const earningsKeys = {
  all: ['earnings'] as const,
  summary: (filters?: any) => [...earningsKeys.all, 'summary', filters] as const,
  history: (filters?: { status?: string }) => [...earningsKeys.all, 'history', filters] as const,
};

export const neighborSpendingKeys = {
  all: ['neighborSpending'] as const,
  summary: (filters?: any) => [...neighborSpendingKeys.all, 'summary', filters] as const,
  history: (filters?: any) => [...neighborSpendingKeys.all, 'history', filters] as const,
};

// Get earnings summary (for teens)
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

// Get earnings history (for teens)
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

// Get spending summary (for neighbors)
export function useNeighborSpendingSummary(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: neighborSpendingKeys.summary(filters),
    queryFn: () => getNeighborSpendingSummary(filters),
    staleTime: 60000, // 1 minute
  });
}

// Get spending history (for neighbors)
export function useNeighborSpendingHistory(filters?: {
  status?: 'pending' | 'paid' | 'cancelled';
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: neighborSpendingKeys.history(filters),
    queryFn: () => getNeighborSpendingHistory(filters),
    staleTime: 30000,
  });
}

