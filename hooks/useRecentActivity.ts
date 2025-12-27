import { useQuery } from '@tanstack/react-query';
import { getRecentActivity, Activity } from '@/lib/api/activity';

export const activityKeys = {
  all: ['activity'] as const,
  recent: (limit?: number) => [...activityKeys.all, 'recent', limit] as const,
};

export function useRecentActivity(limit: number = 5) {
  return useQuery<Activity[]>({
    queryKey: activityKeys.recent(limit),
    queryFn: () => getRecentActivity(limit),
    staleTime: 30000, // 30 seconds
    refetchOnMount: true,
  });
}





















