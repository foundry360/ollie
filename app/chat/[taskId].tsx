import { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, KeyboardAvoidingView, Platform, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTask } from '@/hooks/useTasks';
import { useAuthStore } from '@/stores/authStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui/Loading';
import { Ionicons } from '@expo/vector-icons';
import { getPublicUserProfile, getUserProfileForChat } from '@/lib/api/users';
import { format } from 'date-fns';
import { Message } from '@/types';
import { getTaskMessages, createMessage, markMessagesAsRead } from '@/lib/api/messages';
import { supabase } from '@/lib/supabase';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ taskId: string; recipientId?: string | string[] }>();
  const taskId = Array.isArray(params.taskId) ? params.taskId[0] : params.taskId;
  const recipientId = Array.isArray(params.recipientId) ? params.recipientId[0] : params.recipientId;
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const flatListRef = useRef<FlatList>(null);

  const { data: task } = useTask(taskId as string);
  
  // Local state only - no React Query
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [otherUserProfile, setOtherUserProfile] = useState<any>(null);
  const [senderProfiles, setSenderProfiles] = useState<Array<{ id: string; name: string; avatar: string | null }>>([]);

  // Get the other user's ID
  const otherUserId = useMemo(() => {
    if (recipientId) return recipientId;
    
    if (!task || !user) return null;
    
    // For assigned gigs
    if (task.teen_id) {
      if (task.poster_id === user.id) return task.teen_id;
      if (task.teen_id === user.id) return task.poster_id;
    }
    
    // For open gigs
    if (task.poster_id !== user.id) return task.poster_id;
    
    return null;
  }, [recipientId, task, user]);

  // Fetch initial messages
  useEffect(() => {
    if (!taskId || !user?.id) return;

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        const fetchedMessages = await getTaskMessages(taskId, recipientId);
        setMessages(fetchedMessages);
      } catch (error) {
        console.error('Error loading messages:', error);
        Alert.alert('Error', 'Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [taskId, recipientId, user?.id]);

  // Fetch other user's profile
  useEffect(() => {
    if (!otherUserId) return;

    const loadProfile = async () => {
      try {
        const profile = await getPublicUserProfile(otherUserId);
        if (profile) {
          setOtherUserProfile(profile);
          return;
        }
        const chatProfile = await getUserProfileForChat(otherUserId);
        if (chatProfile) {
          setOtherUserProfile(chatProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    };

    loadProfile();
  }, [otherUserId]);

  // Fetch sender profiles
  useEffect(() => {
    if (messages.length === 0) return;

    const loadProfiles = async () => {
      const uniqueIds = new Set<string>();
      messages.forEach(msg => {
        uniqueIds.add(msg.sender_id);
        uniqueIds.add(msg.recipient_id);
      });
      if (user?.id) uniqueIds.add(user.id);
      if (otherUserId) uniqueIds.add(otherUserId);

      const profiles = await Promise.all(
        Array.from(uniqueIds).map(async (senderId) => {
          try {
            const profile = await getPublicUserProfile(senderId);
            if (profile) {
              return { 
                id: senderId, 
                name: profile.full_name || 'Unknown',
                avatar: profile.profile_photo_url || null
              };
            }
            const chatProfile = await getUserProfileForChat(senderId);
            if (chatProfile) {
              return { 
                id: senderId, 
                name: chatProfile.full_name || 'Unknown',
                avatar: chatProfile.profile_photo_url || null
              };
            }
            return { id: senderId, name: 'Unknown', avatar: null };
          } catch (error) {
            console.error(`Failed to fetch profile for ${senderId}:`, error);
            return { id: senderId, name: 'Unknown', avatar: null };
          }
        })
      );
      setSenderProfiles(profiles);
    };

    loadProfiles();
  }, [messages, user?.id, otherUserId]);

  // Realtime subscription - update local state directly
  useEffect(() => {
    if (!taskId || !user?.id) return;

    const channel = supabase
      .channel(`messages:${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `gig_id=eq.${taskId}`,
        },
        (payload) => {
          // Only update if message is for current user
          const isRelevant = payload.new?.sender_id === user?.id || payload.new?.recipient_id === user?.id;
          if (isRelevant) {
            // Update local state directly
            setMessages(prev => {
              // Check if already exists
              if (prev.some(msg => msg.id === payload.new.id)) return prev;
              // Add new message and sort
              return [...prev, payload.new as Message].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `gig_id=eq.${taskId}`,
        },
        (payload) => {
          // Update local state directly
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.new.id ? { ...msg, ...payload.new } as Message : msg
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, user?.id]);

  // Mark messages as read
  useEffect(() => {
    if (otherUserId && messages.length > 0 && user?.id && taskId) {
      const unreadMessages = messages.filter(
        (msg) => msg.recipient_id === user.id && !msg.read
      );
      
      if (unreadMessages.length > 0) {
        markMessagesAsRead(taskId, otherUserId).catch(() => {});
      }
    }
  }, [messages, otherUserId, user?.id, taskId]);

  // Send message handler
  const handleSend = async (content: string) => {
    if (!content || !content.trim()) {
      Alert.alert('Cannot Send', 'Please enter a message.');
      return;
    }
    
    if (!task || !otherUserId || !user?.id) {
      Alert.alert('Cannot Send', 'Missing required information. Please try again.');
      return;
    }

    try {
      setIsSending(true);
      // Use database function (bypasses RLS)
      const newMessage = await createMessage({
        gig_id: task.id,
        recipient_id: otherUserId,
        content: content.trim(),
        sender_id: user.id,
      });

      // Update local state immediately (Realtime will also update, but this gives instant feedback)
      setMessages(prev => {
        if (prev.some(msg => msg.id === newMessage.id)) return prev;
        return [...prev, newMessage].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    } catch (error: any) {
      let errorMessage = 'Failed to send message.';
      if (error?.code === '42501' || error?.message?.includes('row-level security') || error?.message?.includes('RLS')) {
        errorMessage = 'Permission denied. You may not have permission to send messages for this gig.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('Error Sending Message', errorMessage, [
        { text: 'OK' },
        {
          text: 'Retry',
          onPress: () => handleSend(content),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Build sender names and avatars maps
  const senderNames = useMemo(() => {
    const map = new Map<string, string>();
    senderProfiles.forEach(profile => {
      if (profile.id && profile.name) {
        map.set(profile.id, profile.name);
      }
    });
    if (user?.id && !map.has(user.id) && user.full_name) {
      map.set(user.id, user.full_name);
    }
    return map;
  }, [senderProfiles, user?.id, user?.full_name]);

  const senderAvatars = useMemo(() => {
    const map = new Map<string, string | null>();
    senderProfiles.forEach(profile => {
      if (profile.id) {
        map.set(profile.id, profile.avatar);
      }
    });
    if (user?.id && !map.has(user.id) && user.profile_photo_url) {
      map.set(user.id, user.profile_photo_url);
    }
    return map;
  }, [senderProfiles, user?.id, user?.profile_photo_url]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: Message[] }> = [];
    let currentDate: string | null = null;
    let currentGroup: Message[] = [];

    messages.forEach((message) => {
      const messageDate = format(new Date(message.created_at), 'EEE, MMMM d, yyyy');
      
      if (messageDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate!, messages: currentGroup });
        }
        currentDate = messageDate;
        currentGroup = [message];
      } else {
        currentGroup.push(message);
      }
    });

    if (currentGroup.length > 0 && currentDate) {
      groups.push({ date: currentDate, messages: currentGroup });
    }

    return groups;
  }, [messages]);

  // Get header title - show other user's name or "Chat"
  const headerTitle = useMemo(() => {
    if (!otherUserId) return 'Chat';
    const otherName = otherUserProfile?.full_name || senderNames.get(otherUserId) || 'Chat';
    return otherName;
  }, [otherUserId, otherUserProfile, senderNames]);

  // Get header avatar
  const headerAvatar = useMemo(() => {
    if (!otherUserId) return null;
    return otherUserProfile?.profile_photo_url || senderAvatars.get(otherUserId) || null;
  }, [otherUserId, otherUserProfile, senderAvatars]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.push('/(tabs)/messages')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
          {headerAvatar && (
            <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
          )}
          <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
            {headerTitle}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <Loading />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.push('/(tabs)/messages')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
        </Pressable>
        {headerAvatar && (
          <Image source={{ uri: headerAvatar }} style={styles.headerAvatar} />
        )}
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          {headerTitle}
        </Text>
      </View>
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {!otherUserId ? (
          <View style={styles.noRecipientContainer}>
            <Ionicons name="information-circle-outline" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.noRecipientText, isDark && styles.noRecipientTextDark]}>
              To start a conversation, go to the gig details and click "Message" on an applicant's profile.
            </Text>
          </View>
        ) : (
          <View style={styles.chatContent}>
            <FlatList
              ref={flatListRef}
              data={groupedMessages}
              keyExtractor={(item, index) => `${item.date}-${index}`}
              renderItem={({ item }) => (
                <View>
                  <View style={styles.dateHeader}>
                    <Text style={[styles.dateText, isDark && styles.dateTextDark]}>
                      {item.date}
                    </Text>
                  </View>
                  {item.messages.map((message) => {
                    const senderName = senderNames.get(message.sender_id) || 'Unknown';
                    const senderAvatar = senderAvatars.get(message.sender_id) || null;
                    const isOwn = message.sender_id === user?.id;

                    return (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        senderName={senderName}
                        senderAvatar={senderAvatar}
                        isOwn={isOwn}
                      />
                    );
                  })}
                </View>
              )}
              contentContainerStyle={styles.messagesList}
              inverted={false}
              onContentSizeChange={() => {
                flatListRef.current?.scrollToEnd({ animated: false });
              }}
              style={styles.messagesFlatList}
              contentContainerStyle={styles.messagesList}
            />
            <View style={[styles.inputContainer, isDark && styles.inputContainerDark]}>
              <MessageInput
                onSend={handleSend}
                disabled={isSending || !otherUserId || !task}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#73af17',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerDark: {
    backgroundColor: '#73af17',
    borderBottomColor: '#1F1F1F',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContent: {
    flex: 1,
    position: 'relative',
  },
  keyboardView: {
    flex: 1,
  },
  messagesFlatList: {
    flex: 1,
    paddingBottom: 80, // Space for input at bottom
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  inputContainer: {
    paddingHorizontal: 0,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
  },
  inputContainerDark: {
    backgroundColor: 'transparent',
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  dateTextDark: {
    color: '#9CA3AF',
  },
  noRecipientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  noRecipientText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
  },
  noRecipientTextDark: {
    color: '#9CA3AF',
  },
});
