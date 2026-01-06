import { View, Text, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUserTasks, useStartTask, useCompleteTask } from '@/hooks/useTasks';
import { Task } from '@/types';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUserProfileForChat } from '@/lib/api/users';
import { Button } from '@/components/ui/Button';
import { getRandomCompletionMessage } from '@/lib/utils';
import { SuccessAlert } from '@/components/ui/SuccessAlert';

// Helper to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export function TeenUpcomingScheduledGigs() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const startTaskMutation = useStartTask();
  const completeTaskMutation = useCompleteTask();

  // Get all gigs for teenlancer and filter for scheduled ones
  const { data: allGigs = [], isLoading } = useUserTasks({
    role: 'teen',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduledGigs = allGigs
    .filter(gig => {
      // Only show gigs that are assigned/accepted, confirmed, and scheduled
      if (!gig.scheduled_date) return false;
      // Must be assigned or accepted (or in_progress)
      if (!['assigned', 'accepted', 'in_progress'].includes(gig.status)) return false;
      // Must be confirmed (schedule_confirmed is true)
      if (!gig.schedule_confirmed) return false;
      // Must be in the future or today
      const scheduledDate = new Date(gig.scheduled_date);
      scheduledDate.setHours(0, 0, 0, 0);
      return scheduledDate >= today;
    })
    .sort((a, b) => {
      if (!a.scheduled_date || !b.scheduled_date) return 0;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    })
    .slice(0, 5);

  // Get unique neighbor IDs from scheduled gigs
  const neighborIds = useMemo(() => {
    return scheduledGigs
      .filter(gig => gig.poster_id)
      .map(gig => gig.poster_id!)
      .filter((id, index, self) => self.indexOf(id) === index); // Unique IDs
  }, [scheduledGigs]);

  // Fetch neighbor profiles
  const { data: neighborProfiles = [] } = useQuery({
    queryKey: ['neighborProfiles', neighborIds],
    queryFn: async () => {
      const profiles = await Promise.all(
        neighborIds.map(async (id) => {
          try {
            const profile = await getUserProfileForChat(id);
            return profile ? { id, profile } : null;
          } catch {
            return null;
          }
        })
      );
      return profiles.filter((p): p is { id: string; profile: any } => p !== null);
    },
    enabled: neighborIds.length > 0,
    staleTime: 300000, // 5 minutes
  });

  // Create a map of poster_id to profile
  const neighborProfileMap = useMemo(() => {
    const map = new Map<string, any>();
    neighborProfiles.forEach(({ id, profile }) => {
      map.set(id, profile);
    });
    return map;
  }, [neighborProfiles]);

  const handleGigPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const handleStart = async (taskId: string, taskTitle: string) => {
    try {
      await startTaskMutation.mutateAsync(taskId);
      Alert.alert('Success', `${taskTitle} started!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start task');
    }
  };

  const handleComplete = async (taskId: string, taskTitle: string) => {
    Alert.alert(
      'Complete Task',
      `Mark "${taskTitle}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await completeTaskMutation.mutateAsync(taskId);
              setSuccessMessage(getRandomCompletionMessage());
              setShowSuccessAlert(true);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to complete task');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Scheduled Gigs</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
      </View>
    );
  }

  // Show empty state if no scheduled gigs
  if (scheduledGigs.length === 0) {
    const containerStyle = isDark ? styles.containerDark : styles.containerLight;
    const titleStyle = isDark ? styles.titleDark : styles.sectionTitle;
    const textStyle = isDark ? styles.textDark : styles.detailText;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Scheduled Gigs</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.emptyText, textStyle]}>No scheduled gigs</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            Gigs with confirmed schedules will appear here
          </Text>
        </View>
      </View>
    );
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.gigTitle;
  const cardStyle = isDark ? styles.cardDark : styles.gigCard;
  const textStyle = isDark ? styles.textDark : styles.detailText;

  return (
    <>
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Scheduled Gigs</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        <View style={styles.gigsList}>
          {scheduledGigs.map((item) => {
            const scheduledDate = item.scheduled_date ? new Date(item.scheduled_date) : null;
            const dateStr = scheduledDate ? format(scheduledDate, 'MMM d') : '';
            const timeStr = item.scheduled_start_time && item.scheduled_end_time
              ? `${formatTime12Hour(item.scheduled_start_time)} - ${formatTime12Hour(item.scheduled_end_time)}`
              : '';

            const neighborProfile = item.poster_id ? neighborProfileMap.get(item.poster_id) : null;
            const canStart = item.status === 'assigned' || item.status === 'accepted';
            const canComplete = item.status === 'in_progress';

            return (
              <View
                key={item.id}
                style={[styles.gigCard, cardStyle]}
              >
                <Pressable
                  onPress={() => handleGigPress(item.id)}
                  style={styles.cardPressable}
                  android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
                >
                  <View style={styles.titleRow}>
                    <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.poster_id && (
                      <View style={styles.avatarContainer}>
                        {neighborProfile?.profile_photo_url ? (
                          <Image
                            source={{ uri: neighborProfile.profile_photo_url }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
                            <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  {timeStr && (
                    <View style={styles.timeRow}>
                      <Ionicons name="time" size={14} color="#73af17" />
                      <Text style={[styles.timeText, textStyle]}>{timeStr}</Text>
                    </View>
                  )}
                  <View style={styles.gigDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash" size={14} color="#73af17" />
                      <Text style={[styles.detailText, textStyle]}>${item.pay.toFixed(2)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="location" size={14} color="#73af17" />
                      <Text style={[styles.detailText, textStyle]} numberOfLines={1}>
                        {item.address.split(',')[0]}
                      </Text>
                    </View>
                    <View style={[styles.dateBadge, isDark && styles.dateBadgeDark]}>
                      <Ionicons name="calendar" size={14} color="#73af17" />
                      <Text style={[styles.dateText, isDark && styles.dateTextDark]}>
                        {dateStr}
                      </Text>
                    </View>
                  </View>
                </Pressable>
                {/* Action Buttons */}
                {(canStart || canComplete) && (
                  <View style={styles.actionButtons}>
                    {canStart && (
                      <Button
                        title="Start"
                        onPress={(e) => {
                          e.stopPropagation();
                          handleStart(item.id, item.title);
                        }}
                        loading={startTaskMutation.isPending}
                        size="small"
                        style={styles.startButton}
                      />
                    )}
                    {canComplete && (
                      <View style={styles.completeRow}>
                        <Button
                          title="Complete Gig"
                          onPress={(e) => {
                            e.stopPropagation();
                            handleComplete(item.id, item.title);
                          }}
                          loading={completeTaskMutation.isPending}
                          size="small"
                          style={styles.completeButton}
                        />
                        <View style={styles.inProgressBadge}>
                          <Ionicons name="time" size={12} color="#F59E0B" />
                          <Text style={styles.inProgressBadgeText}>In Progress</Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
      />
      <SuccessAlert
        visible={showSuccessAlert}
        message={successMessage}
        onClose={() => setShowSuccessAlert(false)}
      />
    </>
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
    backgroundColor: 'transparent',
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
    color: '#000000',
  },
  viewAllText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '600',
  },
  gigsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  gigCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cardDark: {
    borderColor: '#374151',
    backgroundColor: '#FFFFFF',
  },
  cardPressable: {
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#000000',
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flex: 1,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    marginLeft: 'auto',
  },
  inProgressBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  avatarContainer: {
    marginLeft: 'auto',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginLeft: 'auto',
  },
  dateBadgeDark: {
    backgroundColor: 'transparent',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#73af17',
  },
  dateTextDark: {
    color: '#A8D574',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#374151',
  },
  gigDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
    marginBottom: 4,
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
    color: '#374151',
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  startButton: {
    flex: 1,
  },
  completeButton: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
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
});

