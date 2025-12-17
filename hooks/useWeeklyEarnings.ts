import { useQuery } from '@tanstack/react-query';
import { getWeeklyEarnings, WeeklyEarningsData } from '@/lib/api/earnings';

export const weeklyEarningsKeys = {
  all: ['weeklyEarnings'] as const,
  data: () => [...weeklyEarningsKeys.all, 'data'] as const,
};

export function useWeeklyEarnings() {
  return useQuery<WeeklyEarningsData>({
    queryKey: weeklyEarningsKeys.data(),
    queryFn: getWeeklyEarnings,
    staleTime: 60000, // 1 minute
  });
}

