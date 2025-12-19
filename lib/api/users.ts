import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { getWeekRange } from '@/lib/utils';
import { getAverageRating } from './reviews';

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

// Get teen statistics (rating, tasks completed, weekly earnings)
export interface TeenStats {
  rating: number;
  reviewCount: number;
  tasksCompleted: number;
  weeklyEarnings: number;
}

export async function getTeenStats(): Promise<TeenStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

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
  try {
    const ratingData = await getAverageRating(user.id);
    rating = ratingData.averageRating;
    reviewCount = ratingData.reviewCount;
  } catch (ratingError) {
    // If reviews table doesn't exist yet or there's an error, fall back to 0
    console.log('Could not fetch ratings:', ratingError);
    rating = 0;
    reviewCount = 0;
  }

  // Get weekly earnings - calculate from completed gigs this week
  // This is more reliable than relying on earnings table which depends on triggers
  const { start, end } = getWeekRange();
  const { data: weeklyGigs, error: weeklyGigsError } = await supabase
    .from('gigs')
    .select('pay, updated_at')
    .eq('teen_id', user.id)
    .eq('status', 'completed')
    .gte('updated_at', start.toISOString())
    .lte('updated_at', end.toISOString());

  if (weeklyGigsError) throw weeklyGigsError;

  // Calculate total earnings from completed gigs this week
  const weeklyEarnings = weeklyGigs?.reduce((sum, gig) => sum + parseFloat(gig.pay.toString()), 0) || 0;

  return {
    rating,
    reviewCount,
    tasksCompleted,
    weeklyEarnings,
  };
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

