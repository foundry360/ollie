import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useQueryClient } from '@tanstack/react-query';
import { getNeighborStats, getFeaturedTeenlancers } from '@/lib/api/users';
import { getTeenStats } from '@/lib/api/users';
import { getUserTasks, getActiveTask, getUpcomingTasks } from '@/lib/api/tasks';
import { getWeeklyEarnings } from '@/lib/api/earnings';
import { getRecentActivity } from '@/lib/api/activity';
import { getPendingCompletionApprovals } from '@/lib/api/completionApprovals';
import { neighborStatsKeys } from '@/hooks/useNeighborStats';
import { teenStatsKeys } from '@/hooks/useTeenStats';
import { taskKeys } from '@/hooks/useTasks';
import { activityKeys } from '@/hooks/useRecentActivity';
import { weeklyEarningsKeys } from '@/hooks/useWeeklyEarnings';
import { featuredTeenlancersKeys } from '@/hooks/useFeaturedTeenlancers';

export default function LoadingScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  const pulseValue = useRef(new Animated.Value(0.7)).current;
  const fadeValue = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!user) {
      // If no user, redirect to login
      router.replace('/auth/login');
      return;
    }

    // Start pulsing animation - subtle fade in/out effect
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.7,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    // Prefetch and wait for data to be fully loaded based on user role
    const prefetchData = async () => {
      const startTime = Date.now();
      const minDisplayTime = 1500; // Minimum time to show animation (1.5 seconds)

      try {
        if (user.role === 'poster') {
          // Fetch neighbor data and wait for it to complete
          // Use ensureQueryData to wait for data to be fully loaded
          await Promise.all([
            queryClient.ensureQueryData({
              queryKey: neighborStatsKeys.stats(),
              queryFn: getNeighborStats,
              staleTime: 0, // Force fresh fetch
            }),
            queryClient.ensureQueryData({
              queryKey: taskKeys.user({ role: 'poster' }),
              queryFn: () => getUserTasks({ role: 'poster' }),
              staleTime: 0, // Force fresh fetch
            }),
            // Prefetch featured teenlancers (without location - will show all)
            queryClient.ensureQueryData({
              queryKey: featuredTeenlancersKeys.list(undefined),
              queryFn: () => getFeaturedTeenlancers(10, undefined),
              staleTime: 0,
            }),
            // Prefetch completion approvals
            queryClient.ensureQueryData({
              queryKey: ['pendingCompletionApprovals'],
              queryFn: getPendingCompletionApprovals,
              staleTime: 0,
            }),
          ]);

          // Verify data is actually in cache and in a success state
          let allLoaded = false;
          let retries = 0;
          while (retries < 10 && !allLoaded) {
            const statsState = queryClient.getQueryState(neighborStatsKeys.stats());
            const tasksState = queryClient.getQueryState(taskKeys.user({ role: 'poster' }));
            const featuredState = queryClient.getQueryState(featuredTeenlancersKeys.list(undefined));
            const approvalsState = queryClient.getQueryState(['pendingCompletionApprovals']);
            
            // Check if all critical queries are loaded
            allLoaded = (
              statsState?.status === 'success' &&
              tasksState?.status === 'success' &&
              featuredState?.status === 'success' &&
              !statsState?.isFetching &&
              !tasksState?.isFetching &&
              !featuredState?.isFetching
            );
            
            if (!allLoaded) {
              await new Promise(resolve => setTimeout(resolve, 100));
              retries++;
            }
          }
        } else if (user.role === 'teen') {
          // Fetch teen data and wait for it to complete
          await Promise.all([
            queryClient.ensureQueryData({
              queryKey: teenStatsKeys.stats(),
              queryFn: getTeenStats,
              staleTime: 0,
            }),
            queryClient.ensureQueryData({
              queryKey: taskKeys.user({ role: 'teen' }),
              queryFn: () => getUserTasks({ role: 'teen' }),
              staleTime: 0,
            }),
            queryClient.ensureQueryData({
              queryKey: weeklyEarningsKeys.data(),
              queryFn: getWeeklyEarnings,
              staleTime: 0,
            }),
            queryClient.ensureQueryData({
              queryKey: activityKeys.recent(5),
              queryFn: () => getRecentActivity(5),
              staleTime: 0,
            }),
            queryClient.ensureQueryData({
              queryKey: [...taskKeys.user(), 'active'],
              queryFn: getActiveTask,
              staleTime: 0,
            }),
            queryClient.ensureQueryData({
              queryKey: [...taskKeys.user(), 'upcoming'],
              queryFn: getUpcomingTasks,
              staleTime: 0,
            }),
          ]);

          // Verify data is actually in cache and in a success state
          let allLoaded = false;
          let retries = 0;
          while (retries < 10 && !allLoaded) {
            const statsState = queryClient.getQueryState(teenStatsKeys.stats());
            const tasksState = queryClient.getQueryState(taskKeys.user({ role: 'teen' }));
            const earningsState = queryClient.getQueryState(weeklyEarningsKeys.data());
            const activityState = queryClient.getQueryState(activityKeys.recent(5));
            const activeState = queryClient.getQueryState([...taskKeys.user(), 'active']);
            const upcomingState = queryClient.getQueryState([...taskKeys.user(), 'upcoming']);
            
            // Check if all critical queries are loaded
            allLoaded = (
              statsState?.status === 'success' &&
              tasksState?.status === 'success' &&
              earningsState?.status === 'success' &&
              activityState?.status === 'success' &&
              !statsState?.isFetching &&
              !tasksState?.isFetching &&
              !earningsState?.isFetching &&
              !activityState?.isFetching
            );
            
            if (!allLoaded) {
              await new Promise(resolve => setTimeout(resolve, 100));
              retries++;
            }
          }
        }
      } catch (error) {
        console.error('Error prefetching data:', error);
        // Continue even if prefetch fails - let home screen handle loading
      }

      // Ensure minimum display time
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

      // Add a small buffer to ensure React Query has updated its state
      await new Promise(resolve => setTimeout(resolve, 100));

      setTimeout(() => {
        // Fade out animation before navigating
        Animated.timing(fadeValue, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          router.replace('/(tabs)/home');
        });
      }, remainingTime);
    };

    prefetchData();

    return () => {
      pulseAnimation.stop();
    };
  }, [pulseValue, fadeValue, router, user, queryClient]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeValue,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: pulseValue,
            },
          ]}
        >
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827', // Dark blue-gray to match splash screen
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
});

