import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Task } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    router.push(`/tasks/${task.id}`);
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const descriptionStyle = isDark ? styles.descriptionDark : styles.descriptionLight;
  const metaStyle = isDark ? styles.metaDark : styles.metaLight;

  return (
    <Pressable
      style={[styles.card, cardStyle]}
      onPress={handlePress}
      android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
    >
      {task.photos && task.photos.length > 0 && (
        <Image source={{ uri: task.photos[0] }} style={styles.image} />
      )}
      <View style={styles.content}>
        <Text style={[styles.title, titleStyle]} numberOfLines={2}>
          {task.title}
        </Text>
        <Text style={[styles.description, descriptionStyle]} numberOfLines={2}>
          {task.description}
        </Text>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Ionicons name="cash" size={16} color="#73af17" />
            <Text style={[styles.metaText, metaStyle]}>${task.pay.toFixed(2)}</Text>
          </View>
          {task.estimated_hours && (
            <View style={styles.metaItem}>
              <Ionicons name="time" size={16} color="#73af17" />
              <Text style={[styles.metaText, metaStyle]}>{task.estimated_hours}h</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="location" size={16} color="#73af17" />
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
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  image: {
    width: '100%',
    height: 150,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
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
    color: '#93C5FD',
  },
  moreSkills: {
    fontSize: 12,
  },
});

