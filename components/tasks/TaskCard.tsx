import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Task, TaskStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useIsGigSaved, useSaveGig, useUnsaveGig } from '@/hooks/useTasks';
import { useGigApplications } from '@/hooks/useGigApplications';

interface TaskCardProps {
  task: Task;
  onPress?: (taskId: string) => void;
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  const isTeenlancer = user?.role === 'teen';
  const isOpen = task.status === 'open';

  // Check if gig is saved (only for teenlancers viewing open gigs)
  const { data: isSaved = false } = useIsGigSaved(isTeenlancer && isOpen ? task.id : null);
  const saveGigMutation = useSaveGig();
  const unsaveGigMutation = useUnsaveGig();

  // Get application count for open gigs
  const { data: applications = [] } = useGigApplications(isOpen ? task.id : null);
  const applicationCount = isOpen ? (applications.filter(app => app.status === 'pending').length) : 0;

  const handlePress = () => {
    if (onPress) {
      onPress(task.id);
    } else {
      router.push(`/tasks/${task.id}`);
    }
  };

  const handleSavePress = (e: any) => {
    e.stopPropagation(); // Prevent card press
    if (isSaved) {
      unsaveGigMutation.mutate(task.id);
    } else {
      saveGigMutation.mutate(task.id);
    }
  };

  const canSave = isTeenlancer && isOpen;

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const descriptionStyle = isDark ? styles.descriptionDark : styles.descriptionLight;
  const metaStyle = isDark ? styles.metaDark : styles.metaLight;

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return '#73af17';
      case 'accepted':
        return '#F97316';
      case 'in_progress':
        return '#F59E0B';
      case 'completed':
        return '#6366F1';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusBgColor = (status: TaskStatus, isDark: boolean) => {
    if (status === 'cancelled') {
      return isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)';
    }
    // Light background with opacity for colored statuses
    switch (status) {
      case 'open':
        return isDark ? 'rgba(115, 175, 23, 0.2)' : 'rgba(115, 175, 23, 0.15)';
      case 'accepted':
        return isDark ? 'rgba(249, 115, 22, 0.2)' : 'rgba(249, 115, 22, 0.15)';
      case 'in_progress':
        return isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)';
      case 'completed':
        return isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.15)';
      default:
        return isDark ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.15)';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    return status.replace('_', ' ').toUpperCase();
  };

  return (
    <Pressable
      style={[styles.card, cardStyle]}
      onPress={handlePress}
      android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
    >
      {/* Left side: Image with info below */}
      <View style={[styles.leftSection, isDark && styles.leftSectionDark]}>
        <View style={styles.imageContainer}>
          {task.photos && task.photos.length > 0 && task.photos[0] ? (
            <Image 
              source={{ uri: task.photos[0] }} 
              style={styles.image}
              resizeMode="cover"
              onError={(e) => {
                console.log('Image load error for task:', task.id, 'Photo URL:', task.photos?.[0], 'Error:', e.nativeEvent.error);
              }}
              onLoad={() => {
                console.log('Image loaded successfully for task:', task.id, 'Photo URL:', task.photos?.[0]);
              }}
            />
          ) : (
            <View style={[styles.imagePlaceholder, isDark && styles.imagePlaceholderDark]}>
              <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
            </View>
          )}
        </View>
        
        {/* Price below image */}
        <View style={[styles.infoRow, isDark && styles.infoRowDark]}>
          <View style={[styles.metaItem, styles.centeredPrice]}>
            <Ionicons name="cash" size={14} color="#73af17" />
            <Text style={[styles.metaText, metaStyle]}>${task.pay.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Right side: Title, description, and address */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text 
            style={[
              styles.title, 
              titleStyle,
              task.status === 'cancelled' && styles.titleCancelled
            ]} 
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {canSave && (
            <Pressable
              onPress={handleSavePress}
              style={styles.heartButton}
              disabled={saveGigMutation.isPending || unsaveGigMutation.isPending}
            >
              {saveGigMutation.isPending || unsaveGigMutation.isPending ? (
                <ActivityIndicator size="small" color="#F97316" />
              ) : (
                <Ionicons 
                  name={isSaved ? "heart" : "heart-outline"} 
                  size={20} 
                  color="#F97316" 
                />
              )}
            </Pressable>
          )}
        </View>
        <Text style={[
          styles.description, 
          descriptionStyle,
          task.status === 'cancelled' && styles.descriptionCancelled
        ]} numberOfLines={2}>
          {task.description}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={16} color="#F97316" />
            <Text style={[styles.metaText, metaStyle]} numberOfLines={1}>
              {task.address.split(',')[0]}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 120,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderColor: '#1F2937',
  },
  leftSection: {
    width: 100,
    flexDirection: 'column',
    backgroundColor: '#F0F9E8',
  },
  leftSectionDark: {
    backgroundColor: '#111827',
  },
  imageContainer: {
    padding: 8,
    paddingBottom: 4,
  },
  image: {
    width: '100%',
    height: 80,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  imagePlaceholderDark: {
    backgroundColor: '#1F2937',
  },
  infoRow: {
    flexDirection: 'column',
    paddingHorizontal: 8,
    paddingTop: 0,
    paddingBottom: 6,
    gap: 4,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRowDark: {
    // No divider needed
  },
  content: {
    flex: 1,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  heartButton: {
    padding: 4,
    marginLeft: 8,
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleCancelled: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
    alignSelf: 'flex-start',
  },
  statusBadgeCancelled: {
    // Background color is set dynamically via getStatusBgColor
  },
  statusDot: {
    marginRight: 0,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '600',
  },
  statusTextCancelled: {
    color: '#EF4444',
  },
  descriptionCancelled: {
    opacity: 0.6,
  },
  description: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  descriptionLight: {
    color: '#6B7280',
  },
  descriptionDark: {
    color: '#9CA3AF',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  centeredPrice: {
    justifyContent: 'center',
    width: '100%',
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  metaLight: {
    color: '#374151',
  },
  metaDark: {
    color: '#D1D5DB',
  },
  skillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    flex: 1,
    paddingLeft: 0,
    marginLeft: 0,
  },
  skillTag: {
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  skillTagDark: {
    backgroundColor: 'transparent',
  },
  skillText: {
    fontSize: 12,
    color: '#73af17',
    fontWeight: '500',
  },
  skillTextDark: {
    color: '#73af17',
  },
  moreSkills: {
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  statusDotInline: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusTextInline: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  applicantText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

