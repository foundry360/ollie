import { supabase } from '@/lib/supabase';
import { trackApiError } from '@/lib/sentry';

export interface VerificationRequest {
  id: string;
  user_id: string;
  front_photo_url: string;
  back_photo_url?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload a verification photo to Supabase Storage
 * @param uri - Local file URI from ImagePicker
 * @param side - 'front' or 'back' to indicate which side of ID
 * @returns Signed URL for the uploaded photo (private bucket)
 */
export async function uploadVerificationPhoto(
  uri: string,
  side: 'front' | 'back'
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    // If it's already a URL (from Supabase Storage), return it
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    // Validate file size by fetching the file
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    
    // Check file size
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Generate unique filename
    const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileName = `${side}-${timestamp}-${randomId}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Determine content type based on file extension
    const contentType = fileExt === 'png' ? 'image/png' : 
                       fileExt === 'webp' ? 'image/webp' : 
                       'image/jpeg';

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new Error('Invalid file type. Please upload a JPEG, PNG, or WebP image.');
    }

    // Upload to Supabase Storage (private bucket)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('id-verifications')
      .upload(filePath, arrayBuffer, {
        contentType: contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      
      // Provide helpful error message for RLS policy violation
      if (uploadError.message?.includes('row-level security') || 
          uploadError.message?.includes('violates') || 
          (uploadError as any).statusCode === 403) {
        throw new Error(
          'Storage upload blocked by security policy. Please ensure you have permission to upload verification photos.'
        );
      }
      
      // Provide helpful error message for missing bucket
      if (uploadError.message?.includes('Bucket not found') || 
          uploadError.message?.includes('not found')) {
        throw new Error(
          'Storage bucket not found. Please create an "id-verifications" bucket in Supabase Storage.'
        );
      }
      
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Generate signed URL (private bucket, expires in 1 hour)
    // Note: We'll regenerate signed URLs when needed for admin review
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('id-verifications')
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error('Failed to generate signed URL for uploaded image');
    }

    return signedUrlData.signedUrl;
  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(error.message || 'Failed to upload verification photo');
    trackApiError('uploadVerificationPhoto', errorObj, {
      side,
      uri: uri.substring(0, 50), // Don't log full URI
    });
    console.error('Error uploading verification photo:', error);
    throw errorObj;
  }
}

/**
 * Submit a verification request with uploaded photos
 * @param frontPhotoUrl - Signed URL of front ID photo
 * @param backPhotoUrl - Optional signed URL of back ID photo
 * @returns VerificationRequest object
 */
export async function submitVerificationRequest(
  frontPhotoUrl: string,
  backPhotoUrl?: string
): Promise<VerificationRequest | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  try {
    // First, check if user exists in users table (required for foreign key)
    const { data: userProfile, error: userCheckError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    // If user doesn't exist in users table yet (e.g., during neighbor signup),
    // return null instead of throwing error
    if (userCheckError || !userProfile) {
      console.warn('User profile not found in users table, skipping verification request creation');
      return null;
    }

    // Check if user already has a pending request
    const { data: existingPendingRequest } = await supabase
      .from('verification_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingPendingRequest) {
      // Update existing pending request
      const { data, error } = await supabase
        .from('verification_requests')
        .update({
          front_photo_url: frontPhotoUrl,
          back_photo_url: backPhotoUrl || null,
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPendingRequest.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Create new verification request (allows resubmission after rejection/expiration)
      const { data, error } = await supabase
        .from('verification_requests')
        .insert({
          user_id: user.id,
          front_photo_url: frontPhotoUrl,
          back_photo_url: backPhotoUrl || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error: any) {
    const errorObj = error instanceof Error ? error : new Error(error.message || 'Failed to submit verification request');
    trackApiError('submitVerificationRequest', errorObj, {
      hasBackPhoto: !!backPhotoUrl,
    });
    console.error('Error submitting verification request:', error);
    throw errorObj;
  }
}

/**
 * Get current user's verification request status
 */
export async function getVerificationRequest(): Promise<VerificationRequest | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get signed URL for verification photo (for viewing)
 * @param filePath - Path to file in storage bucket
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 */
export async function getVerificationPhotoUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('id-verifications')
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error('Failed to generate signed URL for verification photo');
  }

  return data.signedUrl;
}

