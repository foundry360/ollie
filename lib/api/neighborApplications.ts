import { supabase } from '@/lib/supabase';

export interface PendingNeighborApplication {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  address: string | null;
  date_of_birth: string | null;
  status: 'pending' | 'approved' | 'rejected';
  phone_verified: boolean;
  phone_verified_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Create a pending neighbor application
 * Called after initial signup (Step 1)
 * Uses a database function to bypass RLS during signup when session might not be fully established
 */
/**
 * Helper function to handle unique constraint errors
 */
function handleUniqueConstraintError(error: any): never {
  console.log('🔍 [handleUniqueConstraintError] Checking error:', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint
  });
  
  if (error.code === '23505') {
    // Check multiple places where the constraint name might appear
    const errorDetail = (error.message || '') + ' ' + (error.details || '') + ' ' + (error.hint || '');
    console.log('❌ Unique constraint violation detected. Full error detail:', errorDetail);
    
    const lowerDetail = errorDetail.toLowerCase();
    
    if (lowerDetail.includes('unique_phone') || lowerDetail.includes('phone')) {
      console.log('📱 Phone number duplicate detected');
      throw new Error('PHONE_EXISTS: This phone number is already registered.');
    } else if (lowerDetail.includes('unique_email') || lowerDetail.includes('email')) {
      console.log('📧 Email duplicate detected');
      throw new Error('EMAIL_EXISTS: This email address is already registered.');
    } else {
      console.log('⚠️ Generic duplicate detected');
      throw new Error('DUPLICATE_ENTRY: An account with this information already exists.');
    }
  }
  console.log('⏭️ Not a unique constraint error, re-throwing');
  throw error;
}

export async function createPendingNeighborApplication(data: {
  userId: string;
  email: string;
  full_name: string;
  phone: string;
}): Promise<PendingNeighborApplication> {
  // Try using the database function first (more reliable during signup)
  const { data: application, error: functionError } = await supabase.rpc(
    'create_pending_neighbor_application',
    {
      p_user_id: data.userId,
      p_email: data.email,
      p_full_name: data.full_name,
      p_phone: data.phone,
    }
  );

  if (!functionError && application) {
    return application;
  }

  // If RPC failed, check if it's a unique constraint error
  if (functionError) {
    handleUniqueConstraintError(functionError);
  }

  // Fallback to direct insert if function doesn't exist or fails
  console.log('Function approach failed, trying direct insert:', functionError);
  const { data: directApplication, error: insertError } = await supabase
    .from('pending_neighbor_applications')
    .insert({
      user_id: data.userId,
      email: data.email.trim().toLowerCase(),
      full_name: data.full_name.trim(),
      phone: data.phone.trim(),
      status: 'pending',
      phone_verified: false,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Error creating pending neighbor application:', insertError);
    handleUniqueConstraintError(insertError);
  }

  if (!directApplication) {
    throw new Error('Failed to create pending neighbor application');
  }

  return directApplication;
}

/**
 * Update pending application with phone verification status
 * Called after SMS verification (Step 2)
 * If application doesn't exist, creates it using the verified user's data
 */
export async function updateApplicationPhoneVerification(
  applicationId: string | null | undefined,
  verified: boolean,
  fallbackData?: {
    email: string;
    full_name: string;
    phone: string;
  }
): Promise<PendingNeighborApplication> {
  // Get current user (should exist after OTP verification)
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    console.error('Error getting current user:', userError);
    throw new Error('User not authenticated. Please try again.');
  }

  const updateData: any = {
    phone_verified: verified,
  };

  if (verified) {
    updateData.phone_verified_at = new Date().toISOString();
  }

  // Try by applicationId first if provided
  if (applicationId) {
    const { data: application, error } = await supabase
      .from('pending_neighbor_applications')
      .update(updateData)
      .eq('id', applicationId)
      .eq('user_id', user.id) // Ensure it belongs to current user
      .select()
      .single();

    if (!error && application) {
      return application;
    }
    
    // If applicationId lookup failed, log and try by user_id
    console.log('Update by applicationId failed, trying by user_id:', error);
  }

  // Fallback: Find and update by user_id
  let { data: application, error } = await supabase
    .from('pending_neighbor_applications')
    .update(updateData)
    .eq('user_id', user.id)
    .eq('status', 'pending') // Only update pending applications
    .select()
    .single();

  // If not found by user_id, use database function to find by phone (bypasses RLS)
  if (error && error.code === 'PGRST116' && fallbackData) {
    console.log('Application not found by user_id, using RPC function to find by phone:', fallbackData.phone);
    
    // Use database function to find and update by phone (bypasses RLS)
    const { data: existingApp, error: rpcError } = await supabase.rpc(
      'find_and_update_application_by_phone',
      {
        p_phone: fallbackData.phone.trim(),
        p_verified_user_id: user.id,
        p_phone_verified: verified,
        p_phone_verified_at: verified ? new Date().toISOString() : null,
      }
    );
    
    if (existingApp && !rpcError) {
      console.log('Found existing application by phone via RPC, returning updated application');
      return existingApp;
    }
    
    // If RPC function doesn't exist or failed, fallback to direct query (might fail due to RLS)
    if (rpcError) {
      console.log('RPC function failed or not found, trying direct query:', rpcError);
    }
    
    // Fallback: Try direct query (may fail due to RLS if user_id doesn't match)
    let { data: directApp, error: directError } = await supabase
      .from('pending_neighbor_applications')
      .select('*')
      .eq('phone', fallbackData.phone.trim())
      .maybeSingle();
    
    if (directApp) {
      // Try to update it (may fail due to RLS)
      const { data: updatedApp, error: updateError } = await supabase
        .from('pending_neighbor_applications')
        .update({
          ...updateData,
          user_id: user.id,
          phone: fallbackData.phone.trim(),
        })
        .eq('id', directApp.id)
        .select()
        .single();
      
      if (!updateError && updatedApp) {
        return updatedApp;
      }
    }
    
    // If still not found, create a new one (shouldn't happen, but handle it)
    console.log('No existing application found, creating new one with verified user:', user.id);
    
    try {
      const newApplication = await createPendingNeighborApplication({
        userId: user.id,
        email: fallbackData.email,
        full_name: fallbackData.full_name,
        phone: fallbackData.phone,
      });
      
      // Now update it with phone verification status
      const { data: updatedApp, error: updateError } = await supabase
        .from('pending_neighbor_applications')
        .update(updateData)
        .eq('id', newApplication.id)
        .select()
        .single();
      
      if (updateError || !updatedApp) {
        console.error('Error updating newly created application:', updateError);
        throw new Error('Failed to update application. Please try again.');
      }
      
      return updatedApp;
    } catch (createError: any) {
      // If creation fails due to unique constraint, try finding by phone or email
      if (createError.code === '23505' && fallbackData) {
        console.log('Creation failed due to unique constraint, finding existing application');
        
        // Try phone first (most reliable)
        let foundApp = null;
        const { data: appByPhone } = await supabase
          .from('pending_neighbor_applications')
          .select('*')
          .eq('phone', fallbackData.phone.trim())
          .maybeSingle();
        
        if (appByPhone) {
          foundApp = appByPhone;
        } else {
          // Try email
          const { data: appByEmail } = await supabase
            .from('pending_neighbor_applications')
            .select('*')
            .eq('email', fallbackData.email.toLowerCase().trim())
            .maybeSingle();
          
          if (appByEmail) {
            foundApp = appByEmail;
          }
        }
        
        if (foundApp) {
          // Update it with the verified user's ID and phone verification
          const { data: updatedApp, error: updateError2 } = await supabase
            .from('pending_neighbor_applications')
            .update({
              ...updateData,
              user_id: user.id,
              phone: fallbackData.phone.trim(),
            })
            .eq('id', foundApp.id)
            .select()
            .single();
          
          if (updateError2 || !updatedApp) {
            throw new Error('Failed to update application. Please try again.');
          }
          
          return updatedApp;
        }
      }
      throw createError;
    }
  }

  if (error) {
    console.error('Error updating phone verification:', error);
    if (error.code === 'PGRST116') {
      throw new Error('Application not found. Please start the signup process again.');
    }
    throw error;
  }

  if (!application) {
    throw new Error('Failed to update application. Please try again.');
  }

  return application;
}

/**
 * Update pending application with address and date of birth
 * Called after application form submission (Step 3)
 */
export async function updateNeighborApplication(
  applicationId: string,
  data: {
    address: string;
    date_of_birth: string;
  }
): Promise<PendingNeighborApplication> {
  // Get current user to check user_id
  const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
  
  // First, try to find the application to see if it exists and check user_id
  const { data: existingApp, error: findError } = await supabase
    .from('pending_neighbor_applications')
    .select('id,user_id,status,email')
    .eq('id', applicationId)
    .maybeSingle();
  
  // Try RPC function first (bypasses RLS) if user is authenticated
  if (currentUser && !userError) {
    try {
      const { data: rpcApp, error: rpcError } = await supabase.rpc(
        'update_neighbor_application_address_dob',
        {
          p_application_id: applicationId,
          p_verified_user_id: currentUser.id,
          p_address: data.address.trim(),
          p_date_of_birth: data.date_of_birth,
        }
      );
      
      if (!rpcError && rpcApp) {
        return rpcApp;
      }
      
      // If RPC function doesn't exist (42883 = function does not exist), provide helpful message
      if (rpcError) {
        console.log('RPC function error (will try direct update):', rpcError.code, rpcError.message);
        
        // If function doesn't exist, throw helpful error
        if (rpcError.code === '42883' || rpcError.message?.includes('does not exist')) {
          throw new Error('Database function not found. Please run migration 014_update_application_address_dob.sql in Supabase.');
        }
        // Continue to fallback below for other RPC errors
      }
    } catch (rpcException: any) {
      console.log('RPC function call exception (will try direct update):', rpcException);
      // If it's a "function doesn't exist" error, throw it
      if (rpcException?.code === '42883' || rpcException?.message?.includes('does not exist')) {
        throw new Error('Database function not found. Please run migration 014_update_application_address_dob.sql in Supabase.');
      }
      // Continue to fallback below for other exceptions
    }
  }
  
  // Fallback: Try direct update (may fail due to RLS if user_id doesn't match)
  const { data: application, error } = await supabase
    .from('pending_neighbor_applications')
    .update({
      address: data.address.trim(),
      date_of_birth: data.date_of_birth,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating neighbor application:', error);
    
    // Provide helpful error message
    if (error.code === 'PGRST116') {
      throw new Error('Application not found. This may be due to a user ID mismatch. Please ensure migration 014_update_application_address_dob.sql has been run.');
    }
    
    throw error;
  }

  if (!application) {
    throw new Error('Failed to update application');
  }

  return application;
}

/**
 * Get application status
 * Called to check if application has been approved/rejected (Step 4)
 */
export async function getNeighborApplicationStatus(
  applicationId: string
): Promise<PendingNeighborApplication | null> {
  const { data: application, error } = await supabase
    .from('pending_neighbor_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No application found
      return null;
    }
    console.error('Error fetching application status:', error);
    throw error;
  }

  return application;
}

/**
 * Check if email or phone already exists
 * Used for pre-validation before signup
 * Uses a database function to bypass RLS
 */
export async function checkEmailPhoneExists(
  email: string,
  phone: string
): Promise<{ emailExists: boolean; phoneExists: boolean }> {
  // Use RPC function to bypass RLS (user isn't authenticated yet during signup)
  const { data, error } = await supabase.rpc('check_email_phone_exists', {
    p_email: email,
    p_phone: phone,
  });
  
  if (error) {
    console.error('Error checking email/phone exists:', error);
    // If RPC fails, return false to allow signup attempt (will fail at database level if duplicate)
    return { emailExists: false, phoneExists: false };
  }
  
  console.log('🔍 [checkEmailPhoneExists] RPC returned:', data);
  
  return {
    emailExists: data?.emailExists || false,
    phoneExists: data?.phoneExists || false,
  };
}

/**
 * Get application by user ID
 * Useful for checking if user has a pending application
 */
export async function getNeighborApplicationByUserId(
  userId: string
): Promise<PendingNeighborApplication | null> {
  console.log('🔍 [getNeighborApplicationByUserId] Looking for application with user_id:', userId);
  
  const { data: application, error } = await supabase
    .from('pending_neighbor_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('🔍 [getNeighborApplicationByUserId] Query result - data:', application, 'error:', error);

  if (error) {
    if (error.code === 'PGRST116') {
      console.log('ℹ️ [getNeighborApplicationByUserId] No application found (PGRST116)');
      return null;
    }
    console.error('❌ [getNeighborApplicationByUserId] Error:', error);
    throw error;
  }

  console.log('✅ [getNeighborApplicationByUserId] Found application:', application?.id, 'status:', application?.status);
  return application;
}

/**
 * Admin: Get all pending applications
 */
export async function getAllPendingNeighborApplications(): Promise<PendingNeighborApplication[]> {
  const { data: applications, error } = await supabase
    .from('pending_neighbor_applications')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending applications:', error);
    throw error;
  }

  return applications || [];
}

/**
 * Admin: Approve neighbor application
 * Creates full user profile and activates account
 */
export async function approveNeighborApplication(
  applicationId: string,
  adminId: string
): Promise<{ application: PendingNeighborApplication; profile: any }> {
  // Get the application
  const application = await getNeighborApplicationStatus(applicationId);
  
  if (!application) {
    throw new Error('Application not found');
  }

  if (application.status !== 'pending') {
    throw new Error(`Application is already ${application.status}`);
  }

  // Update application status
  const { data: updatedApplication, error: updateError } = await supabase
    .from('pending_neighbor_applications')
    .update({
      status: 'approved',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (updateError) {
    console.error('Error approving application:', updateError);
    throw updateError;
  }

  if (!updatedApplication) {
    throw new Error('Failed to update application status');
  }

  // Create full user profile
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .upsert({
      id: application.user_id,
      email: application.email,
      full_name: application.full_name,
      phone: application.phone,
      address: application.address,
      date_of_birth: application.date_of_birth,
      role: 'poster',
      verified: true,
      application_status: 'active',
    })
    .select()
    .single();

  if (profileError) {
    console.error('Error creating user profile:', profileError);
    // Rollback application status
    await supabase
      .from('pending_neighbor_applications')
      .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
      .eq('id', applicationId);
    throw profileError;
  }

  return {
    application: updatedApplication,
    profile: profile,
  };
}

/**
 * Admin: Reject neighbor application
 */
export async function rejectNeighborApplication(
  applicationId: string,
  adminId: string,
  reason?: string
): Promise<PendingNeighborApplication> {
  const { data: application, error } = await supabase
    .from('pending_neighbor_applications')
    .update({
      status: 'rejected',
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting application:', error);
    throw error;
  }

  if (!application) {
    throw new Error('Failed to update application status');
  }

  return application;
}
