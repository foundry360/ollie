import { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversations } from '@/hooks/useMessages';
import { ConversationItem } from '@/components/messages/ConversationItem';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

export default function MessagesScreen() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/messages.tsx:10',message:'MessagesScreen mount',data:{insetsTop:insets.top,insetsBottom:insets.bottom},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [insets.top, insets.bottom]);
  // #endregion
  const {
    data: conversations = [],
    isLoading,
    isRefetching,
    refetch,
  } = useConversations();

  const handleRefresh = () => {
    refetch();
  };

  const renderConversation = ({ item }: { item: any }) => (
    <ConversationItem
      task_id={item.task_id}
      task_title={item.task_title}
      other_user_name={item.other_user_name}
      last_message={item.last_message}
      unread_count={item.unread_count}
    />
  );

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const headerStyle = isDark ? styles.headerDark : styles.headerLight;
  const headerTitleStyle = isDark ? styles.headerTitleDark : styles.headerTitleLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.headerTitle, headerTitleStyle]}>Messages</Text>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => `${item.task_id}-${item.other_user_id}`}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons
              name="chatbubbles-outline"
              size={64}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
            <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
              {isLoading ? 'Loading conversations...' : 'No messages yet'}
            </Text>
            <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
              {isLoading
                ? 'Please wait while we fetch your conversations'
                : 'Start a conversation from a task'}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#73af17"
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLight: {
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#000000',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  listContent: {
    flexGrow: 1,
  },
  listContentEmpty: {
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
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptySubtextDark: {
    color: '#9CA3AF',
  },
});
