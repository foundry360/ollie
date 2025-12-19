import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUserTasks } from '@/hooks/useTasks';
import { useAuthStore } from '@/stores/authStore';
import { Task, TaskStatus } from '@/types';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateGigModal } from '@/components/tasks/CreateGigModal';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const STATUS_FILTERS: { label: string; value: TaskStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function TasksScreen() {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const role = user?.role === 'poster' ? 'poster' : 'teen';

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/tasks.tsx:22',message:'TasksScreen mount',data:{role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [role]);
  // #endregion
  const filters = statusFilter === 'all' ? { role } : { role, status: statusFilter };

  const {
    data: tasks = [],
    isLoading,
    isRefetching,
    refetch,
  } = useUserTasks(filters);

  const handleRefresh = () => {
    refetch();
  };

  const handleGigPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseDetailModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const renderTask = ({ item }: { item: Task }) => (
    <TaskCard task={item} onPress={handleGigPress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="briefcase-outline"
        size={64}
        color={isDark ? '#6B7280' : '#9CA3AF'}
      />
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        {isLoading ? 'Loading gigs...' : 'No gigs found'}
      </Text>
      <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
        {isLoading
          ? 'Please wait while we fetch your gigs'
          : statusFilter === 'all'
          ? 'You don\'t have any gigs yet'
          : `You don't have any ${statusFilter.replace('_', ' ')} gigs`}
      </Text>
    </View>
  );

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const headerStyle = isDark ? styles.headerDark : styles.headerLight;
  const filterButtonStyle = (active: boolean) => [
    styles.filterButton,
    active && styles.filterButtonActive,
    isDark && !active && styles.filterButtonDark,
    active && isDark && styles.filterButtonActiveDark,
  ];
  const filterButtonTextStyle = (active: boolean) => [
    styles.filterButtonText,
    active && styles.filterButtonTextActive,
    isDark && !active && styles.filterButtonTextDark,
  ];

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, headerStyle]}>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>
          {role === 'poster' ? 'My Posted Gigs' : 'My Gigs'}
        </Text>
      </View>

      <View style={[styles.filtersContainer, isDark && styles.filtersContainerDark]}>
        <View style={styles.filtersContent}>
          {role === 'poster' && (
            <Pressable
              style={[styles.createButton, isDark && styles.createButtonDark]}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </Pressable>
          )}
          <FlatList
            horizontal
            data={STATUS_FILTERS}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isActive = statusFilter === item.value;
              return (
                <Pressable
                  style={filterButtonStyle(isActive)}
                  onPress={() => setStatusFilter(item.value)}
                >
                  <Text style={filterButtonTextStyle(isActive)}>{item.label}</Text>
                </Pressable>
              );
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersListContent}
          />
        </View>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          tasks.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#73af17"
          />
        }
        showsVerticalScrollIndicator={false}
      />
      <CreateGigModal 
        visible={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseDetailModal}
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerTitleDark: {
    color: '#FFFFFF',
  },
  createButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#73af17',
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
  },
  createButtonDark: {
    backgroundColor: '#73af17',
  },
  filtersContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  filtersContainerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#374151',
  },
  filtersContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filtersListContent: {
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  filterButtonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  filterButtonActiveDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextDark: {
    color: '#D1D5DB',
  },
  listContent: {
    padding: 16,
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
