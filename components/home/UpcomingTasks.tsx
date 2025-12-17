import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUpcomingTasks } from '@/hooks/useTasks';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

export function UpcomingTasks() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: upcomingTasks = [], isLoading } = useUpcomingTasks();

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Upcoming Gigs</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
      </View>
    );
  }

  if (upcomingTasks.length === 0) {
    return null; // Don't show section if no upcoming tasks
  }

  const handleTaskPress = (taskId: string) => {
    router.push(`/tasks/${taskId}`);
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
        const taskDate = new Date(task.created_at);
        const dateStr = format(taskDate, 'MMM d');
        
        return (
          <Pressable
            key={task.id}
            style={[styles.taskItem, cardStyle]}
            onPress={() => handleTaskPress(task.id)}
            android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
          >
            <View style={styles.taskHeader}>
              <View style={[styles.dateBadge, isDark && styles.dateBadgeDark]}>
                <Text style={[styles.dateText, isDark && styles.dateTextDark]}>
                  {dateStr}
                </Text>
              </View>
              {task.parent_approval_status && (
                <View style={getApprovalBadgeStyle(task.parent_approval_status)}>
                  <Text style={styles.approvalText}>
                    {getApprovalText(task.parent_approval_status)}
                  </Text>
                </View>
              )}
            </View>
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
            </View>
          </Pressable>
        );
      })}
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
  sectionTitle: {
    fontSize: 18,
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
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dateBadgeDark: {
    backgroundColor: '#1E3A8A',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  dateTextDark: {
    color: '#93C5FD',
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
});

