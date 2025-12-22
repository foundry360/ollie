import { useQuery } from '@tanstack/react-query';
import { getTeenStats, TeenStats } from '@/lib/api/users';

export const teenStatsKeys = {
  all: ['teenStats'] as const,
  stats: () => [...teenStatsKeys.all, 'stats'] as const,
};

export function useTeenStats() {
  return useQuery<TeenStats>({
    queryKey: teenStatsKeys.stats(),
    queryFn: getTeenStats,
    staleTime: 0, // Always consider data stale to ensure fresh data
    gcTime: 0, // Don't cache - always fetch fresh
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}








