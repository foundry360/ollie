import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { getReviewsForUser } from '@/lib/api/reviews';
import { Review } from '@/lib/api/reviews';
import { format } from 'date-fns';

interface ReviewsModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export function ReviewsModal({ visible, userId, onClose }: ReviewsModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [reviews, setReviews] = useState<Array<Review & { reviewer_name?: string; reviewer_photo?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && userId) {
      loadReviews();
    } else {
      // Reset state when modal closes
      setReviews([]);
      setLoading(false);
      setError(null);
    }
  }, [visible, userId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      setError(null);
      const userReviews = await getReviewsForUser(userId);
      setReviews(userReviews);
    } catch (err: any) {
      console.error('Error loading reviews:', err);
      setError(err.message || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <BottomSheet visible={visible} onClose={onClose} title={`Reviews (${reviews.length})`}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={true}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#73af17" />
            <Text style={[styles.loadingText, textStyle]}>Loading reviews...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.errorText, titleStyle]}>Error</Text>
            <Text style={[styles.errorSubtext, textStyle]}>{error}</Text>
          </View>
        ) : reviews.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name="star-outline" 
              size={64} 
              color={isDark ? '#6B7280' : '#9CA3AF'} 
            />
            <Text style={[styles.emptyText, titleStyle]}>No reviews yet</Text>
            <Text style={[styles.emptySubtext, textStyle]}>
              Reviews from neighbors will appear here after completed gigs
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View key={review.id} style={[styles.reviewItem, cardStyle]}>
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
                      size={16}
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
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 600,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
  reviewsList: {
    gap: 12,
  },
  reviewItem: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#73af1720',
    borderColor: '#1F2937',
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
  reviewDate: {
    fontSize: 12,
  },
  reviewDateLight: {
    color: '#6B7280',
  },
  reviewDateDark: {
    color: '#9CA3AF',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 8,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  textLight: {
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
});











