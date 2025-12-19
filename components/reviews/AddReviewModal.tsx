import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createReview, canReviewGig } from '@/lib/api/reviews';
import { supabase } from '@/lib/supabase';
import { Task } from '@/types';

interface AddReviewModalProps {
  visible: boolean;
  teenlancerId: string;
  onClose: () => void;
  onReviewAdded: () => void;
}

export function AddReviewModal({ visible, teenlancerId, onClose, onReviewAdded }: AddReviewModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  const [availableGigs, setAvailableGigs] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && teenlancerId) {
      loadAvailableGigs();
    } else {
      // Reset form when modal closes
      setRating(0);
      setComment('');
      setSelectedGigId(null);
      setAvailableGigs([]);
    }
  }, [visible, teenlancerId]);

  const loadAvailableGigs = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in to leave a review');
        return;
      }

      // Get completed gigs where the current user is the poster and the teenlancer is assigned
      const { data: gigs, error } = await supabase
        .from('gigs')
        .select('*')
        .eq('poster_id', user.id)
        .eq('teen_id', teenlancerId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter gigs that can be reviewed (not already reviewed)
      const reviewableGigs: Task[] = [];
      for (const gig of gigs || []) {
        const canReview = await canReviewGig(gig.id);
        if (canReview.canReview) {
          reviewableGigs.push(gig as Task);
        }
      }

      setAvailableGigs(reviewableGigs);
      
      // Auto-select the first gig if only one available
      if (reviewableGigs.length === 1) {
        setSelectedGigId(reviewableGigs[0].id);
      }
    } catch (error: any) {
      console.error('Error loading available gigs:', error);
      Alert.alert('Error', error.message || 'Failed to load available gigs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedGigId) {
      Alert.alert('Error', 'Please select a gig to review');
      return;
    }

    if (rating === 0) {
      Alert.alert('Error', 'Please select a rating');
      return;
    }

    try {
      setSubmitting(true);
      await createReview({
        gig_id: selectedGigId,
        reviewee_id: teenlancerId,
        rating,
        comment: comment.trim() || undefined,
      });

      Alert.alert('Success', 'Review submitted successfully!', [
        { text: 'OK', onPress: () => {
          onReviewAdded();
          onClose();
        }}
      ]);
    } catch (error: any) {
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
  const gigCardStyle = isDark ? styles.gigCardDark : styles.gigCardLight;
  const selectedGigCardStyle = isDark ? styles.selectedGigCardDark : styles.selectedGigCardLight;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Review">
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#73af17" />
            <Text style={[styles.loadingText, textStyle]}>Loading available gigs...</Text>
          </View>
        ) : availableGigs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-circle-outline" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.emptyText, titleStyle]}>No gigs available for review</Text>
            <Text style={[styles.emptySubtext, textStyle]}>
              You can only review completed gigs that you haven't reviewed yet.
            </Text>
          </View>
        ) : (
          <>
            {/* Gig Selection */}
            {availableGigs.length > 1 && (
              <View style={styles.section}>
                <Text style={[styles.label, titleStyle]}>Select Gig</Text>
                <View style={styles.gigsList}>
                  {availableGigs.map((gig) => (
                    <Pressable
                      key={gig.id}
                      style={[
                        styles.gigCard,
                        gigCardStyle,
                        selectedGigId === gig.id && styles.selectedGigCard,
                        selectedGigId === gig.id && selectedGigCardStyle,
                      ]}
                      onPress={() => setSelectedGigId(gig.id)}
                    >
                      <View style={styles.gigCardContent}>
                        <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                          {gig.title}
                        </Text>
                        <Text style={[styles.gigDate, textStyle]}>
                          {new Date(gig.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {selectedGigId === gig.id && (
                        <Ionicons name="checkmark-circle" size={24} color="#73af17" />
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

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
                placeholder="Share your experience working with this teenlancer..."
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
              disabled={!selectedGigId || rating === 0 || submitting}
              fullWidth
            />
          </>
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  gigsList: {
    gap: 12,
  },
  gigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  gigCardLight: {
    backgroundColor: '#F9FAFB',
  },
  gigCardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  selectedGigCard: {
    borderColor: '#73af17',
  },
  selectedGigCardLight: {
    backgroundColor: '#F0FDF4',
  },
  selectedGigCardDark: {
    backgroundColor: '#1F2937',
  },
  gigCardContent: {
    flex: 1,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  gigDate: {
    fontSize: 12,
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
    backgroundColor: '#000000',
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
