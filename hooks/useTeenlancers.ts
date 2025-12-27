import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  favoriteTeenlancer,
  unfavoriteTeenlancer,
  isTeenlancerFavorited,
  getFavoritedTeenlancers,
  getPastTeenlancers,
} from '@/lib/api/users';

// Check if a teenlancer is favorited
export function useIsTeenlancerFavorited(teenId: string | null) {
  return useQuery<boolean>({
    queryKey: ['teenlancer', teenId, 'favorited'],
    queryFn: () => isTeenlancerFavorited(teenId!),
    enabled: !!teenId,
    staleTime: 0, // Always refetch to get latest status
    refetchOnMount: true,
  });
}

// Favorite teenlancer mutation
export function useFavoriteTeenlancer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teenId: string) => favoriteTeenlancer(teenId),
    onMutate: async (teenId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teenlancer', teenId, 'favorited'] });
      
      // Snapshot the previous value
      const previousValue = queryClient.getQueryData<boolean>(['teenlancer', teenId, 'favorited']);
      
      // Optimistically update to true
      queryClient.setQueryData<boolean>(['teenlancer', teenId, 'favorited'], true);
      
      return { previousValue };
    },
    onSuccess: async (_, teenId) => {
      // Refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ['teenlancer', teenId, 'favorited'] });
      // Invalidate and refetch lists
      queryClient.invalidateQueries({ queryKey: ['favoritedTeenlancers'] });
      queryClient.invalidateQueries({ queryKey: ['pastTeenlancers'] });
      // Force refetch
      await queryClient.refetchQueries({ queryKey: ['favoritedTeenlancers'] });
      await queryClient.refetchQueries({ queryKey: ['pastTeenlancers'] });
    },
    onError: (error, teenId, context) => {
      // Rollback to previous value on error
      if (context?.previousValue !== undefined) {
        queryClient.setQueryData<boolean>(['teenlancer', teenId, 'favorited'], context.previousValue);
      }
      console.error('Error favoriting teenlancer:', error);
    },
  });
}

// Unfavorite teenlancer mutation
export function useUnfavoriteTeenlancer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teenId: string) => unfavoriteTeenlancer(teenId),
    onMutate: async (teenId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teenlancer', teenId, 'favorited'] });
      
      // Snapshot the previous value
      const previousValue = queryClient.getQueryData<boolean>(['teenlancer', teenId, 'favorited']);
      
      // Optimistically update to false
      queryClient.setQueryData<boolean>(['teenlancer', teenId, 'favorited'], false);
      
      return { previousValue };
    },
    onSuccess: async (_, teenId) => {
      // Refetch to ensure we have the latest data
      await queryClient.refetchQueries({ queryKey: ['teenlancer', teenId, 'favorited'] });
      // Invalidate and refetch lists
      queryClient.invalidateQueries({ queryKey: ['favoritedTeenlancers'] });
      queryClient.invalidateQueries({ queryKey: ['pastTeenlancers'] });
      // Force refetch
      await queryClient.refetchQueries({ queryKey: ['favoritedTeenlancers'] });
      await queryClient.refetchQueries({ queryKey: ['pastTeenlancers'] });
    },
    onError: (error, teenId, context) => {
      // Rollback to previous value on error
      if (context?.previousValue !== undefined) {
        queryClient.setQueryData<boolean>(['teenlancer', teenId, 'favorited'], context.previousValue);
      }
      console.error('Error unfavoriting teenlancer:', error);
    },
  });
}

// Get favorited teenlancers
export function useFavoritedTeenlancers() {
  return useQuery({
    queryKey: ['favoritedTeenlancers'],
    queryFn: getFavoritedTeenlancers,
    staleTime: 0, // Always refetch to get latest favorites
    refetchOnMount: true,
  });
}

// Get past teenlancers
export function usePastTeenlancers() {
  return useQuery({
    queryKey: ['pastTeenlancers'],
    queryFn: getPastTeenlancers,
    staleTime: 0, // Always refetch to get latest past teenlancers
    refetchOnMount: true,
  });
}

