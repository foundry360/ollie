import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { Activity } from '@/lib/api/activity';
import { BottomSheet } from '@/components/ui/BottomSheet';

interface CompletedGigsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CompletedGigsModal({ visible, onClose }: CompletedGigsModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: activities = [], isLoading } = useRecentActivity(100);

  // Filter for completed gig activities only
  const completedGigs = activities.filter(a => a.type === 'task_completed');

  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Completed Gigs">
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, textStyle]}>Loading completed gigs...</Text>
          </View>
        ) : completedGigs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <Text style={[styles.emptyText, titleStyle]}>No completed gigs yet</Text>
            <Text style={[styles.emptySubtext, textStyle]}>
              Completed gigs will appear here after you finish and mark gigs as complete
            </Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {completedGigs.map((activity, index) => {
              const isLast = index === completedGigs.length - 1;

              return (
                <View key={activity.id} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <Ionicons name="checkmark-circle" size={20} color="#73af17" />
                    {!isLast && <View style={[styles.line, { backgroundColor: '#73af17', opacity: 0.3 }]} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <View style={styles.activityHeader}>
                      <Text style={[styles.activityTitle, titleStyle]}>{activity.title}</Text>
                    </View>
                    <Text style={[styles.activityDescription, textStyle]} numberOfLines={2}>
                      {activity.description}
                    </Text>
                    <Text style={[styles.activityTime, textStyle]}>
                      {formatTimeAgo(activity.timestamp)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 600,
  },
  timeline: {
    paddingLeft: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 8,
    width: 24,
  },
  line: {
    width: 2,
    height: 60,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  activityDescription: {
    fontSize: 13,
    marginBottom: 4,
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  activityTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    color: '#000000',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
  },
});











