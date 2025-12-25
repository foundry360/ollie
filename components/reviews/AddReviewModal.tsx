import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createReview } from '@/lib/api/reviews';

interface AddReviewModalProps {
  visible: boolean;
  teenlancerId?: string; // For neighbors reviewing teenlancers
  neighborId?: string; // For teenlancers reviewing neighbors
  onClose: () => void;
  onReviewAdded: () => void;
}

export function AddReviewModal({ visible, teenlancerId, neighborId, onClose, onReviewAdded }: AddReviewModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      // Reset form when modal opens
      setRating(0);
      setComment('');
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      const revieweeId = teenlancerId || neighborId;
      if (!revieweeId) {
        Alert.alert('Error', 'Invalid review target');
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/AddReviewModal.tsx:127',message:'AddReviewModal BEFORE createReview',data:{revieweeId,teenlancerId,neighborId,rating,hasComment:!!comment.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log('AddReviewModal - Creating review:', { revieweeId, rating });
      
      const review = await createReview({
        gig_id: null, // Reviews are independent of gigs - neighbors can review at any time
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/AddReviewModal.tsx:140',message:'AddReviewModal AFTER createReview',data:{reviewId:review.id,revieweeId:review.reviewee_id,reviewerId:review.reviewer_id,rating:review.rating},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log('AddReviewModal - Review created:', review);
      console.log('AddReviewModal - Review reviewee_id:', review.reviewee_id, 'Review reviewer_id:', review.reviewer_id);

      // Call onReviewAdded BEFORE closing to ensure query invalidation happens
      onReviewAdded();
      
      Alert.alert('Success', 'Review submitted successfully!', [
        { text: 'OK', onPress: () => {
          onClose();
        }}
      ]);
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/reviews/AddReviewModal.tsx:150',message:'AddReviewModal ERROR creating review',data:{errorMessage:error?.message,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Error creating review:', error);
      Alert.alert('Error', error.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const inputStyle = isDark ? styles.inputDark : styles.inputLight;
  const inputTextStyle = isDark ? styles.inputTextDark : styles.inputTextLight;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Review">
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Rating Selection */}
            <View style={styles.section}>
              <Text style={[styles.label, titleStyle]}>Rating *</Text>
              <View style={styles.ratingContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}
                  >
                    <Ionicons
                      name={star <= rating ? 'star' : 'star-outline'}
                      size={40}
                      color={star <= rating ? '#FBBF24' : '#D1D5DB'}
                    />
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Comment */}
            <View style={styles.section}>
              <Text style={[styles.label, titleStyle]}>Comment (optional)</Text>
              <TextInput
                style={[styles.textArea, inputStyle, inputTextStyle]}
                value={comment}
                onChangeText={setComment}
                placeholder={neighborId ? "Share your experience working with this neighbor..." : "Share your experience working with this teenlancer..."}
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

        {/* Submit Button */}
        <Button
          title="Submit Review"
          onPress={handleSubmit}
          loading={submitting}
          disabled={rating === 0 || submitting}
          fullWidth
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    maxHeight: 600,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  starButton: {
    padding: 4,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    fontSize: 16,
  },
  inputLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  inputDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  inputTextLight: {
    color: '#111827',
  },
  inputTextDark: {
    color: '#F9FAFB',
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
