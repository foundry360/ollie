import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTeenStats } from '@/hooks/useTeenStats';
import { useWeeklyEarnings } from '@/hooks/useWeeklyEarnings';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useActiveTask } from '@/hooks/useTasks';
import { useUpcomingTasks } from '@/hooks/useTasks';
import { useQueryClient } from '@tanstack/react-query';
import { HomeHeader } from '@/components/home/HomeHeader';
import { ActiveTaskCard } from '@/components/home/ActiveTaskCard';
import { WeeklyEarnings } from '@/components/home/WeeklyEarnings';
import { TasksNearYou } from '@/components/home/TasksNearYou';
import { UpcomingTasks } from '@/components/home/UpcomingTasks';
import { RecentActivity } from '@/components/home/RecentActivity';
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

  // Check if user is a teen - if not, show different screen (or redirect)
  const isTeen = user?.role === 'teen';

  // Fetch all data for teen home screen
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useTeenStats();
  const { data: weeklyEarnings, isLoading: earningsLoading, refetch: refetchEarnings } = useWeeklyEarnings();
  const { data: activities, isLoading: activitiesLoading, refetch: refetchActivities } = useRecentActivity(5);
  const { data: activeTask, isLoading: activeTaskLoading, refetch: refetchActiveTask } = useActiveTask();
  const { data: upcomingTasks, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingTasks();

  const isLoading = statsLoading || earningsLoading || activitiesLoading || activeTaskLoading || upcomingLoading;

  const handleRefresh = useCallback(() => {
    refetchStats();
    refetchEarnings();
    refetchActivities();
    refetchActiveTask();
    refetchUpcoming();
    // Invalidate all related queries
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['earnings'] });
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  }, [refetchStats, refetchEarnings, refetchActivities, refetchActiveTask, refetchUpcoming, queryClient]);

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;

  // If not a teen, show a message or redirect (for now, show message)
  if (!isTeen) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Home screen is only available for teens
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
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#73af17"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {isLoading && !stats && !weeklyEarnings ? (
          <Loading />
        ) : (
          <>
            <HomeHeader />
            <ActiveTaskCard />
            <WeeklyEarnings />
            <TasksNearYou />
            <UpcomingTasks />
            <RecentActivity />
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
