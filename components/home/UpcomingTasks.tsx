import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useUpcomingTasks } from '@/hooks/useTasks';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useState } from 'react';

export function UpcomingTasks() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: upcomingTasks = [], isLoading } = useUpcomingTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Upcoming Gigs</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
      </View>
    );
  }

  // Show empty state if no upcoming tasks
  if (upcomingTasks.length === 0) {
    const containerStyle = isDark ? styles.containerDark : styles.containerLight;
    const titleStyle = isDark ? styles.titleDark : styles.sectionTitle;
    const textStyle = isDark ? styles.textDark : styles.textLight;
    const emptyCardStyle = isDark ? styles.emptyCardDark : styles.emptyCardLight;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <Text style={[styles.sectionTitle, titleStyle]}>Upcoming Gigs</Text>
        <View style={[styles.emptyContainer, emptyCardStyle]}>
          <Ionicons name="time-outline" size={48} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.emptyText, textStyle]}>No upcoming gigs</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            Gigs waiting for approval or scheduled for later will appear here
          </Text>
        </View>
      </View>
    );
  }

  const handleTaskPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const getApprovalBadgeStyle = (status?: string) => {
    if (status === 'approved') return styles.badgeApproved;
    if (status === 'rejected') return styles.badgeRejected;
    return styles.badgePending;
  };

  const getApprovalText = (status?: string) => {
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.sectionTitle, titleStyle]}>Upcoming Gigs</Text>
      {upcomingTasks.map((task) => {
        // Use scheduled_date if available, otherwise fall back to created_at
        const dateToUse = task.scheduled_date || task.created_at;
        const taskDate = new Date(dateToUse);
        const dateStr = format(taskDate, 'MMM d');
        
        return (
          <Pressable
            key={task.id}
            style={[styles.taskItem, cardStyle]}
            onPress={() => handleTaskPress(task.id)}
            android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
          >
            {task.parent_approval_status && (
              <View style={styles.taskHeader}>
                <View style={getApprovalBadgeStyle(task.parent_approval_status)}>
                  <Text style={styles.approvalText}>
                    {getApprovalText(task.parent_approval_status)}
                  </Text>
                </View>
              </View>
            )}
            <Text style={[styles.taskTitle, titleStyle]} numberOfLines={2}>
              {task.title}
            </Text>
            <View style={styles.taskDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="location" size={14} color="#73af17" />
                <Text style={[styles.detailText, textStyle]} numberOfLines={1}>
                  {task.address.split(',')[0]}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cash" size={14} color="#73af17" />
                <Text style={[styles.detailText, textStyle]}>
                  ${task.pay.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.dateBadge, isDark && styles.dateBadgeDark]}>
                <Text style={[styles.dateText, isDark && styles.dateTextDark]}>
                  {dateStr}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
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
    backgroundColor: '#111827',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingTop: 8,
    marginBottom: 12,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  taskItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderColor: '#1F2937',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto',
    flexShrink: 0,
  },
  dateBadgeDark: {
    backgroundColor: '#7C2D12',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F97316',
  },
  dateTextDark: {
    color: '#FB923C',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeApproved: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approvalText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  taskDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  emptyCardLight: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  emptyCardDark: {
    borderColor: '#374151',
    backgroundColor: 'transparent',
  },
});
















