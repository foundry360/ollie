import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
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
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
          setLocationError(null);
        } else {
          setLocationError('Location permission denied');
        }
      } catch (error: any) {
        console.error('Error getting location:', error);
        setLocationError(error.message || 'Failed to get location');
      }
    };

    getUserLocation();
  }, []);

  const { data: tasks = [], isLoading, error: tasksError } = useTasksNearUser(userLocation, 10);

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

  if (isLoading || !userLocation) {
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

  if (locationError) {
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
          <Text style={[styles.emptyText, textStyle]}>Location unavailable</Text>
          <Text style={[styles.emptySubtext, textStyle]}>
            {locationError}
          </Text>
        </View>
      </View>
    );
  }

  if (tasksError) {
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

  if (tasks.length === 0) {
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
            {task.photos && task.photos.length > 0 ? (
              <Image 
                source={{ uri: task.photos[0] }} 
                style={styles.taskImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.taskImagePlaceholder}>
                <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
              </View>
            )}
            <View style={styles.taskContent}>
              <Text style={[styles.taskTitle, titleStyle]} numberOfLines={2}>
                {task.title}
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
                <Text style={[styles.timeText, textStyle]}>
                  {formatTimeAgo(task.created_at)}
                </Text>
              </View>
              {((task.required_skills && task.required_skills.length > 0) || task.status === 'open') && (
                <View style={styles.skillsRow}>
                  {task.required_skills && task.required_skills.length > 0 && (
                    <View style={styles.skillsContainer}>
                      {task.required_skills.slice(0, 2).map((skill, idx) => (
                        <View key={idx} style={[styles.skillTag, isDark && styles.skillTagDark]}>
                          <Text style={[styles.skillText, isDark && styles.skillTextDark]}>
                            {skill}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {task.status === 'open' && (
                    <View style={styles.applicantRow}>
                      <Ionicons name="people" size={14} color="#73af17" />
                      <Text style={[styles.applicantText, isDark && styles.applicantTextDark]}>
                        Applicants ({applicationCounts.get(task.id) || 0})
                      </Text>
                    </View>
                  )}
                </View>
              )}
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
    backgroundColor: '#000000',
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
    color: '#FFFFFF',
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
    minHeight: 120,
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  taskImage: {
    width: 120,
    alignSelf: 'stretch',
    backgroundColor: '#F3F4F6',
  },
  taskImagePlaceholder: {
    width: 120,
    alignSelf: 'stretch',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskContent: {
    flex: 1,
    padding: 12,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#000000',
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
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
    color: '#D1D5DB',
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
  },
  skillTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  skillTagDark: {
    backgroundColor: '#1E3A8A',
  },
  skillText: {
    fontSize: 10,
    color: '#73af17',
    fontWeight: '500',
  },
  skillTextDark: {
    color: '#93C5FD',
  },
  timeText: {
    fontSize: 10,
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
  loadingText: {
    fontSize: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});







