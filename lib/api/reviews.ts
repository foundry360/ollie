import { supabase } from '@/lib/supabase';

export interface Review {
  id: string;
  gig_id?: string | null; // Optional - allows general reviews without specific gigs
  reviewer_id: string;
  reviewee_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateReviewData {
  gig_id?: string | null; // Optional - allows general reviews without specific gigs
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
  // First, get reviews without the JOIN to avoid RLS issues
  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!reviews || reviews.length === 0) return [];

  // Then, try to get reviewer info for each review separately
  // This way if one reviewer profile can't be read, others still work
  const reviewsWithReviewerInfo = await Promise.all(
    reviews.map(async (review) => {
      try {
        const { data: reviewer } = await supabase
          .from('users')
          .select('id, full_name, profile_photo_url, role')
          .eq('id', review.reviewer_id)
          .single();
        
        return {
          ...review,
          reviewer_name: reviewer?.full_name || 'Anonymous',
          reviewer_photo: reviewer?.profile_photo_url,
        };
      } catch (error) {
        // If we can't read the reviewer profile, still return the review
        // but without reviewer info
        console.warn(`Could not fetch reviewer profile for review ${review.id}:`, error);
        return {
          ...review,
          reviewer_name: 'Anonymous',
          reviewer_photo: undefined,
        };
      }
    })
  );

  return reviewsWithReviewerInfo;
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:93',message:'getAverageRating ENTRY',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:97',message:'getAverageRating auth check',data:{userId,authenticatedUserId:user.id,userIdMatch:userId===user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  console.log('getAverageRating called for userId:', userId, 'authenticated user:', user.id);
  console.log('Querying reviews where reviewee_id =', userId);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:100',message:'getAverageRating querying',data:{userId,authenticatedUserId:user.id,queryingRevieweeId:userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:102',message:'getAverageRating BEFORE query',data:{userId,queryingRevieweeId:userId,authenticatedUserId:user.id,isSelfQuery:userId===user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // First, check user's verified status to understand RLS policy behavior
  const { data: userProfile } = await supabase
    .from('users')
    .select('id, role, verified')
    .eq('id', userId)
    .single();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:107',message:'getAverageRating user profile BEFORE query',data:{userId,userRole:userProfile?.role,userVerified:userProfile?.verified,hasProfile:!!userProfile,shouldMatchOwnPolicy:userId===user.id,shouldMatchPublicPolicy:userProfile?.role==='teen'&&userProfile?.verified===true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  
  // Direct check: Get ALL reviews to see what exists
  const { data: allReviewsCheck, error: allReviewsError } = await supabase
    .from('reviews')
    .select('id, reviewee_id, reviewer_id, rating, gig_id')
    .limit(20);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:115',message:'getAverageRating ALL reviews check',data:{userId,allReviewsCount:allReviewsCheck?.length||0,allReviews:allReviewsCheck?.map(r=>({id:r.id,reviewee_id:r.reviewee_id,reviewer_id:r.reviewer_id,rating:r.rating})),matchingRevieweeId:allReviewsCheck?.filter(r=>r.reviewee_id===userId).length,revieweeIds:allReviewsCheck?.map(r=>r.reviewee_id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  console.log('getAverageRating - All reviews in DB:', allReviewsCheck?.length || 0);
  if (allReviewsCheck && allReviewsCheck.length > 0) {
    console.log('getAverageRating - Reviews with reviewee_id matching userId:', allReviewsCheck.filter(r => r.reviewee_id === userId).length);
    console.log('getAverageRating - All reviewee_ids:', allReviewsCheck.map(r => r.reviewee_id));
  }
  
  const { data, error } = await supabase
    .from('reviews')
    .select('rating, reviewee_id, reviewer_id, id, created_at')
    .eq('reviewee_id', userId);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:105',message:'getAverageRating AFTER query',data:{userId,hasError:!!error,errorCode:error?.code,errorMessage:error?.message,dataCount:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:107',message:'getAverageRating QUERY ERROR',data:{userId,errorCode:error.code,errorMessage:error.message,errorDetails:error.details,errorHint:error.hint},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error fetching reviews for user:', userId, 'Error code:', error.code, 'Error message:', error.message, 'Error details:', error);
    // Don't throw - return 0 instead to prevent breaking the stats
    return { averageRating: 0, reviewCount: 0 };
  }

  console.log('Reviews fetched for user:', userId, 'Count:', data?.length || 0);
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:113',message:'getAverageRating data received',data:{userId,reviewCount:data?.length||0,reviews:data?.map(r=>({id:r.id,reviewee_id:r.reviewee_id,reviewer_id:r.reviewer_id,rating:r.rating}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (data && data.length > 0) {
    console.log('All review data:', JSON.stringify(data, null, 2));
    console.log('Sample review data:', data[0]);
  } else {
    // Debug: Check if there are ANY reviews in the table
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:148',message:'getAverageRating checking all reviews',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const { data: allReviews, error: allError } = await supabase
      .from('reviews')
      .select('id, reviewee_id, reviewer_id, rating')
      .limit(10);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:152',message:'getAverageRating all reviews check',data:{userId,allReviewsCount:allReviews?.length||0,allError:allError?.message,allReviews:allReviews?.map(r=>({id:r.id,reviewee_id:r.reviewee_id,reviewer_id:r.reviewer_id,rating:r.rating})),matchingCount:allReviews?.filter(r=>r.reviewee_id===userId).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('Debug: Checking all reviews in table (first 10):', allReviews?.length || 0);
    if (allReviews && allReviews.length > 0) {
      console.log('Sample reviews from table:', JSON.stringify(allReviews, null, 2));
      console.log('Looking for reviews where reviewee_id matches:', userId);
      const matching = allReviews.filter(r => r.reviewee_id === userId);
      console.log('Matching reviews found:', matching.length);
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:160',message:'getAverageRating RETURN no reviews',data:{userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log('No reviews found for user:', userId);
    return { averageRating: 0, reviewCount: 0 };
  }

  const totalRating = data.reduce((sum, review) => sum + (review.rating || 0), 0);
  const averageRating = totalRating / data.length;

  const result = {
    averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
    reviewCount: data.length,
  };
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:144',message:'getAverageRating RETURN with data',data:{userId,averageRating:result.averageRating,reviewCount:result.reviewCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  console.log('getAverageRating result:', result);
  return result;
}

// Create a review
export async function createReview(data: CreateReviewData): Promise<Review> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Validate rating
  if (data.rating < 1 || data.rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  // If gig_id is provided, verify the gig is completed and user is involved
  if (data.gig_id) {
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
  }

  // Build insert object, only including gig_id if it's provided
  const insertData: any = {
    reviewer_id: user.id,
    reviewee_id: data.reviewee_id,
    rating: data.rating,
    comment: data.comment || null,
  };
  
  // Only include gig_id if it's provided (not null/undefined)
  if (data.gig_id) {
    insertData.gig_id = data.gig_id;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:236',message:'createReview BEFORE insert',data:{insertData:JSON.stringify(insertData),reviewerId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  const { data: review, error } = await supabase
    .from('reviews')
    .insert(insertData)
    .select()
    .single();
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/reviews.ts:242',message:'createReview AFTER insert',data:{hasReview:!!review,hasError:!!error,errorCode:error?.code,reviewId:review?.id,revieweeId:review?.reviewee_id,reviewerId:review?.reviewer_id,gigId:review?.gig_id,rating:review?.rating},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  if (error) throw error;
  console.log('createReview - Review inserted successfully:', review);
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











