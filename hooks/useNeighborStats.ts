import { useQuery } from '@tanstack/react-query';
import { getNeighborStats, NeighborStats } from '@/lib/api/users';

export const neighborStatsKeys = {
  all: ['neighborStats'] as const,
  stats: () => [...neighborStatsKeys.all, 'stats'] as const,
};

export function useNeighborStats() {
  return useQuery<NeighborStats>({
    queryKey: neighborStatsKeys.stats(),
    queryFn: getNeighborStats,
    staleTime: 30000, // 30 seconds
    refetchOnMount: true,
  });
}



