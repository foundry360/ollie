import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUserTasks } from '@/hooks/useTasks';
import { Task } from '@/types';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPublicUserProfile } from '@/lib/api/users';

// Helper to convert 24-hour time to 12-hour format
const formatTime12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export function NeighborUpcomingScheduledGigs() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get all gigs and filter for scheduled ones
  const { data: allGigs = [], isLoading } = useUserTasks({
    role: 'poster',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const scheduledGigs = allGigs
    .filter(gig => {
      // Only show gigs that are actually assigned (have teen_id) and scheduled
      if (!gig.scheduled_date || !gig.teen_id) return false;
      const scheduledDate = new Date(gig.scheduled_date);
      scheduledDate.setHours(0, 0, 0, 0);
      // Only show accepted or in_progress gigs (not open)
      return scheduledDate >= today && ['accepted', 'in_progress'].includes(gig.status);
    })
    .sort((a, b) => {
      if (!a.scheduled_date || !b.scheduled_date) return 0;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    })
    .slice(0, 5);

  // Get unique teen IDs from scheduled gigs
  const teenIds = useMemo(() => {
    return scheduledGigs
      .filter(gig => gig.teen_id)
      .map(gig => gig.teen_id!)
      .filter((id, index, self) => self.indexOf(id) === index); // Unique IDs
  }, [scheduledGigs]);

  // Fetch teen profiles
  const { data: teenProfiles = [] } = useQuery({
    queryKey: ['teenProfiles', teenIds],
    queryFn: async () => {
      const profiles = await Promise.all(
        teenIds.map(async (id) => {
          try {
            const profile = await getPublicUserProfile(id);
            return profile ? { id, profile } : null;
          } catch {
            return null;
          }
        })
      );
      return profiles.filter((p): p is { id: string; profile: any } => p !== null);
    },
    enabled: teenIds.length > 0,
    staleTime: 300000, // 5 minutes
  });

  // Create a map of teen_id to profile
  const teenProfileMap = useMemo(() => {
    const map = new Map<string, any>();
    teenProfiles.forEach(({ id, profile }) => {
      map.set(id, profile);
    });
    return map;
  }, [teenProfiles]);

  const handleGigPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Upcoming Scheduled</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
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
          <Text style={[styles.sectionTitle, titleStyle]}>Upcoming Scheduled</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        {scheduledGigs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name="calendar-outline"
              size={48}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <Text style={[styles.emptyText, titleStyle]}>No upcoming gigs scheduled</Text>
            <Text style={[styles.emptySubtext, textStyle]}>
              Gigs appear when assigned and scheduled
            </Text>
          </View>
        ) : (
          <View style={styles.gigsList}>
            {scheduledGigs.map((item) => {
            const scheduledDate = item.scheduled_date ? new Date(item.scheduled_date) : null;
            const dateStr = scheduledDate ? format(scheduledDate, 'MMM d') : '';
            const timeStr = item.scheduled_start_time && item.scheduled_end_time
              ? `${formatTime12Hour(item.scheduled_start_time)} - ${formatTime12Hour(item.scheduled_end_time)}`
              : '';

            const teenProfile = item.teen_id ? teenProfileMap.get(item.teen_id) : null;

            return (
              <Pressable
                key={item.id}
                style={[styles.gigCard, cardStyle]}
                onPress={() => handleGigPress(item.id)}
                android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
              >
                <View style={styles.titleRow}>
                  <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.teen_id && (
                    <View style={styles.avatarContainer}>
                      {teenProfile?.profile_photo_url ? (
                        <Image
                          source={{ uri: teenProfile.profile_photo_url }}
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
            );
            })}
          </View>
        )}
      </View>
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
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
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
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
    backgroundColor: 'rgba(115, 175, 23, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginLeft: 'auto',
  },
  dateBadgeDark: {
    backgroundColor: 'rgba(115, 175, 23, 0.2)',
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptySubtext: {
    fontSize: 12,
    textAlign: 'center',
    color: '#6B7280',
    paddingHorizontal: 16,
  },
});














