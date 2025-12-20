import { useState, useEffect, useMemo } from 'react';
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
import { useTeenApplications } from '@/hooks/useGigApplications';

const STATUS_FILTERS_TEEN: { label: string; value: TaskStatus | 'all' | 'applied' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Applied', value: 'applied' },
  { label: 'Open', value: 'open' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const STATUS_FILTERS_POSTER: { label: string; value: TaskStatus | 'all' }[] = [
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
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all' | 'applied'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const role = user?.role === 'poster' ? 'poster' : 'teen';

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/tasks.tsx:22',message:'TasksScreen mount',data:{role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [role]);
  // #endregion

  // Reset filter if neighbor has 'applied' selected (not applicable to neighbors)
  useEffect(() => {
    if (role === 'poster' && statusFilter === 'applied') {
      setStatusFilter('all');
    }
  }, [role, statusFilter]);

  // Get teen applications if viewing applied gigs
  const { data: teenApplications = [], isLoading: applicationsLoading } = useTeenApplications();
  const appliedGigIds = useMemo(() => {
    if (role === 'teen' && statusFilter === 'applied') {
      return new Set(teenApplications.map(app => app.gig_id));
    }
    return new Set<string>();
  }, [teenApplications, role, statusFilter]);

  // Get all tasks for filtering (always fetch, filter client-side)
  const allTasksFilters = { role };
  const {
    data: allTasks = [],
    isLoading: allTasksLoading,
    isRefetching,
    refetch,
  } = useUserTasks(allTasksFilters);

  // For applied filter, we need to fetch the actual gigs by their IDs
  // Since applied gigs aren't assigned yet, they won't be in useUserTasks
  // We'll use the gig data from applications and create Task-like objects for display
  // Also need this for "All" filter to show applied gigs
  const appliedTasks = useMemo(() => {
    if (role === 'teen') {
      // Map applications to Task-like objects for display
      return teenApplications
        .filter(app => app.status === 'pending' || app.status === 'approved')
        .map(app => ({
          id: app.gig_id,
          title: app.gig_title || 'Unknown Gig',
          description: app.gig_description || '',
          pay: app.gig_pay || 0,
          status: (app.status === 'approved' ? 'accepted' : 'open') as TaskStatus,
          poster_id: '', // We don't have this in the application data
          teen_id: app.status === 'approved' ? app.teen_id : null,
          location: app.gig_location || { latitude: 0, longitude: 0 },
          address: app.gig_address || '',
          required_skills: app.gig_required_skills || [],
          estimated_hours: app.gig_estimated_hours || null,
          photos: app.gig_photos || [],
          created_at: app.gig_created_at || app.created_at,
          updated_at: app.gig_updated_at || app.updated_at,
        })) as Task[];
    }
    return [];
  }, [teenApplications, role]);

  // Filter tasks based on selected filter
  const tasks = useMemo(() => {
    if (statusFilter === 'all') {
      // For "All", combine assigned tasks with applied gigs (for teenlancers)
      if (role === 'teen') {
        // Combine assigned tasks with applied gigs, removing duplicates
        const assignedTaskIds = new Set(allTasks.map(t => t.id));
        const uniqueAppliedTasks = appliedTasks.filter(appTask => !assignedTaskIds.has(appTask.id));
        return [...allTasks, ...uniqueAppliedTasks];
      }
      return allTasks;
    } else if (statusFilter === 'applied') {
      // For applied filter, show gigs from applications
      return appliedTasks;
    } else {
      // For other status filters, use the standard filter
      // Also include applied gigs that match the status (for teenlancers)
      if (role === 'teen') {
        const filteredAssigned = allTasks.filter(task => task.status === statusFilter);
        const filteredApplied = appliedTasks.filter(task => task.status === statusFilter);
        const assignedTaskIds = new Set(filteredAssigned.map(t => t.id));
        const uniqueApplied = filteredApplied.filter(appTask => !assignedTaskIds.has(appTask.id));
        return [...filteredAssigned, ...uniqueApplied];
      }
      return allTasks.filter(task => task.status === statusFilter);
    }
  }, [allTasks, statusFilter, appliedTasks, role]);

  const isLoading = statusFilter === 'applied' ? applicationsLoading : allTasksLoading;

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
          ? role === 'poster' 
            ? 'You haven\'t posted any gigs yet'
            : 'You don\'t have any gigs yet'
          : statusFilter === 'applied'
          ? 'You haven\'t applied to any gigs yet'
          : role === 'poster'
          ? `You don't have any ${statusFilter.replace('_', ' ')} gigs posted`
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
            data={role === 'poster' ? STATUS_FILTERS_POSTER : STATUS_FILTERS_TEEN}
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
