import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Linking, Modal, Dimensions, Pressable, Platform } from 'react-native';
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
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/ui/Loading';
import { useQueryClient } from '@tanstack/react-query';
import { teenStatsKeys } from '@/hooks/useTeenStats';

interface ProfileModalProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

export function ProfileModal({ visible, userId, onClose }: ProfileModalProps) {
  const { colorScheme } = useThemeStore();
  const { user: currentUser } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isDark = colorScheme === 'dark';
  
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [reviews, setReviews] = useState<Array<Review & { reviewer_name?: string; reviewer_photo?: string }>>([]);
  const [ratingDistribution, setRatingDistribution] = useState<{ [key: number]: number }>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [showAddReviewModal, setShowAddReviewModal] = useState(false);
  const [existingGigId, setExistingGigId] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const isNeighbor = currentUser?.role === 'poster';
  const isTeenlancerProfile = profile?.role === 'teen';

  // Format name to show first name and last initial
  const formatReviewerName = (fullName: string | undefined | null): string => {
    if (!fullName) return 'Anonymous';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0].toUpperCase();
    return `${firstName} ${lastInitial}.`;
  };

  useEffect(() => {
    if (visible && userId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProfileModal.tsx:40',message:'Modal opened - initial state',data:{visible,userId,isNeighbor,isDark,headerZIndex:10,scrollWrapperMarginTop:80},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      loadProfile();
      if (isNeighbor && userId) {
        findExistingGig();
      }
    } else {
      // Reset state when modal closes
      setProfile(null);
      setLoading(true);
      setError(null);
      setRating(0);
      setReviewCount(0);
      setReviews([]);
      setShowAddReviewModal(false);
      setExistingGigId(null);
    }
  }, [visible, userId, isNeighbor]);

  const findExistingGig = async () => {
    if (!currentUser?.id || !userId) return;
    
    try {
      // Find gigs with existing messages between the neighbor and teenlancer
      // Prioritize gigs where they've already been communicating (not completed or cancelled)
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select(`
          gig_id,
          created_at,
          gigs!inner(id, poster_id, teen_id, status)
        `)
        .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });

      if (!messagesError && messages && messages.length > 0) {
        // Find the most recent message where:
        // 1. The gig belongs to the current user (poster)
        // 2. The gig is not completed or cancelled
        // 3. The message involves the teenlancer
        for (const msg of messages) {
          const gig = (msg as any).gigs;
          if (!gig || gig.poster_id !== currentUser.id) continue;
          if (gig.status === 'completed' || gig.status === 'cancelled') continue;
          
          // Check if this message involves the teenlancer
          const { data: messageWithTeen } = await supabase
            .from('messages')
            .select('id')
            .eq('gig_id', gig.id)
            .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
            .limit(1)
            .single();

          if (messageWithTeen) {
            setExistingGigId(gig.id);
            return;
          }
        }
      }

      // If no messages, find gigs where the teenlancer is assigned (not completed or cancelled)
      const { data: assignedGigs, error: assignedError } = await supabase
        .from('gigs')
        .select('id')
        .eq('poster_id', currentUser.id)
        .eq('teen_id', userId)
        .neq('status', 'completed')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(1);

      if (assignedError) throw assignedError;
      if (assignedGigs && assignedGigs.length > 0) {
        setExistingGigId(assignedGigs[0].id);
        return;
      }

      // If no assigned gig, find the most recent gig where the teenlancer has applied
      const { data: myGigs, error: myGigsError } = await supabase
        .from('gigs')
        .select('id')
        .eq('poster_id', currentUser.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (myGigsError) throw myGigsError;
      if (myGigs && myGigs.length > 0) {
        const gigIds = myGigs.map(g => g.id);
        const { data: applications, error: appError } = await supabase
          .from('gig_applications')
          .select('gig_id')
          .eq('teen_id', userId)
          .eq('status', 'pending')
          .in('gig_id', gigIds)
          .order('created_at', { ascending: false })
          .limit(1);

        if (appError) throw appError;
        if (applications && applications.length > 0) {
          setExistingGigId(applications[0].gig_id);
        }
      }
    } catch (error) {
      console.error('Error finding existing gig:', error);
    }
  };

  const handleMessagePress = () => {
    if (existingGigId && userId) {
      // Navigate to chat with recipientId to ensure proper conversation routing
      // This is especially important for open gigs where the neighbor needs to specify which applicant
      router.push(`/chat/${existingGigId}?recipientId=${userId}`);
      onClose();
    } else {
      // Fallback to messages screen if no gig found
      router.push('/(tabs)/messages');
      onClose();
    }
  };

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
        
        // Calculate rating distribution
        const distribution: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        userReviews.forEach((review) => {
          const ratingValue = review.rating;
          if (ratingValue >= 1 && ratingValue <= 5) {
            distribution[ratingValue] = (distribution[ratingValue] || 0) + 1;
          }
        });
        setRatingDistribution(distribution);
      } catch (reviewsError) {
        console.log('Could not fetch reviews:', reviewsError);
        setReviews([]);
        setRatingDistribution({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
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

  // Removed containerStyle - not used
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
          {/* #region agent log */}
          {(() => {
            fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProfileModal.tsx:270',message:'ModalContent render',data:{hasOverflow:false,flexDirection:'column'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            return null;
          })()}
          {/* #endregion */}
          {isNeighbor && (
            <View style={styles.greenHeaderBackground} />
          )}
          <View style={[styles.modalHeader, headerStyle, isNeighbor && styles.modalHeaderWithGreen]}>
            {/* #region agent log */}
            {(() => {
              const headerBg = isNeighbor ? 'transparent' : (isDark ? '#000000' : '#FFFFFF');
              fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProfileModal.tsx:284',message:'Header render - BEFORE ScrollView (original solution)',data:{isNeighbor,isDark,headerBg,zIndex:100,position:'absolute',renderedBeforeScrollView:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'C'})}).catch(()=>{});
              return null;
            })()}
            {/* #endregion */}
            <View style={[styles.handle, isNeighbor && styles.handleOnGreen]} />
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, titleStyle, isNeighbor && styles.modalTitleOnGreen]}>
                Teenlancer Profile
              </Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isNeighbor ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#111827')} />
              </Pressable>
            </View>
          </View>

          <View style={styles.scrollWrapper}>
          {loading ? (
            <Loading />
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
              ref={scrollViewRef}
              style={styles.scrollView} 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              bounces={false}
              contentInsetAdjustmentBehavior="never"
              onScroll={(e) => {
                // #region agent log
                const scrollY = e.nativeEvent.contentOffset.y;
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ProfileModal.tsx:300',message:'Scroll event - checking if content goes over header',data:{scrollY,contentHeight:e.nativeEvent.contentSize.height,layoutHeight:e.nativeEvent.layoutMeasurement.height,scrollWrapperPaddingTop:75,avatarMarginTop:-25},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
              }}
              scrollEventThrottle={16}
            >
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

              {/* Reviews from Neighbors */}
              <View style={[styles.section, styles.reviewsSection, cardStyle]}>
                <Text style={[styles.sectionTitle, titleStyle]}>
                  Reviews from Neighbors ({reviewCount})
                </Text>
                {reviews.length > 0 ? (
                  <>
                    {/* Rating Breakdown Bar Chart */}
                    <View style={[styles.ratingBreakdownContainer, isDark && styles.ratingBreakdownContainerDark]}>
                      <View style={styles.overallRatingContainer}>
                        <Text style={[styles.overallRatingText, textStyle]}>
                          Overall Rating
                        </Text>
                        <View style={styles.overallRatingValue}>
                          <Text style={[styles.overallRatingNumber, textStyle]}>
                            {rating > 0 ? rating.toFixed(1) : '0.0'}
                          </Text>
                          <Text style={[styles.overallRatingCount, isDark ? styles.overallRatingCountDark : styles.overallRatingCountLight]}>
                            ({reviewCount})
                          </Text>
                          <View style={styles.overallRatingStars}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Ionicons
                                key={star}
                                name={star <= Math.round(rating) ? 'star' : 'star-outline'}
                                size={16}
                                color="#F59E0B"
                              />
                            ))}
                          </View>
                        </View>
                      </View>
                      {[5, 4, 3, 2, 1].map((starRating) => {
                        const count = ratingDistribution[starRating] || 0;
                        const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0;
                        return (
                          <View key={starRating} style={styles.ratingBarRow}>
                            <View style={styles.ratingBarLabel}>
                              <Text style={[styles.ratingBarStarText, textStyle]}>
                                {starRating}
                              </Text>
                              <Ionicons name="star" size={12} color="#F59E0B" />
                            </View>
                            <View style={styles.ratingBarContainer}>
                              <View 
                                style={[
                                  styles.ratingBar,
                                  { width: `${percentage}%` },
                                  isDark && styles.ratingBarDark
                                ]}
                              />
                            </View>
                            <View style={styles.ratingBarStats}>
                              <Text style={[styles.ratingBarCount, textStyle]}>
                                {count}
                              </Text>
                              <Text style={[styles.ratingBarPercentage, isDark ? styles.ratingBarPercentageDark : styles.ratingBarPercentageLight]}>
                                {percentage > 0 ? percentage.toFixed(0) : '0'}%
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
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
                              {formatReviewerName(review.reviewer_name)}
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
                  </>
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
                  </View>
                )}
                {isNeighbor && isTeenlancerProfile && (
                  <View style={styles.addReviewButtonContainer}>
                    <Pressable
                      style={[styles.addReviewButton, isDark && styles.addReviewButtonDark]}
                      onPress={() => setShowAddReviewModal(true)}
                    >
                      <Text style={styles.addReviewButtonText}>Add Review</Text>
                    </Pressable>
                  </View>
                )}
              </View>

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

          {/* Avatar - rendered outside ScrollView to appear above header */}
          {profile && (
            <View style={styles.avatarContainer}>
              {profile.profile_photo_url ? (
                <Image 
                  source={{ uri: profile.profile_photo_url }} 
                  style={[styles.avatar, isNeighbor && styles.avatarWhiteBorder]}
                />
              ) : (
                <View style={[
                  styles.avatarPlaceholder, 
                  isDark && styles.avatarPlaceholderDark,
                  isNeighbor && styles.avatarPlaceholderWhiteBorder
                ]}>
                  <Ionicons name="person" size={60} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </View>
              )}
            </View>
          )}

          {/* Floating Message Pill for Neighbors viewing Teenlancer profiles */}
          {isNeighbor && isTeenlancerProfile && profile && (
            <Pressable 
              style={styles.floatingMessageBubble}
              onPress={handleMessagePress}
            >
              <View style={styles.floatingMessageContent}>
                {profile.profile_photo_url ? (
                  <Image
                    source={{ uri: profile.profile_photo_url }}
                    style={styles.floatingAvatar}
                  />
                ) : (
                  <View style={styles.floatingAvatarPlaceholder}>
                    <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </View>
                )}
                <View style={styles.floatingMessageIcon}>
                  <Ionicons name="chatbubble" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}
        </View>
      </View>
      <AddReviewModal
        visible={showAddReviewModal}
        teenlancerId={userId || undefined}
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
              
              // Invalidate teen stats query so the home screen stat card updates
              queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
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
    overflow: 'hidden',
  },
  modalLight: {
    backgroundColor: '#FFFFFF',
  },
  modalDark: {
    backgroundColor: '#000000',
  },
  greenHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#73af17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 0,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 10,
    backgroundColor: '#FFFFFF',
  },
  modalHeaderWithGreen: {
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  modalHeaderLight: {
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
    backgroundColor: '#000000',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  handleOnGreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
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
  modalTitleOnGreen: {
    color: '#FFFFFF',
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
  scrollWrapper: {
    flex: 1,
    paddingTop: 190,
    zIndex: 50,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    paddingTop: 0,
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
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    zIndex: 200,
    elevation: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#73af17',
  },
  avatarWhiteBorder: {
    borderColor: '#FFFFFF',
    borderWidth: 6,
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
  avatarPlaceholderWhiteBorder: {
    borderColor: '#FFFFFF',
    borderWidth: 6,
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
  reviewsSection: {
    marginBottom: 24,
  },
  cardLight: {
    backgroundColor: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
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
    backgroundColor: '#73af17',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#FFFFFF',
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
  ratingBreakdownContainer: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ratingBreakdownContainerDark: {
    borderBottomColor: '#374151',
  },
  overallRatingContainer: {
    marginBottom: 16,
  },
  overallRatingText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  overallRatingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overallRatingNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  overallRatingCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  overallRatingCountLight: {
    color: '#6B7280',
  },
  overallRatingCountDark: {
    color: '#9CA3AF',
  },
  overallRatingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ratingBarLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 40,
  },
  ratingBarStarText: {
    fontSize: 12,
    fontWeight: '500',
    width: 12,
  },
  ratingBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  ratingBar: {
    height: '100%',
    backgroundColor: '#73af17',
    borderRadius: 4,
  },
  ratingBarDark: {
    backgroundColor: '#73af17',
  },
  ratingBarStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 75,
    justifyContent: 'flex-end',
  },
  ratingBarCount: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'right',
  },
  ratingBarPercentage: {
    fontSize: 12,
    fontWeight: '500',
    width: 40,
    textAlign: 'right',
  },
  ratingBarPercentageLight: {
    color: '#6B7280',
  },
  ratingBarPercentageDark: {
    color: '#9CA3AF',
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
    marginBottom: 0,
  },
  emptyReviewsSubtextLight: {
    color: '#6B7280',
  },
  emptyReviewsSubtextDark: {
    color: '#9CA3AF',
  },
  addReviewButtonContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#73af17',
  },
  addReviewButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#73af17',
  },
  addReviewButtonText: {
    fontSize: 12,
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
    backgroundColor: 'transparent',
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
  floatingMessageBubble: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 100,
  },
  floatingMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#73af17',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#73af17',
  },
  floatingAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#73af17',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingMessageIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
  },
  availabilityContainer: {
    gap: 8,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  availabilityDay: {
    fontSize: 14,
    fontWeight: '500',
    width: 100,
    flexShrink: 0,
  },
  availabilityTime: {
    fontSize: 14,
    marginLeft: 16,
  },
  noAvailabilityText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
});
