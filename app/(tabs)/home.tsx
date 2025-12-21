import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTeenStats } from '@/hooks/useTeenStats';
import { useNeighborStats } from '@/hooks/useNeighborStats';
import { useWeeklyEarnings } from '@/hooks/useWeeklyEarnings';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useActiveTask, useUserTasks } from '@/hooks/useTasks';
import { useUpcomingTasks } from '@/hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import { HomeHeader } from '@/components/home/HomeHeader';
import { NeighborHeader } from '@/components/home/NeighborHeader';
import { ActiveTaskCard } from '@/components/home/ActiveTaskCard';
import { WeeklyEarnings } from '@/components/home/WeeklyEarnings';
import { TasksNearYou } from '@/components/home/TasksNearYou';
import { UpcomingTasks } from '@/components/home/UpcomingTasks';
import { RecentActivity } from '@/components/home/RecentActivity';
import { NeighborActiveGigs } from '@/components/home/NeighborActiveGigs';
import { NeighborUpcomingScheduledGigs } from '@/components/home/NeighborUpcomingScheduledGigs';
import { NeighborRecentActivity } from '@/components/home/NeighborRecentActivity';
import { TipsCarousel } from '@/components/home/TipsCarousel';
import { Loading } from '@/components/ui/Loading';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/home.tsx:22',message:'HomeScreen mount',data:{isTeen:user?.role === 'teen'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [user?.role]);
  // #endregion

  // Check user role
  const isTeen = user?.role === 'teen';
  const isNeighbor = user?.role === 'poster';

  // Fetch data for teen home screen
  const { data: teenStats, isLoading: teenStatsLoading, refetch: refetchTeenStats } = useTeenStats();
  const { data: weeklyEarnings, isLoading: earningsLoading, refetch: refetchEarnings } = useWeeklyEarnings();
  const { data: activities, isLoading: activitiesLoading, refetch: refetchActivities } = useRecentActivity(5);
  const { data: activeTask, isLoading: activeTaskLoading, refetch: refetchActiveTask } = useActiveTask();
  const { data: upcomingTasks, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingTasks();

  // Fetch data for neighbor home screen
  const { data: neighborStats, isLoading: neighborStatsLoading, refetch: refetchNeighborStats } = useNeighborStats();
  const { data: neighborGigs, isLoading: neighborGigsLoading, refetch: refetchNeighborGigs } = useUserTasks({
    role: 'poster',
  });

  const teenIsLoading = teenStatsLoading || earningsLoading || activitiesLoading || activeTaskLoading || upcomingLoading;
  const neighborIsLoading = neighborStatsLoading || neighborGigsLoading;

  const handleTeenRefresh = useCallback(() => {
    refetchTeenStats();
    refetchEarnings();
    refetchActivities();
    refetchActiveTask();
    refetchUpcoming();
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['earnings'] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }, [refetchTeenStats, refetchEarnings, refetchActivities, refetchActiveTask, refetchUpcoming, queryClient]);

  const handleNeighborRefresh = useCallback(() => {
    refetchNeighborStats();
    refetchNeighborGigs();
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }, [refetchNeighborStats, refetchNeighborGigs, queryClient]);

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;

  // Show neighbor home screen
  if (isNeighbor) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={neighborIsLoading}
              onRefresh={handleNeighborRefresh}
              tintColor="#73af17"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {neighborIsLoading && !neighborStats ? (
            <Loading />
          ) : (
            <>
              <NeighborHeader />
              <NeighborActiveGigs />
              <NeighborUpcomingScheduledGigs />
              <NeighborRecentActivity />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show teen home screen (or error if neither teen nor neighbor)
  if (!isTeen) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Home screen is only available for teens and neighbors
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={teenIsLoading}
            onRefresh={handleTeenRefresh}
            tintColor="#73af17"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {teenIsLoading && !teenStats && !weeklyEarnings ? (
          <Loading />
        ) : (
          <>
            <HomeHeader />
            <ActiveTaskCard />
            <WeeklyEarnings />
            <TasksNearYou />
            <RecentActivity />
            <UpcomingTasks />
            <TipsCarousel />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
  },
  errorTextDark: {
    color: '#D1D5DB',
  },
});





