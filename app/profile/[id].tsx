import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getPublicUserProfile } from '@/lib/api/users';
import { getTeenCompletedTasks } from '@/lib/api/tasks';
import { getAverageRating } from '@/lib/api/reviews';
import { User } from '@/types';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    if (!id) {
      setError('Invalid profile ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch profile
      const userProfile = await getPublicUserProfile(id);
      if (!userProfile) {
        setError('Profile not found or not accessible. The profile may be private or the user may not be a teen.');
        setLoading(false);
        return;
      }
      setProfile(userProfile);

      // Fetch rating from reviews table
      try {
        const ratingData = await getAverageRating(id);
        setRating(ratingData.averageRating);
        setReviewCount(ratingData.reviewCount);
      } catch (ratingError) {
        // If reviews table doesn't exist yet or there's an error, fall back to 0
        console.log('Could not fetch ratings:', ratingError);
        setRating(0);
        setReviewCount(0);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Generate profile URL - use environment variable for localhost testing
  const baseUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://olliejobs.com';
  const profileUrl = id ? `${baseUrl}/profile/${id}` : '';
  
  const handleOpenMap = () => {
    if (!profile?.address) return;
    
    // Open address in maps app
    const encodedAddress = encodeURIComponent(profile.address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url).catch(err => console.error('Failed to open maps:', err));
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
          <Text style={[styles.loadingText, textStyle]}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.errorText, titleStyle]}>Profile Not Found</Text>
          <Text style={[styles.errorSubtext, textStyle]}>
            {error || 'This profile could not be loaded.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with back button */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, titleStyle]}>Teenlancer Profile</Text>
          </View>
        </View>

        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {profile.profile_photo_url ? (
            <Image 
              source={{ uri: profile.profile_photo_url }} 
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
              <Ionicons name="person" size={60} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={[styles.name, titleStyle]}>{profile.full_name}</Text>

        {/* Rating */}
        {reviewCount > 0 && (
          <View style={styles.ratingContainer}>
            <View style={styles.ratingStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= Math.round(rating) ? 'star' : 'star-outline'}
                  size={20}
                  color="#FBBF24"
                />
              ))}
            </View>
            <Text style={[styles.ratingText, textStyle]}>
              {rating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
            </Text>
          </View>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Skills</Text>
            <View style={styles.skillsContainer}>
              {profile.skills.map((skill, index) => (
                <View 
                  key={index} 
                  style={[styles.skillBubble, isDark && styles.skillBubbleDark]}
                >
                  <Text style={[styles.skillText, isDark && styles.skillTextDark]}>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Bio */}
        {profile.bio && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>About</Text>
            <Text style={[styles.bioText, textStyle]}>{profile.bio}</Text>
          </View>
        )}

        {/* QR Code */}
        {profileUrl && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Scan to Hire</Text>
            <View style={styles.qrContainer}>
              <View style={[styles.qrWrapper, isDark && styles.qrWrapperDark]}>
                <QRCode
                  value={profileUrl}
                  size={200}
                  color={isDark ? '#FFFFFF' : '#000000'}
                  backgroundColor={isDark ? '#111111' : '#FFFFFF'}
                />
              </View>
              <Text style={[styles.qrMessage, textStyle]}>
                Scan to hire me on Ollie
              </Text>
            </View>
          </View>
        )}

        {/* Location */}
        {profile.address && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Location</Text>
            <View style={styles.locationContainer}>
              <Ionicons 
                name="location-outline" 
                size={20} 
                color={isDark ? '#73af17' : '#73af17'} 
                style={styles.locationIcon}
              />
              <Text style={[styles.locationText, textStyle]}>{profile.address}</Text>
              <Ionicons 
                name="open-outline" 
                size={16} 
                color={isDark ? '#73af17' : '#73af17'} 
                onPress={handleOpenMap}
                style={styles.mapIcon}
              />
            </View>
          </View>
        )}

        {/* Reviews Section */}
        {reviewCount > 0 && (
          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>
              Reviews ({reviewCount})
            </Text>
            <View style={styles.reviewsContainer}>
              <Text style={[styles.reviewsPlaceholder, textStyle]}>
                {reviewCount} completed {reviewCount === 1 ? 'task' : 'tasks'}
              </Text>
              <Text style={[styles.reviewsNote, textStyle]}>
                Reviews from completed tasks will appear here
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#73af17',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#73af17',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#73af1720',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  skillBubbleDark: {
    backgroundColor: '#374151',
  },
  skillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  skillTextDark: {
    color: '#D1D5DB',
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  qrWrapperDark: {
    backgroundColor: '#111111',
  },
  qrMessage: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    marginRight: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 16,
  },
  mapIcon: {
    marginLeft: 4,
  },
  reviewsContainer: {
    paddingVertical: 8,
  },
  reviewsPlaceholder: {
    fontSize: 16,
    marginBottom: 8,
  },
  reviewsNote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#9CA3AF',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  labelLight: {
    color: '#6B7280',
  },
});





