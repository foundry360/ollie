import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { TeenlancerCard } from '@/components/teenlancers/TeenlancerCard';
import { TeenlancerFilters } from '@/components/teenlancers/TeenlancerFilters';
import { getTeenlancers, TeenlancerFilters as TeenlancerFiltersType, TeenlancerProfile } from '@/lib/api/users';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';

export default function SelectTeenlancerScreen() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  
  const [filters, setFilters] = useState<TeenlancerFiltersType>({});
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rating' | 'distance'>('rating');

  // Get available sort options based on active filters
  const getAvailableSortOptions = (): Array<'rating' | 'distance'> => {
    const options: Array<'rating' | 'distance'> = [];
    
    // If rating filter is selected, allow sorting by rating
    if (filters.minRating) {
      options.push('rating');
    }
    // If distance/radius filter is selected, allow sorting by distance
    // Note: distance sort requires both radius filter AND userLocation
    if (filters.radius) {
      // Check if we have userLocation or if we can calculate distance
      if (userLocation) {
        options.push('distance');
      }
    }
    
    return options;
  };

  // Update sortBy when filters change
  useEffect(() => {
    const options = getAvailableSortOptions();
    if (options.length > 0) {
      if (!options.includes(sortBy)) {
        setSortBy(options[0]);
      }
    }
  }, [filters.minRating, filters.radius, userLocation, sortBy]);

  // Ensure current sortBy is valid based on available options
  const availableSortOptions = getAvailableSortOptions();
  const currentSortBy = availableSortOptions.includes(sortBy) ? sortBy : availableSortOptions[0];

  // Get user location for distance calculation
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

    getLocation();
  }, []);


  const {
    data: teenlancers = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['teenlancers', filters, userLocation, currentSortBy],
    queryFn: () => getTeenlancers(filters, userLocation || undefined, currentSortBy),
    staleTime: 30000, // 30 seconds
  });

  const handleRefresh = () => {
    refetch();
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const headerStyle = isDark ? styles.headerDark : styles.headerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;

  const renderTeenlancer = ({ item }: { item: TeenlancerProfile }) => (
    <TeenlancerCard teenlancer={item} />
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name="people-outline"
        size={64}
        color={isDark ? '#6B7280' : '#9CA3AF'}
      />
      <Text style={[styles.emptyText, isDark && styles.emptyTextDark]}>
        {isLoading ? 'Loading teenlancers...' : 'No teenlancers found'}
      </Text>
      <Text style={[styles.emptySubtext, isDark && styles.emptySubtextDark]}>
        {isLoading
          ? 'Please wait while we fetch available teenlancers'
          : 'Try adjusting your filters or check back later'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, titleStyle]}>Select a Teenlancer</Text>
          <View style={styles.headerActions}>
            <TeenlancerFilters filters={filters} onFiltersChange={setFilters} />
          </View>
        </View>
      </View>

      {/* Active Filters and Sort */}
      {((filters.minRating || (filters.skills && filters.skills.length > 0) || filters.radius) || getAvailableSortOptions().length > 0) && (
        <View style={[styles.filtersContainer, isDark && styles.filtersContainerDark]}>
          <View style={styles.filtersRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersScrollContent}
              style={styles.filtersScrollView}
            >
              {filters.minRating && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    {filters.minRating}+
                  </Text>
                  <Ionicons name="star" size={12} color="#FFFFFF" />
                </View>
              )}
              {filters.skills && filters.skills.map((skill) => (
                <View key={skill} style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    {skill}
                  </Text>
                </View>
              ))}
              {filters.radius && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>
                    {filters.radius} mi
                  </Text>
                </View>
              )}
            </ScrollView>
            <Pressable
              onPress={() => {
                const options = getAvailableSortOptions();
                const currentIndex = options.indexOf(currentSortBy);
                const nextIndex = (currentIndex + 1) % options.length;
                setSortBy(options[nextIndex]);
              }}
            >
              <View style={styles.sortByContainer}>
                <Text style={[styles.sortByText, isDark && styles.sortByTextDark]}>
                  Sorted by: {currentSortBy === 'rating' ? 'Rating' : 'Distance'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
            </Pressable>
          </View>
        </View>
      )}

      {isLoading && teenlancers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
        </View>
      ) : (
        <FlatList
          data={teenlancers}
          renderItem={renderTeenlancer}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            teenlancers.length === 0 && styles.listContentEmpty,
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
      )}
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
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersContainerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#374151',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filtersScrollView: {
    flex: 1,
    marginRight: 12,
  },
  filtersScrollContent: {
    gap: 8,
  },
  sortByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortByText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  sortByTextDark: {
    color: '#9CA3AF',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#73af17',
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },
});

