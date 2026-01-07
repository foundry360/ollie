import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useMemo } from 'react';
import * as Location from 'expo-location';
import { useTasksNearUser } from '@/hooks/useTasks';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useGigApplicationCounts } from '@/hooks/useGigApplications';

export function TasksNearYou() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    // Get user's current location
    const getUserLocation = async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:25',message:'getUserLocation called',data:{userHasAddress:!!user?.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:30',message:'Location permission status',data:{status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:35',message:'Device location obtained',data:{latitude:location.coords.latitude,longitude:location.coords.longitude},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setLocationError(null);
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:43',message:'Location permission denied',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setLocationError('Location permission denied');
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:48',message:'Location error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        setLocationError(error.message || 'Failed to get location');
      }
    };

    getUserLocation();
  }, [user]);

  const { data: tasks = [], isLoading, error: tasksError } = useTasksNearUser(userLocation, 10);
  
  // #region agent log
  // All hooks must be at the top before any conditional returns
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:64',message:'TasksNearYou state check',data:{userLocation,locationError,tasksCount:tasks.length,isLoading,hasUserLocation:!!userLocation,hasProfileAddress:!!user?.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [userLocation, locationError, tasks.length, isLoading, user?.address]);
  
  useEffect(() => {
    if (!userLocation || locationError) {
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:70',message:'Location check - showing message',data:{userLocation:!!userLocation,locationError,userAddress:user?.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
  }, [userLocation, locationError, user?.address]);
  
  useEffect(() => {
    if (tasks.length > 0) {
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/home/TasksNearYou.tsx:76',message:'Rendering tasks',data:{tasksCount:tasks.length,userLocation:!!userLocation,locationError,userAddress:user?.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    }
  }, [tasks.length, userLocation, locationError, user?.address]);
  // #endregion

  // Get application counts for open gigs
  const openGigIds = useMemo(() => 
    tasks.filter(t => t.status === 'open').map(t => t.id),
    [tasks]
  );
  const { data: applicationCounts = new Map() } = useGigApplicationCounts(openGigIds);

  const handleSeeAll = () => {
    router.push('/(tabs)/'); // Navigate to marketplace
  };

  const handleTaskPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  if (isLoading) {
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        </View>
        <Text style={[styles.loadingText, textStyle]}>
          {!userLocation ? 'Getting your location...' : 'Loading nearby gigs...'}
        </Text>
      </View>
    );
  }

  // Show message if location is not available - check BOTH device location AND profile address
  // User must have an address in their profile to see nearby gigs
  const hasProfileAddress = !!user?.address;
  
  if (!userLocation || locationError || !hasProfileAddress) {
    const textStyle = isDark ? styles.textDark : styles.detailText;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="location-outline"
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>Update your location</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            {!hasProfileAddress 
              ? 'Add your address in your profile to see gigs near you'
              : 'Enable location services to see gigs near you'}
          </Text>
        </View>
      </View>
    );
  }

  if (tasksError) {
    const textStyle = isDark ? styles.textDark : styles.detailText;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>Error loading gigs</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            Please try again later
          </Text>
        </View>
      </View>
    );
  }

  // Don't show tasks if location is not available (double check to prevent cached data from showing)
  // This ensures we never show tasks when location is unavailable, even if React Query has cached data
  // Also check profile address - user must have address in profile (reuse hasProfileAddress from above)
  if (!userLocation || locationError || !hasProfileAddress) {
    const textStyle = isDark ? styles.textDark : styles.detailText;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="location-outline"
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>Update your location</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            {!hasProfileAddress 
              ? 'Add your address in your profile to see gigs near you'
              : 'Enable location services to see gigs near you'}
          </Text>
        </View>
      </View>
    );
  }

  if (tasks.length === 0) {
    const textStyle = isDark ? styles.textDark : styles.detailText;
    
    return (
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons
            name="location-outline"
            size={48}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <Text style={[styles.emptyText, textStyle]}>No gigs nearby</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            Check back later or browse all gigs
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text style={[styles.sectionTitle, titleStyle]}>Gigs Near You</Text>
        <Pressable onPress={handleSeeAll}>
          <Text style={styles.seeAllText}>View All</Text>
        </Pressable>
      </View>

      <View style={styles.cardsContainer}>
        {tasks.map((task) => (
          <Pressable
            key={task.id}
            style={[styles.taskCard, cardStyle]}
            onPress={() => handleTaskPress(task.id)}
            android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
          >
            <View style={styles.imageContainer}>
              {task.photos && task.photos.length > 0 ? (
                <OptimizedImage 
                  source={{ uri: task.photos[0] }} 
                  style={styles.taskImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View style={[styles.taskImagePlaceholder, isDark && styles.taskImagePlaceholderDark]}>
                  <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
                </View>
              )}
            </View>
            <View style={styles.taskContent}>
              <Text style={[styles.taskTitle, titleStyle]} numberOfLines={2}>
                {task.title}
              </Text>
              <Text style={[styles.description, isDark && styles.descriptionDark]} numberOfLines={1}>
                {task.description}
              </Text>
              <View style={styles.taskMeta}>
                  <View style={styles.metaLeft}>
                    <View style={styles.metaRow}>
                      <Ionicons name="cash" size={14} color="#73af17" />
                      <Text style={[styles.metaText, textStyle]}>${task.pay.toFixed(2)}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="location" size={14} color="#73af17" />
                      <Text style={[styles.metaText, textStyle]} numberOfLines={1}>
                        {task.distance.toFixed(1)} mi
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.timeText, isDark && styles.timeTextDark]}>
                    {formatTimeAgo(task.created_at)}
                  </Text>
                </View>
              </View>
          </Pressable>
        ))}
      </View>
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#000000',
  },
  seeAllText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '600',
  },
  cardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  taskCard: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    alignItems: 'stretch',
  },
  cardDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  imageContainer: {
    width: 100,
    padding: 10,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  taskImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  taskImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  taskImagePlaceholderDark: {
    backgroundColor: '#1F2937',
  },
  taskContent: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
    color: '#000000',
  },
  description: {
    fontSize: 12,
    marginBottom: 4,
    lineHeight: 16,
    color: '#6B7280',
  },
  descriptionDark: {
    color: '#374151',
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 0,
  },
  metaLeft: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#374151',
  },
  textDark: {
    color: '#374151',
  },
  skillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    paddingLeft: 0,
    marginLeft: 0,
  },
  skillTag: {
    backgroundColor: 'transparent',
    paddingLeft: 0,
    paddingRight: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillTagDark: {
    backgroundColor: 'transparent',
  },
  skillText: {
    fontSize: 10,
    color: '#73af17',
    fontWeight: '500',
  },
  skillTextDark: {
    color: '#73af17',
  },
  timeText: {
    fontSize: 10,
    color: '#6B7280',
  },
  timeTextDark: {
    color: '#6B7280',
  },
  applicantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  applicantText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  applicantTextDark: {
    color: '#D1D5DB',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});
















