import { useQuery } from '@tanstack/react-query';
import { getFeaturedTeenlancers, FeaturedTeenlancer } from '@/lib/api/users';

export const featuredTeenlancersKeys = {
  all: ['featuredTeenlancers'] as const,
  list: (location?: { latitude: number; longitude: number }) => 
    [...featuredTeenlancersKeys.all, 'list', location] as const,
};

export function useFeaturedTeenlancers(
  limit: number = 10,
  neighborLocation?: { latitude: number; longitude: number }
) {
  return useQuery<FeaturedTeenlancer[]>({
    queryKey: [...featuredTeenlancersKeys.list(neighborLocation), limit],
    queryFn: () => getFeaturedTeenlancers(limit, neighborLocation),
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Always enabled - will show all if no location, filtered if location available
  });
}

