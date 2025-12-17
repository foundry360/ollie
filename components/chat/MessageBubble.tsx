import { View, Text, StyleSheet } from 'react-native';
import { Message } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { format } from 'date-fns';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const isOwn = message.sender_id === user?.id;

  const bubbleStyle = isOwn
    ? [styles.bubble, styles.bubbleOwn, isDark && styles.bubbleOwnDark]
    : [styles.bubble, styles.bubbleOther, isDark && styles.bubbleOtherDark];

  const textStyle = isOwn
    ? styles.textOwn
    : [styles.textOther, isDark && styles.textOtherDark];

  const timeStyle = isOwn
    ? styles.timeOwn
    : [styles.timeOther, isDark && styles.timeOtherDark];

  return (
    <View style={[styles.container, isOwn && styles.containerOwn]}>
      <View style={bubbleStyle}>
        <Text style={textStyle}>{message.content}</Text>
        <Text style={timeStyle}>
          {format(new Date(message.created_at), 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  containerOwn: {
    alignItems: 'flex-end',
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleOwn: {
    backgroundColor: '#73af17',
    borderBottomRightRadius: 4,
  },
  bubbleOwnDark: {
    backgroundColor: '#73af17',
  },
  bubbleOther: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  bubbleOtherDark: {
    backgroundColor: '#374151',
  },
  textOwn: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  textOther: {
    fontSize: 15,
    color: '#111827',
  },
  textOtherDark: {
    color: '#FFFFFF',
  },
  timeOwn: {
    fontSize: 11,
    color: '#E0E7FF',
    alignSelf: 'flex-end',
  },
  timeOther: {
    fontSize: 11,
    color: '#6B7280',
    alignSelf: 'flex-start',
  },
  timeOtherDark: {
    color: '#9CA3AF',
  },
});

