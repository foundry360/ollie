import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { Activity, ActivityType } from '@/lib/api/activity';
import { useState } from 'react';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';

export function RecentActivity() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: activities = [], isLoading } = useRecentActivity(10);
  const [activeTab, setActiveTab] = useState<'completed' | 'payments'>('payments');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleViewAll = () => {
    // Navigate to activity history screen (to be created)
    router.push('/activity');
  };

  const handleGigPress = (gigId: string | undefined) => {
    if (gigId) {
      setSelectedTaskId(gigId);
      setShowDetailModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const getActivityIcon = (type: ActivityType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'task_completed':
        return 'checkmark-circle';
      case 'payment_received':
        return 'cash';
      default:
        return 'notifications';
    }
  };

  const getActivityColor = (type: ActivityType): string => {
    switch (type) {
      case 'task_completed':
        return '#73af17';
      case 'payment_received':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;

  // Filter activities by type - only show completed gigs and payments
  const completedGigs = activities.filter(a => a.type === 'task_completed').slice(0, 5);
  const payments = activities.filter(a => a.type === 'payment_received').slice(0, 5);
  const displayedActivities = activeTab === 'completed' ? completedGigs : payments;

  if (isLoading) {
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={[styles.sectionTitle, titleStyle]}>Recent Activity</Text>
        <Text style={[styles.loadingText, textStyle]}>Loading activity...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, titleStyle]}>Recent Activity</Text>
        <Pressable onPress={handleViewAll}>
          <Text style={styles.viewAllText}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'payments' && styles.tabActive, isDark && activeTab !== 'payments' && styles.tabDark]}
          onPress={() => setActiveTab('payments')}
        >
          <Text style={[styles.tabText, activeTab === 'payments' && styles.tabTextActive, isDark && activeTab !== 'payments' && styles.tabTextDark]}>
            Payments
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'completed' && styles.tabActive, isDark && activeTab !== 'completed' && styles.tabDark]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive, isDark && activeTab !== 'completed' && styles.tabTextDark]}>
            Completed Gigs
          </Text>
        </Pressable>
      </View>

      {displayedActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={activeTab === 'completed' ? 'checkmark-circle-outline' : 'cash-outline'}
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>
            {activeTab === 'completed' ? 'No completed gigs yet' : 'No payments yet'}
          </Text>
        </View>
      ) : (
        <View style={activeTab === 'completed' ? styles.activitiesList : styles.timeline}>
          {displayedActivities.map((activity, index) => {
            const color = getActivityColor(activity.type);
            const isLast = index === displayedActivities.length - 1;
            const cardStyle = isDark ? styles.cardDark : styles.cardLight;

            // For completed gigs, use card layout like neighbor
            if (activeTab === 'completed' && activity.type === 'task_completed') {
              return (
                <Pressable
                  key={activity.id}
                  style={[styles.activityItem, cardStyle, styles.activityItemNoBorder]}
                  onPress={() => handleGigPress(activity.gig_id)}
                  android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
                >
                  <View style={styles.timelineLeft}>
                    <Ionicons name="checkmark-circle" size={24} color={color} />
                    {activity !== displayedActivities[displayedActivities.length - 1] && (
                      <View style={[styles.timelineLine, isDark && styles.timelineLineDark]} />
                    )}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={[styles.activityTitle, titleStyle]} numberOfLines={1}>
                      {activity.title}
                    </Text>
                    <Text style={[styles.activityDescription, textStyle]}>
                      {activity.description}
                    </Text>
                    <Text style={[styles.activityTime, textStyle]}>
                      {formatTimeAgo(activity.timestamp)}
                    </Text>
                  </View>
                </Pressable>
              );
            }

            // For payments, keep timeline layout
            return (
              <View key={activity.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  {activity.type === 'task_completed' ? (
                    <Ionicons name="checkmark-circle" size={16} color={color} />
                  ) : (
                    <View style={[styles.timelineDot, { backgroundColor: color }]} />
                  )}
                  {!isLast && <View style={styles.line} />}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.activityHeader}>
                    {activity.type !== 'task_completed' && (
                      <Ionicons name={getActivityIcon(activity.type)} size={16} color={color} />
                    )}
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
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  tabDark: {
    backgroundColor: '#1F2937',
  },
  tabActive: {
    backgroundColor: '#73af17',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#FFFFFF',
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
    marginRight: 12,
    width: 24,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  line: {
    width: 3,
    backgroundColor: '#73af17',
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
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  activitiesList: {
    paddingHorizontal: 0,
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  activityItemNoBorder: {
    borderWidth: 0,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  timelineLine: {
    position: 'absolute',
    top: 32,
    width: 2,
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  timelineLineDark: {
    backgroundColor: '#374151',
  },
  activityContent: {
    flex: 1,
  },
});






