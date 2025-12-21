import { supabase } from '@/lib/supabase';

export interface Review {
  id: string;
  gig_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewData {
  gig_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment?: string;
}

export interface UpdateReviewData {
  rating?: number;
  comment?: string;
}

// Get reviews for a specific user (as reviewee) with reviewer information
export async function getReviewsForUser(userId: string): Promise<Array<Review & { reviewer_name?: string; reviewer_photo?: string }>> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      reviewer:users!reviewer_id(id, full_name, profile_photo_url, role)
    `)
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((review: any) => ({
    ...review,
    reviewer_name: review.reviewer?.full_name,
    reviewer_photo: review.reviewer?.profile_photo_url,
  }));
}

// Get reviews written by a specific user (as reviewer)
export async function getReviewsByUser(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get review for a specific gig by the current user
export async function getReviewForGig(gigId: string): Promise<Review | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('gig_id', gigId)
    .eq('reviewer_id', user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No review found
      return null;
    }
    throw error;
  }
  return data;
}

// Get all reviews for a specific gig
export async function getReviewsForGig(gigId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('gig_id', gigId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Calculate average rating for a user
export async function getAverageRating(userId: string): Promise<{
  averageRating: number;
  reviewCount: number;
}> {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('reviewee_id', userId);

  if (error) throw error;

  if (!data || data.length === 0) {
    return { averageRating: 0, reviewCount: 0 };
  }

  const totalRating = data.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / data.length;

  return {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    reviewCount: data.length,
  };
}

// Create a review
export async function createReview(data: CreateReviewData): Promise<Review> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // Verify the gig is completed and user is involved
  const { data: gig, error: gigError } = await supabase
    .from('gigs')
    .select('id, status, poster_id, teen_id')
    .eq('id', data.gig_id)
    .single();

  if (gigError) throw gigError;

  if (gig.status !== 'completed') {
    throw new Error('Can only review completed gigs');
  }

  // Verify reviewer is involved in the gig
  if (gig.poster_id !== user.id && gig.teen_id !== user.id) {
    throw new Error('You can only review gigs you were involved in');
  }

  // Verify reviewee is the other party
  const expectedRevieweeId = gig.poster_id === user.id ? gig.teen_id : gig.poster_id;
  if (data.reviewee_id !== expectedRevieweeId) {
    throw new Error('Invalid reviewee for this gig');
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      gig_id: data.gig_id,
      reviewer_id: user.id,
      reviewee_id: data.reviewee_id,
      rating: data.rating,
      comment: data.comment || null,
    })
    .select()
    .single();

  if (error) throw error;
  return review;
}

// Update a review
export async function updateReview(
  reviewId: string,
  data: UpdateReviewData
): Promise<Review> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate rating if provided
  if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
    throw new Error('Rating must be between 1 and 5');
  }

  const updateData: any = {};
  if (data.rating !== undefined) updateData.rating = data.rating;
  if (data.comment !== undefined) updateData.comment = data.comment || null;

  const { data: review, error } = await supabase
    .from('reviews')
    .update(updateData)
    .eq('id', reviewId)
    .eq('reviewer_id', user.id) // Ensure user can only update their own reviews
    .select()
    .single();

  if (error) throw error;
  if (!review) throw new Error('Review not found or you do not have permission to update it');
  return review;
}

// Delete a review
export async function deleteReview(reviewId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId)
    .eq('reviewer_id', user.id); // Ensure user can only delete their own reviews

  if (error) throw error;
}

// Check if user can review a gig
export async function canReviewGig(gigId: string): Promise<{
  canReview: boolean;
  reason?: string;
  existingReview?: Review | null;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { canReview: false, reason: 'User not authenticated' };
  }

  // Check if gig exists and is completed
  const { data: gig, error: gigError } = await supabase
    .from('gigs')
    .select('id, status, poster_id, teen_id')
    .eq('id', gigId)
    .single();

  if (gigError || !gig) {
    return { canReview: false, reason: 'Gig not found' };
  }

  if (gig.status !== 'completed') {
    return { canReview: false, reason: 'Can only review completed gigs' };
  }

  // Check if user is involved in the gig
  if (gig.poster_id !== user.id && gig.teen_id !== user.id) {
    return { canReview: false, reason: 'You can only review gigs you were involved in' };
  }

  // Check if review already exists
  const existingReview = await getReviewForGig(gigId);
  if (existingReview) {
    return { canReview: false, reason: 'You have already reviewed this gig', existingReview };
  }

  return { canReview: true };
}


