import { View, Text, StyleSheet, Image } from 'react-native';
import { Message } from '@/types';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

interface MessageBubbleProps {
  message: Message;
  senderName?: string | null;
  senderAvatar?: string | null;
  isOwn?: boolean;
}

export function MessageBubble({ message, senderName, senderAvatar, isOwn: isOwnProp }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const isOwn = isOwnProp ?? message.sender_id === user?.id;

  const bubbleStyle = isOwn
    ? [styles.bubble, styles.bubbleOwn, isDark && styles.bubbleOwnDark]
    : [styles.bubble, styles.bubbleOther, isDark && styles.bubbleOtherDark];

  const textStyle = isOwn
    ? styles.textOwn
    : [styles.textOther, isDark && styles.textOtherDark];

  const timeStyle = isOwn
    ? styles.timeOwn
    : [styles.timeOther, isDark && styles.timeOtherDark];

  const senderNameStyle = [styles.senderName, isDark && styles.senderNameDark];

  return (
    <View style={styles.container}>
      <View style={styles.messageRow}>
        <View style={styles.avatarContainer}>
          {senderAvatar ? (
            <Image
              source={{ uri: senderAvatar }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
              <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
        </View>
        <View style={styles.bubbleContainer}>
          {senderName && (
            <Text style={senderNameStyle}>{senderName}</Text>
          )}
          <View style={styles.speechBubbleWrapper}>
            <View style={bubbleStyle}>
              <Text style={textStyle}>{message.content}</Text>
              <View style={styles.timeContainer}>
                <Text style={timeStyle}>
                  {format(new Date(message.created_at), 'h:mm a')}
                </Text>
              </View>
            </View>
            {/* Speech bubble tail pointing to avatar */}
            <View style={[styles.speechTail, isOwn ? styles.speechTailOwn : styles.speechTailOther, isDark && (isOwn ? styles.speechTailOwnDark : styles.speechTailOtherDark)]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '95%',
  },
  avatarContainer: {
    marginRight: 16,
    marginBottom: 2,
  },
  bubbleContainer: {
    flexShrink: 1,
    maxWidth: '80%',
  },
  speechBubbleWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 20,
    alignSelf: 'flex-start',
    minWidth: 60,
    maxWidth: '100%',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  speechTail: {
    position: 'absolute',
    width: 0,
    height: 0,
    bottom: 6,
    left: -5,
    borderTopWidth: 16,
    borderTopColor: 'transparent',
    borderBottomWidth: 16,
    borderBottomColor: 'transparent',
    borderRightWidth: 16,
    transform: [{ rotate: '0deg' }],
  },
  speechTailOwn: {
    borderRightColor: '#73af17',
  },
  speechTailOwnDark: {
    borderRightColor: '#73af17',
  },
  speechTailOther: {
    borderRightColor: '#F3F4F6',
  },
  speechTailOtherDark: {
    borderRightColor: '#374151',
  },
  bubbleOwn: {
    backgroundColor: '#73af17',
  },
  bubbleOwnDark: {
    backgroundColor: '#73af17',
  },
  bubbleOther: {
    backgroundColor: '#F3F4F6',
  },
  bubbleOtherDark: {
    backgroundColor: '#374151',
  },
  textOwn: {
    fontSize: 15,
    color: '#FFFFFF',
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
  },
  timeOther: {
    fontSize: 11,
    color: '#6B7280',
  },
  timeOtherDark: {
    color: '#9CA3AF',
  },
  senderName: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
    marginLeft: 12,
    fontWeight: '500',
  },
  senderNameDark: {
    color: '#9CA3AF',
  },
});

