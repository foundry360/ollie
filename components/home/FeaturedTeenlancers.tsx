import { View, Text, StyleSheet, FlatList, Image, Pressable, Dimensions } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useFeaturedTeenlancers } from '@/hooks/useFeaturedTeenlancers';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { ProfileModal } from '@/components/profile/ProfileModal';
import * as Location from 'expo-location';
import { useAuthStore } from '@/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';

export function FeaturedTeenlancers() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  const [selectedTeenId, setSelectedTeenId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [neighborLocation, setNeighborLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const flatListRef = useRef<FlatList>(null);

  // Get neighbor's location
  useEffect(() => {
    const getLocation = async () => {
      if (user?.role !== 'poster') {
        console.log('FeaturedTeenlancers: User is not a poster, skipping location fetch');
        return;
      }
      
      console.log('FeaturedTeenlancers: Requesting location permission...');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('FeaturedTeenlancers: Location permission denied');
          return;
        }

        console.log('FeaturedTeenlancers: Getting current position...');
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const loc = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        console.log('FeaturedTeenlancers: Location obtained:', loc);
        setNeighborLocation(loc);
      } catch (error) {
        console.error('FeaturedTeenlancers: Error getting location:', error);
      }
    };

    getLocation();
  }, [user?.role]);

  console.log('FeaturedTeenlancers: Render with location:', neighborLocation);
  const { data: teenlancers = [], isLoading, error } = useFeaturedTeenlancers(10, neighborLocation);
  console.log('FeaturedTeenlancers: Query result:', { 
    count: teenlancers.length, 
    isLoading, 
    error: error?.message,
    teenlancers: teenlancers.map(t => ({ id: t.id, name: t.full_name }))
  });

  // Create infinite loop by duplicating the teenlancers array
  const loopedTeenlancers = teenlancers.length > 0 ? [...teenlancers, ...teenlancers, ...teenlancers] : [];
  const initialIndex = teenlancers.length; // Start at the middle set

  // Scroll to the middle set when data loads - must be before conditional returns
  useEffect(() => {
    if (teenlancers.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [teenlancers.length, initialIndex]);

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Featured Teenlancers</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    console.error('Error loading featured teenlancers:', error);
  }

  if (teenlancers.length === 0) {
    return null;
  }

  const handlePress = (teenId: string) => {
    setSelectedTeenId(teenId);
    setShowProfileModal(true);
  };

  const handleCloseModal = () => {
    setShowProfileModal(false);
    setSelectedTeenId(null);
  };

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = 280;
  const cardGap = 12;
  const snapInterval = cardWidth + cardGap;
  const sidePadding = (screenWidth - cardWidth) / 2;

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / snapInterval);
    
    // If we're at the first set, jump to the middle set
    if (currentIndex < teenlancers.length / 2) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: currentIndex + teenlancers.length, 
          animated: false 
        });
      }, 50);
    }
    // If we're at the last set, jump to the middle set
    else if (currentIndex >= teenlancers.length * 2.5) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: currentIndex - teenlancers.length, 
          animated: false 
        });
      }, 50);
    }
  };

  const renderCard = ({ item: teen }: { item: typeof teenlancers[0] }) => (
    <Pressable
      style={[styles.card, { marginHorizontal: cardGap / 2 }]}
      onPress={() => handlePress(teen.id)}
      android_ripple={{ color: 'rgba(255, 255, 255, 0.1)' }}
    >
      {/* Subtle background pattern */}
      <View style={styles.backgroundPattern}>
        {/* Subtle gradient overlay */}
        <LinearGradient
          colors={['rgba(115, 175, 23, 0.95)', 'rgba(90, 138, 18, 0.98)', 'rgba(115, 175, 23, 0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Subtle circular pattern elements */}
        <View style={styles.patternCircle1} />
        <View style={styles.patternCircle2} />
        <View style={styles.patternCircle3} />
        <View style={styles.patternCircle4} />
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={styles.leftContent}>
            <Text style={styles.name} numberOfLines={1}>
              {teen.full_name}
            </Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFD700" />
              <Text style={styles.rating}>{teen.rating.toFixed(1)}</Text>
              <Text style={styles.reviewCount}>({teen.reviewCount})</Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            {teen.profile_photo_url ? (
              <Image
                source={{ uri: teen.profile_photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color="#FFFFFF" />
              </View>
            )}
          </View>
        </View>
        <View style={styles.skillsContainer}>
          {teen.skills.slice(0, 3).map((skill, index) => (
            <View key={index} style={styles.skillChip}>
              <Text style={styles.skillText} numberOfLines={1}>
                {skill}
              </Text>
            </View>
          ))}
          {teen.skills.length > 3 && (
            <Text style={styles.moreSkills}>+{teen.skills.length - 3}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Featured Teenlancers</Text>
      <FlatList
        ref={flatListRef}
        data={loopedTeenlancers}
        renderItem={renderCard}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.carousel,
          { paddingHorizontal: sidePadding }
        ]}
        getItemLayout={(data, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={(info) => {
          // Handle scroll to index failure
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
      />
      {selectedTeenId && (
        <ProfileModal
          visible={showProfileModal}
          userId={selectedTeenId}
          onClose={handleCloseModal}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    color: '#6B7280',
  },
  textDark: {
    color: '#D1D5DB',
  },
  carousel: {
    // Padding handled dynamically for centering
  },
  card: {
    width: 280,
    borderRadius: 12,
    backgroundColor: '#73af17',
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    overflow: 'hidden',
  },
  patternCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    top: -40,
    right: -40,
  },
  patternCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    bottom: -20,
    left: -20,
  },
  patternCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    top: '50%',
    left: '20%',
    transform: [{ translateY: -30 }],
  },
  patternCircle4: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    bottom: 20,
    right: 30,
  },
  cardContent: {
    flexDirection: 'column',
    padding: 16,
    position: 'relative',
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  reviewCount: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    alignItems: 'center',
    width: '100%',
  },
  skillChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    flexShrink: 1,
    minWidth: 0,
  },
  skillText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  moreSkills: {
    fontSize: 11,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  avatarContainer: {
    width: 60,
    height: 60,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

