import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useOpenTasks, useSavedGigs } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { MarketplaceMap } from '@/components/marketplace/MarketplaceMap';
import { Task } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export default function MarketplaceScreen() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  
  // Check if user is a neighbor (poster) - they shouldn't access the Marketplace
  const isNeighbor = user?.role === 'poster';
  const [filters, setFilters] = useState<{
    minPay?: number;
    maxPay?: number;
    skills?: string[];
    radius?: number;
  }>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map' | 'saved'>('list');

  // Get user location for radius filtering
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setLocationError(null);
      } catch (error) {
        console.error('Error getting location:', error);
        setLocationError('Failed to get location');
      }
    };

    if (!isNeighbor) {
      getLocation();
    }
  }, [isNeighbor]);

  const {
    data: gigs = [],
    isLoading,
    isRefetching,
    refetch,
  } = useOpenTasks({
    ...filters,
    userLocation: filters.radius ? userLocation || undefined : undefined,
    limit: 50,
  });

  const {
    data: savedGigs = [],
    isLoading: savedLoading,
    isRefetching: savedRefetching,
    refetch: refetchSaved,
  } = useSavedGigs();

  const handleRefresh = () => {
    refetch();
  };

  const handleGigPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const renderGig = ({ item }: { item: Task }) => (
    <TaskCard task={item} onPress={handleGigPress} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="storefront-outline"
        size={64}
        color={isDark ? '#6B7280' : '#9CA3AF'}
      />
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        {isLoading ? 'Loading gigs...' : 'No gigs available'}
      </Text>
      <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
        {isLoading
          ? 'Please wait while we fetch available gigs'
          : 'Check back later for new opportunities'}
      </Text>
    </View>
  );

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const headerStyle = isDark ? styles.headerDark : styles.headerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;

  // Show message for neighbors who somehow access this screen
  if (isNeighbor) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <View style={[styles.header, headerStyle]}>
          <Text style={[styles.heading, titleStyle]}>Marketplace</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="storefront-outline"
            size={64}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
            Marketplace Not Available
          </Text>
          <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
            As a neighbor, you post gigs rather than browse them. Use "My Gigs" to manage your posted gigs.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, titleStyle]}>Marketplace</Text>
          <View style={styles.headerActions}>
            <TaskFilters filters={filters} onFiltersChange={setFilters} />
          </View>
        </View>
      </View>

      <View style={[styles.tabBar, isDark && styles.tabBarDark]}>
        <Pressable
          style={[styles.tab, viewMode === 'list' && styles.tabActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive, isDark && styles.tabTextDark]}>
            List
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === 'map' && styles.tabActive]}
          onPress={() => setViewMode('map')}
        >
          <Text style={[styles.tabText, viewMode === 'map' && styles.tabTextActive, isDark && styles.tabTextDark]}>
            Map
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, viewMode === 'saved' && styles.tabActive]}
          onPress={() => setViewMode('saved')}
        >
          <Text style={[styles.tabText, viewMode === 'saved' && styles.tabTextActive, isDark && styles.tabTextDark]}>
            Saved
          </Text>
        </Pressable>
      </View>

      {viewMode === 'list' ? (
        isLoading && gigs.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#73af17" />
          </View>
        ) : (
          <FlatList
            data={gigs}
            renderItem={renderGig}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              gigs.length === 0 && styles.listContentEmpty,
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
        )
      ) : viewMode === 'map' ? (
        <MarketplaceMap
          gigs={gigs}
          userLocation={userLocation}
          onMarkerPress={handleGigPress}
        />
      ) : (
        savedLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#73af17" />
          </View>
        ) : (
          <FlatList
            data={savedGigs}
            renderItem={renderGig}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              savedGigs.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons
                  name="heart-outline"
                  size={64}
                  color={isDark ? '#6B7280' : '#9CA3AF'}
                />
                <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
                  No saved gigs
                </Text>
                <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
                  Save gigs you're interested in to view them here
                </Text>
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={savedRefetching}
                onRefresh={refetchSaved}
                tintColor="#73af17"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        )
      )}
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewToggle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  viewToggleActive: {
    backgroundColor: '#73af17',
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  tabBarDark: {
    borderBottomColor: '#374151',
    backgroundColor: '#000000',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#73af17',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#73af17',
    fontWeight: '600',
  },
  tabTextDark: {
    color: '#9CA3AF',
  },
});
