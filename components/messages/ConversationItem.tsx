import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { format, formatDistanceToNow } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface ConversationItemProps {
  task_id: string;
  task_title: string;
  other_user_name: string;
  last_message: {
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
}

export function ConversationItem({
  task_id,
  task_title,
  other_user_name,
  last_message,
  unread_count,
}: ConversationItemProps) {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const handlePress = () => {
    router.push(`/chat/${task_id}`);
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const timeStyle = isDark ? styles.timeDark : styles.timeLight;

  return (
    <Pressable
      style={[styles.container, containerStyle]}
      onPress={handlePress}
      android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
    >
      <View style={styles.avatar}>
        <Ionicons
          name="person"
          size={24}
          color={isDark ? '#9CA3AF' : '#6B7280'}
        />
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, titleStyle]} numberOfLines={1}>
            {task_title}
          </Text>
          {last_message && (
            <Text style={timeStyle}>
              {formatDistanceToNow(new Date(last_message.created_at), { addSuffix: true })}
            </Text>
          )}
        </View>
        <View style={styles.footer}>
          <Text style={[styles.subtitle, subtitleStyle]} numberOfLines={1}>
            {other_user_name}
          </Text>
          {last_message && (
            <Text style={[styles.message, subtitleStyle]} numberOfLines={1}>
              {last_message.content}
            </Text>
          )}
        </View>
      </View>
      {unread_count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unread_count > 99 ? '99+' : unread_count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  time: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  timeLight: {
    color: '#6B7280',
  },
  timeDark: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  message: {
    flex: 1,
    fontSize: 14,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

