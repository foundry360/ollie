import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, Linking, Modal, Dimensions, Pressable, Platform } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { getPublicUserProfile } from '@/lib/api/users';
import { getAverageRating, getReviewsForUser, Review } from '@/lib/api/reviews';
import { User } from '@/types';
import QRCode from 'react-native-qrcode-svg';
import { format } from 'date-fns';
import { AddReviewModal } from '@/components/reviews/AddReviewModal';
import { useAuthStore } from '@/stores/authStore';
import { formatAddress } from '@/lib/utils';

interface ProfileModalProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

export function ProfileModal({ visible, userId, onClose }: ProfileModalProps) {
  const { colorScheme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [reviews, setReviews] = useState<Array<Review & { reviewer_name?: string; reviewer_photo?: string }>>([]);
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  
  const isNeighbor = currentUser?.role === 'poster';

  useEffect(() => {
    if (visible && userId) {
      loadProfile();
    } else {
      // Reset state when modal closes
      setProfile(null);
      setLoading(true);
      setError(null);
      setRating(0);
      setReviewCount(0);
      setReviews([]);
      setShowAddReviewModal(false);
    }
  }, [visible, userId]);

  const loadProfile = async () => {
    if (!userId) {
      setError('Invalid profile ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Fetch profile
      const userProfile = await getPublicUserProfile(userId);
      if (!userProfile) {
        setError('Profile not found or not accessible. The profile may be private or the user may not be a teen.');
        setLoading(false);
        return;
      }
      setProfile(userProfile);

      // Fetch rating from reviews table
      try {
        const ratingData = await getAverageRating(userId);
        setRating(ratingData.averageRating);
        setReviewCount(ratingData.reviewCount);
      } catch (ratingError) {
        // If reviews table doesn't exist yet or there's an error, fall back to 0
        console.log('Could not fetch ratings:', ratingError);
        setRating(0);
        setReviewCount(0);
      }

      // Fetch individual reviews
      try {
        const userReviews = await getReviewsForUser(userId);
        setReviews(userReviews);
      } catch (reviewsError) {
        console.log('Could not fetch reviews:', reviewsError);
        setReviews([]);
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Generate profile URL
  const baseUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://olliejobs.com';
  const profileUrl = userId ? `${baseUrl}/profile/${userId}` : '';
  
  const handleOpenMap = () => {
    if (!profile?.address) return;
    
    // Open address in maps app
    const encodedAddress = encodeURIComponent(profile.address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url).catch(err => console.error('Failed to open maps:', err));
  };

  // Helper to convert 24-hour time to 12-hour format
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  const modalStyle = isDark ? styles.modalDark : styles.modalLight;
  const headerStyle = isDark ? styles.modalHeaderDark : styles.modalHeaderLight;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
        <View style={[styles.modalContent, modalStyle]}>
          <View style={[styles.modalHeader, headerStyle]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, titleStyle]}>Teenlancer Profile</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#73af17" />
              <Text style={[styles.loadingText, textStyle]}>Loading profile...</Text>
            </View>
          ) : error || !profile ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text style={[styles.errorText, titleStyle]}>Profile Not Found</Text>
              <Text style={[styles.errorSubtext, textStyle]}>
                {error || 'This profile could not be loaded.'}
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView} 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
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
                  {rating > 0 ? rating.toFixed(1) : '0.0'} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                </Text>
              </View>

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

              {/* Available Hours */}
              {profile.availability && (
                <View style={[styles.section, cardStyle]}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Available Hours</Text>
                  <View style={styles.availabilityContainer}>
                    {Object.entries(profile.availability).map(([day, hours]) => {
                      if (!hours || !hours.start || !hours.end) return null;
                      const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                      return (
                        <View key={day} style={styles.availabilityRow}>
                          <Text style={[styles.availabilityDay, textStyle]}>{dayName}</Text>
                          <Text style={[styles.availabilityTime, textStyle]}>
                            {formatTime12Hour(hours.start)} - {formatTime12Hour(hours.end)}
                          </Text>
                        </View>
                      );
                    })}
                    {Object.values(profile.availability).every(h => !h || !h.start || !h.end) && (
                      <Text style={[styles.noAvailabilityText, textStyle]}>
                        No availability set
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Reviews from Neighbors */}
              <View style={[styles.section, cardStyle]}>
                <Text style={[styles.sectionTitle, titleStyle]}>
                  Reviews from Neighbors ({reviewCount})
                </Text>
                {reviews.length > 0 ? (
                  <View style={styles.reviewsList}>
                    {reviews.map((review) => (
                      <View key={review.id} style={[styles.reviewItem, isDark && styles.reviewItemDark]}>
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewerInfo}>
                            {review.reviewer_photo ? (
                              <Image 
                                source={{ uri: review.reviewer_photo }} 
                                style={styles.reviewerAvatar}
                              />
                            ) : (
                              <View style={[styles.reviewerAvatarPlaceholder, isDark && styles.reviewerAvatarPlaceholderDark]}>
                                <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              </View>
                            )}
                            <Text style={[styles.reviewerName, textStyle]}>
                              {review.reviewer_name || 'Anonymous'}
                            </Text>
                          </View>
                          <Text style={[styles.reviewDate, isDark ? styles.reviewDateDark : styles.reviewDateLight]}>
                            {format(new Date(review.created_at), 'MMM d, yyyy')}
                          </Text>
                        </View>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= review.rating ? 'star' : 'star-outline'}
                              size={14}
                              color="#FBBF24"
                            />
                          ))}
                        </View>
                        {review.comment && (
                          <Text style={[styles.reviewComment, textStyle]}>{review.comment}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyReviewsContainer}>
                    <Ionicons 
                      name="star-outline" 
                      size={48} 
                      color={isDark ? '#6B7280' : '#9CA3AF'} 
                    />
                    <Text style={[styles.emptyReviewsText, textStyle]}>
                      Be the first to review
                    </Text>
                    <Text style={[styles.emptyReviewsSubtext, isDark ? styles.emptyReviewsSubtextDark : styles.emptyReviewsSubtextLight]}>
                      Share your experience working with this teenlancer
                    </Text>
                    {isNeighbor && (
                      <Pressable 
                        style={[styles.addReviewButton, isDark && styles.addReviewButtonDark]}
                        onPress={() => setShowAddReviewModal(true)}
                      >
                        <Ionicons name="add-circle-outline" size={20} color="#73af17" />
                        <Text style={styles.addReviewButtonText}>Add Review</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>

              {/* QR Code - Only show to teenlancer themselves, not to neighbors */}
              {profileUrl && !isNeighbor && (
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
                  <Pressable style={styles.locationContainer} onPress={handleOpenMap}>
                    <Ionicons 
                      name="location-outline" 
                      size={20} 
                      color="#73af17" 
                      style={styles.locationIcon}
                    />
                    <Text style={[styles.locationText, textStyle]}>
                      {(() => {
                        const { cityStateZip } = formatAddress(profile.address);
                        return cityStateZip || profile.address;
                      })()}
                    </Text>
                    <Ionicons 
                      name="open-outline" 
                      size={16} 
                      color="#73af17" 
                    />
                  </Pressable>
                </View>
              )}

            </ScrollView>
          )}
        </View>
      </View>
      <AddReviewModal
        visible={showAddReviewModal}
        teenlancerId={userId || ''}
        onClose={() => setShowAddReviewModal(false)}
        onReviewAdded={async () => {
          // Reload reviews and rating
          if (userId) {
            try {
              const ratingData = await getAverageRating(userId);
              setRating(ratingData.averageRating);
              setReviewCount(ratingData.reviewCount);
              
              const userReviews = await getReviewsForUser(userId);
              setReviews(userReviews);
            } catch (error) {
              console.error('Error reloading reviews:', error);
            }
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    maxHeight: Dimensions.get('window').height,
  },
  overlayPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Dimensions.get('window').height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'column',
  },
  modalDark: {
    backgroundColor: '#000000',
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLight: {
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    flexGrow: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 200,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#73af17',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#73af17',
  },
  avatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
  },
  section: {
    width: '100%',
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  cardLight: {
    backgroundColor: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillBubble: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillBubbleDark: {
    backgroundColor: '#1E3A8A',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#93C5FD',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 14,
  },
  reviewsList: {
    gap: 12,
  },
  emptyReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyReviewsText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyReviewsSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyReviewsSubtextLight: {
    color: '#6B7280',
  },
  emptyReviewsSubtextDark: {
    color: '#9CA3AF',
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#73af17',
  },
  addReviewButtonDark: {
    backgroundColor: '#1F2937',
    borderColor: '#73af17',
  },
  addReviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#73af17',
  },
  reviewItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reviewItemDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reviewerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  reviewerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
  },
  reviewDateLight: {
    color: '#6B7280',
  },
  reviewDateDark: {
    color: '#9CA3AF',
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
  },
  textLight: {
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  labelLight: {
    color: '#6B7280',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  availabilityContainer: {
    gap: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  availabilityDay: {
    fontSize: 14,
    fontWeight: '500',
  },
  availabilityTime: {
    fontSize: 14,
  },
  noAvailabilityText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
