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
    staleTime: 30000, // 30 seconds - shorter to ensure updates show quickly
    refetchOnMount: true,
  });
}






