import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUserTasks } from '@/hooks/useTasks';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';

export function NeighborRecentActivity() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [activeTab, setActiveTab] = useState<'completed' | 'accepted'>('completed');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get all gigs
  const { data: allGigs = [], isLoading } = useUserTasks({
    role: 'poster',
  });

  const completedGigs = allGigs
    .filter(gig => gig.status === 'completed')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const acceptedGigs = allGigs
    .filter(gig => gig.status === 'accepted')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const displayedGigs = activeTab === 'completed' ? completedGigs : acceptedGigs;

  const handleViewAll = () => {
    router.push('/(tabs)/tasks');
  };

  const handleGigPress = (gigId: string) => {
    setSelectedTaskId(gigId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;

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
          style={[styles.tab, activeTab === 'completed' && styles.tabActive, isDark && activeTab !== 'completed' && styles.tabDark]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive, isDark && activeTab !== 'completed' && styles.tabTextDark]}>
            Completed
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'accepted' && styles.tabActive, isDark && activeTab !== 'accepted' && styles.tabDark]}
          onPress={() => setActiveTab('accepted')}
        >
          <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive, isDark && activeTab !== 'accepted' && styles.tabTextDark]}>
            Accepted
          </Text>
        </Pressable>
      </View>

      {displayedGigs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name={activeTab === 'completed' ? 'checkmark-circle-outline' : 'person-add-outline'}
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>
            No {activeTab === 'completed' ? 'completed' : 'accepted'} gigs yet
          </Text>
        </View>
      ) : (
        <View style={styles.activitiesList}>
          {displayedGigs.map((gig) => (
            <Pressable
              key={gig.id}
              style={[
                styles.activityItem, 
                cardStyle,
                activeTab === 'completed' && styles.activityItemNoBorder
              ]}
              onPress={() => handleGigPress(gig.id)}
              android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
            >
              <View style={styles.timelineLeft}>
                <Ionicons
                  name={activeTab === 'completed' ? 'checkmark-circle' : 'person-add'}
                  size={24}
                  color={activeTab === 'completed' ? '#73af17' : '#F97316'}
                />
                {gig !== displayedGigs[displayedGigs.length - 1] && (
                  <View style={[styles.timelineLine, isDark && styles.timelineLineDark]} />
                )}
              </View>
              <View style={styles.activityContent}>
                <Text style={[styles.activityTitle, titleStyle]} numberOfLines={1}>
                  {gig.title}
                </Text>
                <Text style={[styles.activityDescription, textStyle]}>
                  {activeTab === 'completed' 
                    ? `Completed for $${gig.pay.toFixed(2)}`
                    : `Accepted by a teenlancer`}
                </Text>
                <Text style={[styles.activityTime, textStyle]}>
                  {formatTimeAgo(gig.updated_at)}
                </Text>
              </View>
            </Pressable>
          ))}
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
    marginBottom: 16,
    paddingVertical: 8,
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
    paddingHorizontal: 16,
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
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    backgroundColor: '#73af17',
  },
  tabDark: {
    backgroundColor: '#111827',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextDark: {
    color: '#D1D5DB',
  },
  activitiesList: {
    paddingHorizontal: 16,
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
  cardDark: {
    backgroundColor: 'transparent',
    borderColor: '#1F2937',
  },
  activityItemNoBorder: {
    borderWidth: 0,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
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
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  activityDescription: {
    fontSize: 14,
    marginBottom: 4,
    color: '#6B7280',
  },
  activityTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  textDark: {
    color: '#D1D5DB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    color: '#6B7280',
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});














