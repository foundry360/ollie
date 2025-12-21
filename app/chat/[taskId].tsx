import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTaskMessages, useCreateMessage, useMarkMessagesAsRead } from '@/hooks/useMessages';
import { useTask } from '@/hooks/useTasks';
import { useAuthStore } from '@/stores/authStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui/Loading';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const flatListRef = useRef<FlatList>(null);

  const { data: task } = useTask(taskId as string);
  const { data: messages = [], isLoading } = useTaskMessages(taskId as string);
  const createMessageMutation = useCreateMessage();
  const markAsReadMutation = useMarkMessagesAsRead();

  // Get the other user's ID
  // For assigned gigs: poster messages teen, teen messages poster
  // For open gigs: teenlancer can message poster (teen_id is null)
  const otherUserId = task
    ? (task.poster_id === user?.id 
        ? task.teen_id  // Poster messaging teen (only works if gig is assigned)
        : task.poster_id) // Teenlancer messaging poster (works for both assigned and open gigs)
    : null;

  // Mark messages as read when viewing
  useEffect(() => {
    if (otherUserId && messages.length > 0) {
      const unreadMessages = messages.filter(
        (msg) => msg.recipient_id === user?.id && !msg.read
      );
      if (unreadMessages.length > 0) {
        markAsReadMutation.mutate({ taskId: taskId as string, senderId: otherUserId });
      }
    }
  }, [messages, otherUserId, user?.id, taskId, markAsReadMutation]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async (content: string) => {
    if (!task || !otherUserId) return;

    try {
      await createMessageMutation.mutateAsync({
        task_id: task.id,
        recipient_id: otherUserId,
        content,
      });
    } catch (error: any) {
      console.error('Failed to send message:', error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => (
    <MessageBubble message={item} />
  );

  if (isLoading && messages.length === 0) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <Loading />
      </SafeAreaView>
    );
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const headerStyle = isDark ? styles.headerDark : styles.headerLight;
  const headerTitleStyle = isDark ? styles.headerTitleDark : styles.headerTitleLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={[styles.header, headerStyle]}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, headerTitleStyle]}>
              {task?.title || 'Chat'}
            </Text>
            <Text style={[styles.headerSubtitle, isDark && styles.headerSubtitleDark]}>
              {task?.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="chatbubbles-outline"
                size={64}
                color={isDark ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                No messages yet
              </Text>
              <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
                Start the conversation!
              </Text>
            </View>
          }
        />

        <MessageInput
          onSend={handleSend}
          disabled={createMessageMutation.isPending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLight: {
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#374151',
  },
  backButton: {
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  headerSubtitleDark: {
    color: '#9CA3AF',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTextDark: {
    color: '#D1D5DB',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptySubtextDark: {
    color: '#9CA3AF',
  },
});
