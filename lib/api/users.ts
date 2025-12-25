import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { getWeekRange, calculateDistance } from '@/lib/utils';
import { getAverageRating } from './reviews';
import * as Location from 'expo-location';

export interface UpdateProfileData {
  full_name?: string;
  bio?: string;
  phone?: string;
  address?: string;
  skills?: string[];
  availability?: {
    monday?: { start: string; end: string };
    tuesday?: { start: string; end: string };
    wednesday?: { start: string; end: string };
    thursday?: { start: string; end: string };
    friday?: { start: string; end: string };
    saturday?: { start: string; end: string };
    sunday?: { start: string; end: string };
  };
  profile_photo_url?: string;
}

// Update user profile
export async function updateProfile(data: UpdateProfileData): Promise<User> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data: updatedProfile, error } = await supabase
    .from('users')
    .update(data)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return updatedProfile;
}

// Upload profile photo to Supabase Storage (returns public URL)
// Get public user profile by ID (for public profile views)
export async function getPublicUserProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('role', 'teen') // Only allow viewing teen profiles publicly
    .maybeSingle(); // Use maybeSingle() to handle 0 rows gracefully

  if (error) {
    // Handle specific error codes
    if (error.code === 'PGRST116') {
      // No rows returned - profile not found or not accessible
      return null;
    }
    throw error;
  }
  
  return data;
}

export interface FeaturedTeenlancer {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  skills: string[];
  rating: number;
  reviewCount: number;
}

// Get featured teenlancers (teens with ratings)
export async function getFeaturedTeenlancers(
  limit: number = 10,
  neighborLocation?: { latitude: number; longitude: number }
): Promise<FeaturedTeenlancer[]> {
  console.log('getFeaturedTeenlancers called with:', { limit, neighborLocation });
  
  // Get all teens with reviews and addresses (no verification required)
  let query = supabase
    .from('users')
    .select('id, full_name, profile_photo_url, skills, address')
    .eq('role', 'teen');
  
  // Only require addresses if location filtering is enabled
  if (neighborLocation) {
    query = query.not('address', 'is', null);
  }
  
  query = query.limit(limit * 5); // Get more to account for filtering
  
  const { data: teens, error: teensError } = await query;

  console.log('Teens query result:', { 
    totalCount: teens?.length || 0,
    error: teensError?.message,
    teenIds: teens?.map(t => t.id)
  });

  if (teensError) {
    console.error('Error fetching teens:', teensError);
    throw teensError;
  }
  if (!teens || teens.length === 0) {
    console.log('No teens found');
    return [];
  }

  // Get reviews for all teens
  const teenIds = teens.map(t => t.id);
  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('reviewee_id, rating')
    .in('reviewee_id', teenIds);

  console.log('Reviews query result:', { 
    count: reviews?.length || 0, 
    error: reviewsError?.message,
    reviews: reviews?.map(r => ({ reviewee_id: r.reviewee_id, rating: r.rating }))
  });

  if (reviewsError) {
    console.error('Error fetching reviews:', reviewsError);
    throw reviewsError;
  }

  // Calculate average rating and review count for each teen
  const teenRatings = new Map<string, { totalRating: number; count: number }>();
  
  reviews?.forEach(review => {
    const current = teenRatings.get(review.reviewee_id) || { totalRating: 0, count: 0 };
    teenRatings.set(review.reviewee_id, {
      totalRating: current.totalRating + review.rating,
      count: current.count + 1,
    });
  });

  console.log('Teen ratings map:', Array.from(teenRatings.entries()).map(([id, data]) => ({ id, ...data })));
  
  // Map teens with their ratings and calculate distance
  const featuredTeenlancers: (FeaturedTeenlancer & { distance?: number })[] = await Promise.all(
    teens.map(async (teen) => {
      const ratingData = teenRatings.get(teen.id);
      console.log(`Processing teen ${teen.id} (${teen.full_name}):`, { 
        hasRating: !!ratingData, 
        ratingCount: ratingData?.count || 0,
        address: teen.address 
      });
      
      if (!ratingData || ratingData.count === 0) {
        console.log(`Skipping teen ${teen.id} - no reviews`);
        return null;
      }
      
      // Calculate distance if neighbor location is provided
      let distance: number | undefined;
      if (neighborLocation && teen.address) {
        try {
          console.log(`Geocoding address for teen ${teen.id}: ${teen.address}`);
          // Geocode the teen's address to get coordinates
          const geocoded = await Location.geocodeAsync(teen.address);
          console.log(`Geocoding result for teen ${teen.id}:`, geocoded);
          if (geocoded && geocoded.length > 0) {
            const teenLocation = geocoded[0];
            distance = calculateDistance(
              neighborLocation.latitude,
              neighborLocation.longitude,
              teenLocation.latitude,
              teenLocation.longitude
            );
            console.log(`Distance calculated for teen ${teen.id}: ${distance.toFixed(1)} miles`);
          } else {
            console.warn(`No geocoding results for teen ${teen.id} address: ${teen.address}`);
          }
        } catch (error) {
          console.error(`Error geocoding address for teen ${teen.id} (${teen.address}):`, error);
          // If geocoding fails, skip this teen if location filtering is required
          if (neighborLocation) {
            console.warn(`Skipping teen ${teen.id} due to geocoding failure`);
            return null;
          }
        }
      } else if (neighborLocation && !teen.address) {
        console.warn(`Teen ${teen.id} has no address but location filtering is enabled, skipping`);
        return null;
      }
      
      // Filter by 25 mile radius if location is provided
      if (neighborLocation) {
        if (distance === undefined) {
          console.warn(`Teen ${teen.id} has no distance calculated, skipping`);
          return null;
        }
        if (distance > 25) {
          console.log(`Teen ${teen.id} is ${distance.toFixed(1)} miles away, outside 25 mile radius`);
          return null;
        }
        console.log(`✓ Teen ${teen.id} is ${distance.toFixed(1)} miles away, within 25 mile radius`);
      }
      
      return {
        id: teen.id,
        full_name: teen.full_name,
        profile_photo_url: teen.profile_photo_url || undefined,
        skills: teen.skills || [],
        rating: Math.round((ratingData.totalRating / ratingData.count) * 10) / 10,
        reviewCount: ratingData.count,
        distance,
      };
    })
  );

  // Filter out nulls and sort
  const filtered = featuredTeenlancers
    .filter((teen): teen is FeaturedTeenlancer & { distance?: number } => teen !== null)
    .sort((a, b) => {
      // Sort by rating (descending), then by review count (descending)
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.reviewCount - a.reviewCount;
    })
    .slice(0, limit)
    .map(({ distance, ...teen }) => teen); // Remove distance from final result

  console.log(`Found ${filtered.length} featured teenlancers (limit: ${limit}, location: ${neighborLocation ? 'provided' : 'not provided'})`);
  
  return filtered;
}

// Get any user profile by ID (for messaging/chat - allows both teen and poster roles)
export async function getUserProfileForChat(userId: string): Promise<User | null> {
  if (!userId) {
    console.warn('getUserProfileForChat called with null/undefined userId');
    return null;
  }

  const { data: currentUser } = await supabase.auth.getUser();
  
  if (!currentUser?.user?.id) {
    console.warn('getUserProfileForChat: No authenticated user');
    return null;
  }
  
  // First, try direct query (should work if RLS allows via messages relationship)
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, profile_photo_url, role')
    .eq('id', userId)
    .maybeSingle();

  // If direct query works, return the data
  if (data) {
    return data;
  }

  // If data is null (RLS blocking), try workarounds via relationships
  if (!data && !error) {
    // Try 1: Query via messages relationship (works for both senders and recipients)
    // Find a message where current user and target user are involved
    // Try as sender first
    const { data: messageAsSender } = await supabase
      .from('messages')
      .select(`
        recipient:users!messages_recipient_id_fkey (
          id,
          full_name,
          profile_photo_url,
          role
        )
      `)
      .eq('sender_id', currentUser.user.id)
      .eq('recipient_id', userId)
      .limit(1)
      .maybeSingle();
    
    if (messageAsSender && (messageAsSender as any).recipient) {
      return (messageAsSender as any).recipient as User;
    }

    // Try as recipient
    const { data: messageAsRecipient } = await supabase
      .from('messages')
      .select(`
        sender:users!messages_sender_id_fkey (
          id,
          full_name,
          profile_photo_url,
          role
        )
      `)
      .eq('sender_id', userId)
      .eq('recipient_id', currentUser.user.id)
      .limit(1)
      .maybeSingle();
    
    if (messageAsRecipient && (messageAsRecipient as any).sender) {
      return (messageAsRecipient as any).sender as User;
    }

    // Try 2: Query via gigs relationship for posters
    // Allow if: gig is open (anyone can see), or current user is assigned teen, or current user is the poster
    const { data: gigWithPoster, error: gigError } = await supabase
      .from('gigs')
      .select(`
        poster_id,
        teen_id,
        status,
        users!gigs_poster_id_fkey (
          id,
          full_name,
          profile_photo_url,
          role
        )
      `)
      .eq('poster_id', userId)
      .or(`status.eq.open,teen_id.eq.${currentUser.user.id},poster_id.eq.${currentUser.user.id}`)
      .limit(1)
      .maybeSingle();
    
    if (gigWithPoster && (gigWithPoster as any).users) {
      const userData = (gigWithPoster as any).users as User;
      return userData;
    }

    // Try 3: Query via gigs relationship for teenlancers (assigned or applicants)
    const { data: gigWithTeen, error: teenGigError } = await supabase
      .from('gigs')
      .select(`
        teen_id,
        poster_id,
        users!gigs_teen_id_fkey (
          id,
          full_name,
          profile_photo_url,
          role
        )
      `)
      .eq('teen_id', userId)
      .or(`poster_id.eq.${currentUser.user.id},status.eq.open`)
      .limit(1)
      .maybeSingle();
    
    if (gigWithTeen && (gigWithTeen as any).users) {
      const userData = (gigWithTeen as any).users as User;
      return userData;
    }
  }

  if (error) {
    // Handle specific error codes
    if (error.code === 'PGRST116') {
      // No rows returned - try workarounds
      console.log(`getUserProfileForChat: Direct query returned no rows for ${userId}, trying workarounds`);
    } else {
      console.error(`getUserProfileForChat: Error fetching profile for ${userId}:`, error);
      // Don't throw - return null so the UI can handle gracefully
      return null;
    }
  }
  
  // If we get here, all queries failed
  console.warn(`getUserProfileForChat: Could not fetch profile for ${userId} via any method`);
  return null;
}

// Get teen statistics (rating, tasks completed, weekly earnings)
export interface TeenStats {
  rating: number;
  reviewCount: number;
  tasksCompleted: number;
  weeklyEarnings: number;
}

export async function getTeenStats(): Promise<TeenStats> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:133',message:'getTeenStats ENTRY',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:135',message:'getTeenStats user authenticated',data:{userId:user.id,userEmail:user.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion

  // Get completed tasks for rating calculation
  const { data: completedTasks, error: tasksError } = await supabase
    .from('gigs')
    .select('id, pay')
    .eq('teen_id', user.id)
    .eq('status', 'completed');

  if (tasksError) throw tasksError;

  const tasksCompleted = completedTasks?.length || 0;

  // Get actual rating and review count from reviews table
  let rating = 0;
  let reviewCount = 0;
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:151',message:'getTeenStats BEFORE getAverageRating',data:{userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const ratingData = await getAverageRating(user.id);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:153',message:'getTeenStats AFTER getAverageRating',data:{userId:user.id,rating:ratingData.averageRating,reviewCount:ratingData.reviewCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    rating = ratingData.averageRating || 0;
    reviewCount = ratingData.reviewCount || 0;
    console.log('Teen stats - Rating:', rating, 'Review Count:', reviewCount, 'User ID:', user.id);
  } catch (ratingError: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:156',message:'getTeenStats ERROR in getAverageRating',data:{userId:user.id,errorMessage:ratingError?.message,errorCode:ratingError?.code,errorDetails:ratingError?.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // If reviews table doesn't exist yet or there's an error, fall back to 0
    console.error('Could not fetch ratings for user:', user.id, ratingError);
    console.error('Rating error details:', ratingError?.message, ratingError?.code, ratingError?.details);
    rating = 0;
    reviewCount = 0;
  }

  // Get weekly earnings - calculate from completed gigs this week
  // This is more reliable than relying on earnings table which depends on triggers
  const { start, end } = getWeekRange();
  
  console.log('Teen Stats - Week range:', {
    start: start.toISOString(),
    end: end.toISOString(),
    startLocal: start.toLocaleString(),
    endLocal: end.toLocaleString(),
    currentTime: new Date().toISOString()
  });
  
  // Get all completed gigs for this teen, then filter by completion date
  const { data: allCompletedGigs, error: weeklyGigsError } = await supabase
    .from('gigs')
    .select('pay, updated_at, id, title, status')
    .eq('teen_id', user.id)
    .eq('status', 'completed');
  
  if (weeklyGigsError) throw weeklyGigsError;
  
  // Filter client-side to get gigs completed this week
  // Use updated_at as the completion date (when status changed to completed)
  const filteredGigs = (allCompletedGigs || []).filter(gig => {
    const completedDate = new Date(gig.updated_at);
    return completedDate >= start && completedDate <= end;
  });

  if (weeklyGigsError) throw weeklyGigsError;

  console.log('Teen Stats - Found completed gigs this week:', filteredGigs.length, filteredGigs.map(g => ({
    id: g.id,
    title: g.title,
    pay: g.pay,
    updated_at: g.updated_at,
    completedDate: new Date(g.updated_at).toISOString()
  })));

  // Calculate total earnings from completed gigs this week
  const weeklyEarnings = filteredGigs.reduce((sum, gig) => sum + parseFloat(gig.pay.toString()), 0);

  const result = {
    rating,
    reviewCount,
    tasksCompleted,
    weeklyEarnings,
  };
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:221',message:'getTeenStats RETURN',data:{rating,reviewCount,tasksCompleted,weeklyEarnings,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  return result;
}

// Get neighbor (poster) statistics
export interface NeighborStats {
  totalGigsPosted: number;
  activeGigs: number; // open + accepted + in_progress
  completedGigs: number;
  totalSpent: number; // sum of completed gig payments
}

export async function getNeighborStats(): Promise<NeighborStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get all gigs posted by this user
  const { data: allGigs, error: allGigsError } = await supabase
    .from('gigs')
    .select('id, status, pay')
    .eq('poster_id', user.id);

  if (allGigsError) throw allGigsError;

  const totalGigsPosted = allGigs?.length || 0;
  
  // Count active gigs (open, accepted, in_progress)
  const activeGigs = allGigs?.filter(
    gig => ['open', 'accepted', 'in_progress'].includes(gig.status)
  ).length || 0;

  // Count completed gigs
  const completedGigs = allGigs?.filter(
    gig => gig.status === 'completed'
  ).length || 0;

  // Calculate total spent (sum of completed gig payments)
  const totalSpent = allGigs
    ?.filter(gig => gig.status === 'completed')
    .reduce((sum, gig) => sum + parseFloat(gig.pay.toString()), 0) || 0;

  return {
    totalGigsPosted,
    activeGigs,
    completedGigs,
    totalSpent,
  };
}

export async function uploadProfilePhoto(uri: string): Promise<string> {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:29',message:'uploadProfilePhoto entry',data:{uri:uri.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:33',message:'Auth check',data:{hasUser:!!user,userId:user?.id,hasAuthError:!!authError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  if (!user) throw new Error('User not authenticated');

  try {
    // If it's already a URL (from Supabase Storage), return it
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    // Generate unique filename
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `profile-photos/${fileName}`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:45',message:'File path generated',data:{filePath,fileName,userId:user.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Delete old profile photo if it exists
    const { data: currentUser } = await supabase
      .from('users')
      .select('profile_photo_url')
      .eq('id', user.id)
      .single();

    if (currentUser?.profile_photo_url) {
      try {
        // Extract the file path from the URL
        const urlParts = currentUser.profile_photo_url.split('/');
        const oldFileName = urlParts[urlParts.length - 1];
        if (oldFileName && oldFileName.includes(user.id)) {
          const oldPath = `profile-photos/${oldFileName}`;
          await supabase.storage.from('avatars').remove([oldPath]);
        }
      } catch (deleteError) {
        // Ignore delete errors - old file might not exist
        console.log('Could not delete old photo:', deleteError);
      }
    }

    // For React Native, read file as base64 and convert to ArrayBuffer
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Determine content type based on file extension
    const contentType = fileExt === 'png' ? 'image/png' : 
                       fileExt === 'webp' ? 'image/webp' : 
                       'image/jpeg';

    // Upload to Supabase Storage using ArrayBuffer
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:76',message:'BEFORE upload attempt',data:{filePath,contentType,arrayBufferSize:arrayBuffer.byteLength},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, arrayBuffer, {
        contentType: contentType,
        upsert: false,
      });

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:82',message:'AFTER upload attempt',data:{hasData:!!uploadData,hasError:!!uploadError,errorCode:uploadError?.statusCode,errorMessage:uploadError?.message,errorName:uploadError?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // Provide helpful error message for RLS policy violation
      if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('violates') || uploadError.statusCode === 403) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/api/users.ts:88',message:'RLS policy violation detected',data:{errorMessage:uploadError.message,statusCode:uploadError.statusCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        throw new Error(
          'Storage upload blocked by security policy. Please add storage policies to allow authenticated users to upload. ' +
          'See PROFILE_PHOTO_SETUP.md for the correct policies.'
        );
      }
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
        throw new Error(
          'Storage bucket not found. Please create an "avatars" bucket in Supabase Storage. ' +
          'See PROFILE_PHOTO_SETUP.md for instructions.'
        );
      }
      
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    return publicUrl;
  } catch (error: any) {
    console.error('Error uploading profile photo:', error);
    throw new Error(error.message || 'Failed to upload profile photo');
  }
}

// Get teenlancers for neighbor selection
export interface TeenlancerProfile {
  id: string;
  full_name: string;
  profile_photo_url?: string;
  bio?: string;
  skills?: string[];
  rating: number;
  reviewCount: number;
  distance?: number; // in miles
  address?: string;
}

export interface TeenlancerFilters {
  minRating?: number;
  skills?: string[];
  radius?: number;
  searchTerm?: string;
}

export async function getTeenlancers(
  filters?: TeenlancerFilters,
  userLocation?: { latitude: number; longitude: number },
  sortBy?: 'rating' | 'distance'
): Promise<TeenlancerProfile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Get current user's location if not provided
  let neighborLocation = userLocation;
  if (!neighborLocation) {
    const currentUser = await supabase
      .from('users')
      .select('address')
      .eq('id', user.id)
      .single();
    
    // If user has address, we'd need to geocode it, but for now we'll require location
    // For simplicity, we'll fetch all teenlancers and calculate distance if location is provided
  }

  // Fetch all teenlancers (role = 'teen')
  let query = supabase
    .from('users')
    .select('id, full_name, profile_photo_url, bio, skills, address')
    .eq('role', 'teen');
    // Note: Removed verified filter to show all teenlancers by default

  // Apply skill filter if provided
  if (filters?.skills && filters.skills.length > 0) {
    query = query.contains('skills', filters.skills);
  }

  const { data: teenlancers, error } = await query;
  if (error) throw error;

  if (!teenlancers) return [];

  // Get ratings for each teenlancer and calculate distance
  const profilesWithNulls: (TeenlancerProfile | null)[] = await Promise.all(
    teenlancers.map(async (teen) => {
      try {
        // Get rating
        const ratingData = await getAverageRating(teen.id);
        const rating = ratingData.averageRating;
        const reviewCount = ratingData.reviewCount;

        // Calculate distance if location is provided
        let distance: number | undefined;
        if (neighborLocation && teen.address) {
          // For now, we'll skip distance calculation if address isn't geocoded
          // In a real implementation, you'd geocode the address to get lat/lng
          // For this implementation, we'll return undefined for distance
          distance = undefined;
        }

        // Apply rating filter
        if (filters?.minRating && rating < filters.minRating) {
          return null;
        }

        return {
          id: teen.id,
          full_name: teen.full_name,
          profile_photo_url: teen.profile_photo_url,
          bio: teen.bio,
          skills: teen.skills || [],
          rating,
          reviewCount,
          distance,
          address: teen.address,
        };
      } catch (error) {
        console.error(`Error processing teenlancer ${teen.id}:`, error);
        return null;
      }
    })
  );

  // Filter out nulls and apply search term filter
  let filtered: TeenlancerProfile[] = profilesWithNulls.filter((p) => p !== null) as TeenlancerProfile[];

  if (filters?.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.full_name.toLowerCase().includes(searchLower) ||
        p.bio?.toLowerCase().includes(searchLower) ||
        p.skills?.some((s) => s.toLowerCase().includes(searchLower))
    );
  }

  // Sort based on sortBy parameter
  const sortMethod = sortBy || 'rating';
  filtered.sort((a, b) => {
    if (sortMethod === 'distance') {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      // If one has distance and other doesn't, prioritize the one with distance
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      // Fallback to rating if no distances
      return b.rating - a.rating;
    } else {
      // Default: sort by rating (descending)
      return b.rating - a.rating;
    }
  });

  return filtered;
}

