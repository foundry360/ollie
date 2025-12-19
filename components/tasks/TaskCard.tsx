import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Task, TaskStatus } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface TaskCardProps {
  task: Task;
  onPress?: (taskId: string) => void;
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    if (onPress) {
      onPress(task.id);
    } else {
      router.push(`/tasks/${task.id}`);
    }
  };

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
        {task.photos && task.photos.length > 0 ? (
          <Image 
            source={{ uri: task.photos[0] }} 
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
          </View>
        )}
        
        {/* Time and Price below image */}
        <View style={[styles.infoRow, isDark && styles.infoRowDark]}>
          {task.estimated_hours && (
            <View style={styles.metaItem}>
              <Ionicons name="time" size={14} color="#73af17" />
              <Text style={[styles.metaText, metaStyle]}>{task.estimated_hours}h</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="cash" size={14} color="#73af17" />
            <Text style={[styles.metaText, metaStyle]}>${task.pay.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Right side: Title, description, and address */}
      <View style={styles.content}>
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
        {task.required_skills && task.required_skills.length > 0 && (
          <View style={styles.skills}>
            {task.required_skills.slice(0, 3).map((skill, index) => (
              <View key={index} style={[styles.skillTag, isDark && styles.skillTagDark]}>
                <Text style={[styles.skillText, isDark && styles.skillTextDark]}>{skill}</Text>
              </View>
            ))}
            {task.required_skills.length > 3 && (
              <Text style={[styles.moreSkills, metaStyle]}>
                +{task.required_skills.length - 3} more
              </Text>
            )}
          </View>
        )}
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
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  leftSection: {
    width: 100,
    flexDirection: 'column',
    backgroundColor: '#F0F9E8',
  },
  leftSectionDark: {
    backgroundColor: '#111827',
  },
  image: {
    width: 100,
    height: 80,
    backgroundColor: '#F3F4F6',
  },
  imagePlaceholder: {
    width: 100,
    height: 80,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'column',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flex: 1,
  },
  infoRowDark: {
    borderTopColor: '#374151',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
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
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  skillTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  skillTagDark: {
    backgroundColor: '#1E3A8A',
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
});

