import { supabase } from '@/lib/supabase';
import { getAverageRating } from './reviews';

export interface GigApplication {
  id: string;
  gig_id: string;
  teen_id: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  teen_name?: string;
  teen_photo?: string;
  teen_age?: number;
  teen_rating?: number;
  teen_review_count?: number;
  gig_title?: string;
  gig_pay?: number;
  gig_description?: string;
  gig_location?: { latitude: number; longitude: number };
  gig_address?: string;
  gig_required_skills?: string[];
  gig_estimated_hours?: number;
  gig_photos?: string[];
  gig_created_at?: string;
  gig_updated_at?: string;
  gig_status?: string;
}

// Get all applications for a specific gig (for neighbors)
export async function getGigApplications(gigId: string): Promise<GigApplication[]> {
  const { data, error } = await supabase
    .from('gig_applications')
    .select(`
      *,
      teen:users!gig_applications_teen_id_fkey (
        id,
        full_name,
        profile_photo_url,
        date_of_birth
      ),
      gig:gigs!gig_applications_gig_id_fkey (
        id,
        title,
        pay
      )
    `)
    .eq('gig_id', gigId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Fetch ratings for all teens in parallel
  const applicationsWithRatings = await Promise.all(
    (data || []).map(async (app: any) => {
      let rating = 0;
      let reviewCount = 0;
      if (app.teen_id) {
        try {
          const ratingData = await getAverageRating(app.teen_id);
          rating = ratingData.averageRating;
          reviewCount = ratingData.reviewCount;
        } catch (error) {
          // If rating fetch fails, default to 0
          console.log('Could not fetch rating for teen:', app.teen_id, error);
        }
      }

      return {
        id: app.id,
        gig_id: app.gig_id,
        teen_id: app.teen_id,
        status: app.status,
        rejection_reason: app.rejection_reason,
        created_at: app.created_at,
        updated_at: app.updated_at,
        teen_name: app.teen?.full_name,
        teen_photo: app.teen?.profile_photo_url,
        teen_age: app.teen?.date_of_birth 
          ? new Date().getFullYear() - new Date(app.teen.date_of_birth).getFullYear()
          : undefined,
        teen_rating: rating,
        teen_review_count: reviewCount,
        gig_title: app.gig?.title,
        gig_pay: app.gig?.pay,
      };
    })
  );

  return applicationsWithRatings;
}

// Get pending applications for a neighbor's gigs
export async function getPendingApplicationsForNeighbor(): Promise<GigApplication[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('gig_applications')
    .select(`
      *,
      teen:users!gig_applications_teen_id_fkey (
        id,
        full_name,
        profile_photo_url,
        date_of_birth
      ),
      gig:gigs!gig_applications_gig_id_fkey (
        id,
        title,
        pay,
        status,
        poster_id
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Filter by poster_id on the client side since we can't filter nested fields easily
  return (data || [])
    .filter((app: any) => app.gig?.poster_id === user.id)
    .map((app: any) => ({
      id: app.id,
      gig_id: app.gig_id,
      teen_id: app.teen_id,
      status: app.status,
      rejection_reason: app.rejection_reason,
      created_at: app.created_at,
      updated_at: app.updated_at,
      teen_name: app.teen?.full_name,
      teen_photo: app.teen?.profile_photo_url,
      teen_age: app.teen?.date_of_birth 
        ? new Date().getFullYear() - new Date(app.teen.date_of_birth).getFullYear()
        : undefined,
      gig_title: app.gig?.title,
      gig_pay: app.gig?.pay,
    }));
}

// Get applications for a teenlancer
export async function getTeenApplications(): Promise<GigApplication[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('gig_applications')
    .select(`
      *,
      gig:gigs!gig_applications_gig_id_fkey (
        id,
        title,
        description,
        pay,
        status,
        location,
        address,
        required_skills,
        estimated_hours,
        photos,
        created_at,
        updated_at
      )
    `)
    .eq('teen_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((app: any) => ({
    id: app.id,
    gig_id: app.gig_id,
    teen_id: app.teen_id,
    status: app.status,
    rejection_reason: app.rejection_reason,
    created_at: app.created_at,
    updated_at: app.updated_at,
    gig_title: app.gig?.title,
    gig_pay: app.gig?.pay,
    gig_description: app.gig?.description,
    gig_location: app.gig?.location,
    gig_address: app.gig?.address,
    gig_required_skills: app.gig?.required_skills,
    gig_estimated_hours: app.gig?.estimated_hours,
    gig_photos: app.gig?.photos,
    gig_created_at: app.gig?.created_at,
    gig_updated_at: app.gig?.updated_at,
    gig_status: app.gig?.status,
  }));
}

// Get application counts for multiple gigs (for displaying on cards)
export async function getGigApplicationCounts(gigIds: string[]): Promise<Map<string, number>> {
  if (gigIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('gig_applications')
    .select('gig_id, status')
    .in('gig_id', gigIds)
    .eq('status', 'pending');

  if (error) {
    console.error('Error fetching application counts:', error);
    return new Map();
  }

  const counts = new Map<string, number>();
  gigIds.forEach(id => counts.set(id, 0));

  (data || []).forEach((app: any) => {
    const current = counts.get(app.gig_id) || 0;
    counts.set(app.gig_id, current + 1);
  });

  return counts;
}

// Check if teen has already applied for a gig
export async function hasAppliedForGig(gigId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('gig_applications')
    .select('id')
    .eq('gig_id', gigId)
    .eq('teen_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw error;
  }

  return !!data;
}

// Approve a gig application (neighbor)
export async function approveGigApplication(applicationId: string): Promise<any> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Use the database function to approve and assign the gig
  const { data: approvedGig, error: rpcError } = await supabase.rpc('approve_gig_application', {
    p_application_id: applicationId,
  });

  if (rpcError) {
    console.error('Approve gig application RPC error:', rpcError);
    
    if (rpcError.message?.includes('Application not found') ||
        rpcError.message?.includes('Only the gig poster') ||
        rpcError.message?.includes('Application is not pending') ||
        rpcError.message?.includes('Gig is no longer open') ||
        rpcError.message?.includes('already has a teenlancer')) {
      throw new Error(rpcError.message);
    }
    
    throw rpcError;
  }

  if (!approvedGig) {
    throw new Error('Failed to approve application. Unknown error.');
  }

  // The RPC function returns the updated gig
  if (Array.isArray(approvedGig) && approvedGig.length > 0) {
    return approvedGig[0];
  } else if (approvedGig && typeof approvedGig === 'object' && !Array.isArray(approvedGig)) {
    return approvedGig;
  }

  throw new Error('Failed to approve application. Invalid response from database function.');
}

// Reject a gig application (neighbor)
export async function rejectGigApplication(applicationId: string, reason?: string): Promise<GigApplication> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Use the database function to reject the application
  const { data: rejectedApp, error: rpcError } = await supabase.rpc('reject_gig_application', {
    p_application_id: applicationId,
    p_reason: reason || null,
  });

  if (rpcError) {
    console.error('Reject gig application RPC error:', rpcError);
    
    if (rpcError.message?.includes('Application not found') ||
        rpcError.message?.includes('Only the gig poster') ||
        rpcError.message?.includes('Application is not pending')) {
      throw new Error(rpcError.message);
    }
    
    throw rpcError;
  }

  if (!rejectedApp) {
    throw new Error('Failed to reject application. Unknown error.');
  }

  // The RPC function returns the updated application
  if (Array.isArray(rejectedApp) && rejectedApp.length > 0) {
    return rejectedApp[0] as GigApplication;
  } else if (rejectedApp && typeof rejectedApp === 'object' && !Array.isArray(rejectedApp)) {
    return rejectedApp as GigApplication;
  }

  throw new Error('Failed to reject application. Invalid response from database function.');
}




