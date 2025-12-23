import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase credentials not found. Please add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env.local file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  } catch (error: any) {
    // Don't log PGRST116 errors - they're expected when profile doesn't exist yet
    // (e.g., during neighbor signup flow before approval)
    if (error.code !== 'PGRST116') {
    console.error('Error fetching user profile:', error);
    }
    throw error;
  }
}

// Auth helper functions
export async function signUp(email: string, password: string, metadata?: Record<string, any>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata || {},
      // Disable email confirmation requirement
      emailRedirectTo: undefined
    }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
    throw error;
  }
  // Ensure session is cleared by checking and logging
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.warn('Session still exists after signOut, attempting to clear again');
    // Try one more time
    await supabase.auth.signOut();
  }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'ollie://reset-password'
  });
  if (error) throw error;
}

// Get the appropriate redirect URL based on platform
function getRedirectUrl() {
  if (Platform.OS === 'web') {
    // For web, use the current origin + callback path
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/callback`;
    }
    // Fallback for web - use Supabase redirect
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    if (url) {
      return `${url}/auth/v1/callback`;
    }
  }
  // For mobile (iOS/Android), use deep link
  return 'ollie://auth/callback';
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectUrl(),
    }
  });
  if (error) throw error;
  return data;
}

export async function signInWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: getRedirectUrl(),
    }
  });
  if (error) throw error;
  return data;
}

export async function createUserProfile(userId: string, profileData: {
  email: string;
  full_name: string;
  role: string;
  date_of_birth?: string;
  parent_email?: string;
  phone?: string;
}) {
  // Use RPC function to bypass RLS during signup
  // This ensures the profile can be created even if the session isn't fully established
  const { data, error } = await supabase.rpc('create_user_profile', {
    p_user_id: userId,
    p_email: profileData.email,
    p_full_name: profileData.full_name,
    p_role: profileData.role,
    p_date_of_birth: profileData.date_of_birth || null,
    p_parent_email: profileData.parent_email || null,
    p_phone: profileData.phone || null,
  });
  
  if (error) {
    // Fallback to direct insert if function doesn't exist (for backwards compatibility)
    console.warn('RPC function failed, trying direct insert:', error);
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: profileData.email,
        full_name: profileData.full_name,
        role: profileData.role,
        date_of_birth: profileData.date_of_birth,
        parent_email: profileData.parent_email,
        phone: profileData.phone,
        verified: false
      })
      .select()
      .single();
    if (insertError) {
      console.error('Failed to create user profile:', insertError);
      throw insertError;
    }
    return insertData;
  }
  
  if (!data) {
    throw new Error('Profile creation succeeded but no data returned');
  }
  
  return data;
}

// Parent approval functions
export async function createPendingTeenSignup(signupData: {
  full_name: string;
  date_of_birth: string;
  parent_email: string;
}) {
  // Normalize parent email (trim and lowercase) for consistent storage and searching
  const normalizedParentEmail = signupData.parent_email.trim().toLowerCase();
  // Normalize full name (trim and lowercase) for consistent matching
  const normalizedFullName = signupData.full_name.trim().toLowerCase();

  // Check for existing pending signups with the same parent email AND full name
  // This ensures we're matching the same teen, not just the same parent
  const { data: existingSignups } = await supabase
    .from('pending_teen_signups')
    .select('id, full_name, status, created_at')
    .eq('parent_email', normalizedParentEmail)
    .ilike('full_name', normalizedFullName) // Case-insensitive match by full name
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: false });

  // If there's an existing pending signup for the same teen, return it instead of creating a new one
  if (existingSignups && existingSignups.length > 0) {
    const pendingSignup = existingSignups.find(s => s.status === 'pending');
    if (pendingSignup) {
      console.log('⚠️ Existing pending signup found for same teen, returning it instead of creating duplicate');
      // Fetch the full record with token
      const { data: fullRecord } = await supabase
        .from('pending_teen_signups')
        .select('*')
        .eq('id', pendingSignup.id)
        .single();
      
      if (fullRecord) {
        return fullRecord;
      }
    }
    
    // If there's an approved signup for the same teen, that's also fine - the teen can complete their account
    const approvedSignup = existingSignups.find(s => s.status === 'approved');
    if (approvedSignup) {
      console.log('ℹ️ Existing approved signup found for same teen, returning it');
      const { data: fullRecord } = await supabase
        .from('pending_teen_signups')
        .select('*')
        .eq('id', approvedSignup.id)
        .single();
      
      if (fullRecord) {
        return fullRecord;
      }
    }
  }

  // Generate approval token
  const approvalToken = Crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  console.log('Creating new pending signup with data:', {
    full_name: signupData.full_name,
    date_of_birth: signupData.date_of_birth,
    parent_email: signupData.parent_email,
    normalized_parent_email: normalizedParentEmail,
    approval_token: approvalToken,
    token_expires_at: expiresAt.toISOString(),
    status: 'pending'
  });

  const { data, error } = await supabase
    .from('pending_teen_signups')
    .insert({
      full_name: signupData.full_name,
      date_of_birth: signupData.date_of_birth,
      parent_email: normalizedParentEmail,
      approval_token: approvalToken,
      token_expires_at: expiresAt.toISOString(),
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    // Log error in multiple ways to ensure we see it
    console.error('=== SUPABASE INSERT ERROR ===');
    console.error('Error exists:', !!error);
    console.error('Error type:', typeof error);
    
    // Try different ways to access error properties
    const errorMessage = (error as any)?.message || '';
    const errorCode = (error as any)?.code || '';
    const errorDetails = (error as any)?.details || '';
    const errorHint = (error as any)?.hint || '';
    
    // Log each property separately
    console.error('Error message:', errorMessage || '(empty)');
    console.error('Error code:', errorCode || '(empty)');
    console.error('Error details:', errorDetails || '(empty)');
    console.error('Error hint:', errorHint || '(empty)');
    
    // Try to access error properties using bracket notation
    console.error('error["message"]:', (error as any)['message']);
    console.error('error["code"]:', (error as any)['code']);
    console.error('error["details"]:', (error as any)['details']);
    console.error('error["hint"]:', (error as any)['hint']);
    
    // Try to log the error as a string
    try {
      console.error('Error toString:', String(error));
    } catch (e) {
      console.error('Could not convert to string:', e);
    }
    
    // Try to access all enumerable properties
    try {
      const keys = Object.keys(error as any);
      console.error('Error keys:', keys);
      keys.forEach(key => {
        console.error(`Error.${key}:`, (error as any)[key]);
      });
    } catch (e) {
      console.error('Could not enumerate error properties:', e);
    }
    
    // Create a readable error message
    const readableError = errorMessage || errorDetails || errorHint || (errorCode ? `Database error (code: ${errorCode})` : 'Failed to create pending signup');
    
    console.error('Final readable error message:', readableError);
    
    // Throw error with all available info
    const fullError = new Error(readableError);
    (fullError as any).code = errorCode;
    (fullError as any).details = errorDetails;
    (fullError as any).hint = errorHint;
    throw fullError;
  }
  
  if (!data) {
    throw new Error('No data returned from insert');
  }
  
  return { ...data, approval_token: approvalToken };
}

export async function getPendingSignupByToken(token: string) {
  const { data, error } = await supabase
    .from('pending_teen_signups')
    .select('*')
    .eq('approval_token', token)
    .eq('status', 'pending')
    .single();

  if (error) throw error;
  
  // Check if token is expired
  if (new Date(data.token_expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('pending_teen_signups')
      .update({ status: 'expired' })
      .eq('id', data.id);
    throw new Error('Approval token has expired');
  }

  return data;
}

// Get pending signup by token without status filter (for parent approval screen)
export async function getPendingSignupByTokenAnyStatus(token: string) {
  const { data, error } = await supabase
    .from('pending_teen_signups')
    .select('*')
    .eq('approval_token', token)
    .single();

  if (error) {
    console.error('Error fetching signup by token:', error);
    throw error;
  }
  
  if (!data) {
    throw new Error('Approval token not found');
  }

  // Check if token is expired (only if still pending)
  if (data.status === 'pending' && new Date(data.token_expires_at) < new Date()) {
    // Mark as expired
    await supabase
      .from('pending_teen_signups')
      .update({ status: 'expired' })
      .eq('id', data.id);
    return { ...data, status: 'expired' };
  }

  return data;
}

export async function approveTeenSignup(token: string) {
  // Get pending signup
  const pendingSignup = await getPendingSignupByToken(token);
  if (!pendingSignup) throw new Error('Pending signup not found or already processed.');

  // Just update status to approved - don't create account yet
  // The teen will create the account after approval
  const { error: updateError } = await supabase
    .from('pending_teen_signups')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString()
    })
    .eq('id', pendingSignup.id);

  if (updateError) throw updateError;

  return { pendingSignup };
}

export async function completeTeenSignup(parentEmail: string, email: string, password: string) {
  // Get the approved pending signup (use AnyStatus to find approved signups)
  const pendingSignup = await getPendingSignupByParentEmailAnyStatus(parentEmail);
  
  if (!pendingSignup || pendingSignup.status !== 'approved') {
    throw new Error('No approved signup found for this parent email.');
  }

  // Create the actual account
  const { user, error: signUpError } = await signUp(email, password, {
    full_name: pendingSignup.full_name,
    role: 'teen'
  });

  if (signUpError) throw signUpError;
  if (!user) throw new Error('Failed to create user account');

  // Create user profile
  let profile;
  try {
    profile = await createUserProfile(user.id, {
    email: email,
    full_name: pendingSignup.full_name,
    role: 'teen',
    date_of_birth: pendingSignup.date_of_birth,
    parent_email: pendingSignup.parent_email
  });
  } catch (profileError: any) {
    throw profileError;
  }

  // Note: We don't update the pending signup with email/password anymore
  // since those fields have been removed from the table

  return { user, profile, pendingSignup };
}

export async function rejectTeenSignup(token: string) {
  const { data, error } = await supabase
    .from('pending_teen_signups')
    .update({ status: 'rejected' })
    .eq('approval_token', token)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getPendingSignupByParentEmail(parentEmail: string) {
  const { data, error } = await supabase
    .from('pending_teen_signups')
    .select('*')
    .eq('parent_email', parentEmail)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
}

// Get pending signup by parent email AND birthdate with any status (for checking approval status)
export async function getPendingSignupByParentEmailAndBirthdate(parentEmail: string, birthdate: string) {
  const normalizedEmail = parentEmail.trim().toLowerCase();
  console.log('🔍 [getPendingSignupByParentEmailAndBirthdate] Searching for:', { 
    parentEmail: normalizedEmail, 
    birthdate 
  });
  
  // Search by both parent email AND birthdate (any status)
  const { data, error } = await supabase
    .from('pending_teen_signups')
    .select('*')
    .eq('parent_email', normalizedEmail)
    .eq('date_of_birth', birthdate)
    // NOTE: NO .eq('status', ...) filter - we want ANY status
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('📊 [getPendingSignupByParentEmailAndBirthdate] Query result:', { 
    hasData: !!data, 
    hasError: !!error,
    errorCode: error?.code,
    errorMessage: error?.message,
    dataStatus: data?.status,
    storedParentEmail: data?.parent_email,
    storedBirthdate: data?.date_of_birth,
  });

  if (error && error.code !== 'PGRST116') {
    console.error('❌ [getPendingSignupByParentEmailAndBirthdate] Error:', error);
    throw error;
  }
  
  if (!data) {
    console.log('⚠️ [getPendingSignupByParentEmailAndBirthdate] No signup found');
  } else {
    console.log('✅ [getPendingSignupByParentEmailAndBirthdate] Found signup:', { 
      id: data.id, 
      status: data.status, 
      parentEmail: data.parent_email,
      birthdate: data.date_of_birth,
    });
  }
  
  return data;
}

// Get pending signup by parent email with any status (for checking approval status)
// DEPRECATED: Use getPendingSignupByParentEmailAndBirthdate instead for better security
export async function getPendingSignupByParentEmailAnyStatus(parentEmail: string) {
  const normalizedEmail = parentEmail.trim().toLowerCase();
  console.log('🔍 [getPendingSignupByParentEmailAnyStatus] Searching for:', normalizedEmail);
  console.log('🔍 [getPendingSignupByParentEmailAnyStatus] Original:', parentEmail);
  
  // First, let's see what's actually in the database (NO STATUS FILTER - any status)
  const { data: allSignups, error: allError } = await supabase
    .from('pending_teen_signups')
    .select('id, parent_email, status, created_at, full_name')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('📋 [getPendingSignupByParentEmailAnyStatus] All signups in DB (ANY STATUS):', allSignups);
  if (allError) {
    console.error('❌ [getPendingSignupByParentEmailAnyStatus] Error fetching all:', allError);
  }
  
  // Try exact match with normalized email (NO STATUS FILTER - any status)
  let { data, error } = await supabase
    .from('pending_teen_signups')
    .select('*')
    .eq('parent_email', normalizedEmail)
    // NOTE: NO .eq('status', ...) filter - we want ANY status
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('📊 [getPendingSignupByParentEmailAnyStatus] Exact match result:', { 
    hasData: !!data, 
    hasError: !!error,
    errorCode: error?.code,
  });

  // If no exact match, fetch all and filter in JavaScript (more reliable)
  if (!data && !error) {
    console.log('⚠️ [getPendingSignupByParentEmailAnyStatus] No exact match, filtering in JS...');
    if (allSignups && allSignups.length > 0) {
      const match = allSignups.find(s => {
        const storedEmail = s.parent_email?.trim().toLowerCase();
        return storedEmail === normalizedEmail;
      });
      
      if (match) {
        console.log('✅ [getPendingSignupByParentEmailAnyStatus] Found via JS filter:', match);
        // Fetch full record
        const { data: fullData } = await supabase
          .from('pending_teen_signups')
          .select('*')
          .eq('id', match.id)
          .single();
        data = fullData || null;
      } else {
        console.log('❌ [getPendingSignupByParentEmailAnyStatus] No match in JS filter');
        console.log('📋 [getPendingSignupByParentEmailAnyStatus] Searched:', normalizedEmail);
        console.log('📋 [getPendingSignupByParentEmailAnyStatus] Available:', allSignups.map(s => s.parent_email?.trim().toLowerCase()));
      }
    }
  }

  console.log('📊 [getPendingSignupByParentEmailAnyStatus] Final result:', { 
    hasData: !!data, 
    status: data?.status, // Should be 'pending', 'approved', 'rejected', or 'expired'
    storedEmail: data?.parent_email,
    searchedEmail: normalizedEmail,
  });
  
  // Verify we're not filtering by status
  if (data) {
    console.log('✅ [getPendingSignupByParentEmailAnyStatus] Found signup with status:', data.status);
  } else {
    console.log('❌ [getPendingSignupByParentEmailAnyStatus] No signup found');
    console.log('🔍 [getPendingSignupByParentEmailAnyStatus] Searched for:', normalizedEmail);
    if (allSignups) {
      const matchingEmails = allSignups.filter(s => {
        const stored = s.parent_email?.trim().toLowerCase();
        return stored === normalizedEmail;
      });
      console.log('🔍 [getPendingSignupByParentEmailAnyStatus] Matching emails in allSignups:', matchingEmails);
    }
  }

  if (error && error.code !== 'PGRST116') {
    console.error('❌ [getPendingSignupByParentEmailAnyStatus] Error:', error);
    throw error;
  }
  
  return data;
}

// Helper to send parent approval email (this would typically call a Supabase Edge Function or email service)
// Email verification functions
export async function sendVerificationCode(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string) {
  // For signup verification, Supabase sends 'signup' type tokens
  // Try 'signup' type first since that's what gets sent during signup
  let { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token,
    type: 'signup',
  });
  
  // If that fails, try 'email' type (for general email verification/resend)
  if (error) {
    console.log('Signup type failed, trying email type:', error.message);
    const { data: emailData, error: emailError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    
    if (!emailError) {
      return emailData;
    }
    // If both fail, throw the original signup error (more specific)
  }
  
  if (error) throw error;
  return data;
}

export async function resendVerificationCode(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
  });
  if (error) {
    // Handle rate limiting gracefully
    if (error.message?.includes('after') || error.message?.includes('seconds')) {
      throw new Error('Please wait a moment before requesting another code. This is a security measure to prevent spam.');
    }
    throw error;
  }
}

// ============================================
// SMS/Phone OTP Functions
// ============================================

/**
 * Send OTP code to phone number via SMS
 * @param phone Phone number in E.164 format (e.g., +1234567890)
 */
export async function sendPhoneOTP(phone: string) {
  // Normalize phone number (remove spaces, ensure + prefix)
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  const phoneWithPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;
  
  console.log('📱 [sendPhoneOTP] ==========================================');
  console.log('📱 [sendPhoneOTP] Sending OTP to:', phoneWithPlus);
  console.log('📱 [sendPhoneOTP] Supabase URL:', supabaseUrl);
  console.log('📱 [sendPhoneOTP] Supabase URL valid:', !supabaseUrl.includes('placeholder'));
  console.log('📱 [sendPhoneOTP] Using Supabase auth.signInWithOtp');
  console.log('📱 [sendPhoneOTP] Request payload:', JSON.stringify({ 
    phone: phoneWithPlus,
    options: { channel: 'sms', shouldCreateUser: true }
  }, null, 2));
  
  // Try with explicit channel and options
  const { data, error } = await supabase.auth.signInWithOtp({
    phone: phoneWithPlus,
    options: {
      // Explicitly request SMS channel (not call)
      channel: 'sms',
      // Ensure we're not in test mode
      shouldCreateUser: true,
    },
  });
  
  console.log('📱 [sendPhoneOTP] API call completed');
  console.log('📱 [sendPhoneOTP] Has error:', !!error);
  console.log('📱 [sendPhoneOTP] Has data:', !!data);
  
  if (error) {
    console.error('❌ [sendPhoneOTP] Error object:', error);
    console.error('❌ [sendPhoneOTP] Error type:', typeof error);
    console.error('❌ [sendPhoneOTP] Error code:', error.code);
    console.error('❌ [sendPhoneOTP] Error message:', error.message);
    console.error('❌ [sendPhoneOTP] Error name:', error.name);
    console.error('❌ [sendPhoneOTP] Error status:', (error as any).status);
    console.error('❌ [sendPhoneOTP] Error statusCode:', (error as any).statusCode);
    
    // Try to get more details
    const errorDetails: any = {
      code: error.code,
      message: error.message,
      name: error.name,
      status: (error as any).status,
      statusCode: (error as any).statusCode,
    };
    
    // Try to get response body if available
    if ((error as any).response) {
      errorDetails.response = (error as any).response;
    }
    if ((error as any).body) {
      errorDetails.body = (error as any).body;
    }
    
    console.error('❌ [sendPhoneOTP] Error details:', errorDetails);
    console.error('❌ [sendPhoneOTP] Full error (all properties):', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Handle rate limiting
    if (error.message?.includes('after') || error.message?.includes('seconds')) {
      throw new Error('Please wait a moment before requesting another code. This is a security measure to prevent spam.');
    }
    
    // Check for specific error codes
    if (error.code === '21211' || (error as any).status === 400) {
      // This might be a Twilio error or validation error
      const actualMessage = error.message || 'Invalid phone number';
      throw new Error(`Phone number error: ${actualMessage}\n\nPlease verify:\n1. Number is correct and active\n2. It's a mobile number (not landline)\n3. It can receive SMS\n\nPhone used: ${phoneWithPlus}`);
    }
    
    // Provide more helpful error messages
    if (error.message?.includes('phone') || error.message?.includes('invalid')) {
      throw new Error(`Invalid phone number: ${error.message}\n\nPhone used: ${phoneWithPlus}\n\nPlease verify:\n1. Number is correct and active\n2. It's a mobile number (not landline)\n3. It can receive SMS\n\nIf using a US number, format: +1XXXXXXXXXX`);
    }
    if (error.message?.includes('Twilio') || error.message?.includes('SMS')) {
      throw new Error('SMS service error. Please check Twilio configuration in Supabase dashboard.');
    }
    
    // Re-throw with original error message if we haven't handled it
    throw new Error(error.message || `Failed to send OTP. Error: ${JSON.stringify(errorDetails)}`);
  }
  
  console.log('✅ [sendPhoneOTP] Supabase returned success (no error)');
  console.log('📱 [sendPhoneOTP] Full response:', JSON.stringify(data, null, 2));
  console.log('📱 [sendPhoneOTP] Phone number used:', phoneWithPlus);
  
  // Check response structure
  if (data?.user) {
    console.log('📱 [sendPhoneOTP] User object present:', !!data.user);
  }
  if (data?.session) {
    console.log('📱 [sendPhoneOTP] Session object present:', !!data.session);
  }
  if (data?.message) {
    console.log('📱 [sendPhoneOTP] Message:', data.message);
  }
  
  // Note: {user: null, session: null} is NORMAL for OTP requests
  // The real test is whether SMS actually arrives and appears in Twilio logs
  // If no SMS arrives AND no Twilio logs, Supabase isn't calling Twilio
  console.log('ℹ️ [sendPhoneOTP] Response structure is normal (user/session null until verified)');
  console.log('ℹ️ [sendPhoneOTP] To verify SMS was sent:');
  console.log('   1. Check if SMS arrives on phone');
  console.log('   2. Check Twilio Console logs (Verify or Messaging)');
  console.log('   3. If NO SMS and NO Twilio logs → Phone provider likely disabled in Supabase');
  
  // IMPORTANT: For Twilio Verify, check Verify logs (not Messaging logs)!
  console.log('🔍 [sendPhoneOTP] Debug checklist:');
  console.log('   1. Check Twilio Console → Verify → Logs (NOT Messaging logs!)');
  console.log('   2. Check Twilio Console → Messaging → Logs (if using regular Twilio)');
  console.log('   3. Verify SMS provider is configured in Supabase Dashboard');
  console.log('   4. Verify Phone provider is enabled in Supabase');
  console.log('   5. Check if phone number is verified in Twilio (trial accounts)');
  console.log('📱 [sendPhoneOTP] ==========================================');
  
  // Note: user and session are null until OTP is verified - this is normal
  if (data?.user === null && data?.session === null) {
    console.log('ℹ️ [sendPhoneOTP] Response is normal - user/session null until OTP verified');
  }
  
  return data;
}

/**
 * Verify OTP code sent to phone number
 * @param phone Phone number in E.164 format (e.g., +1234567890)
 * @param token 6-digit OTP code
 */
export async function verifyPhoneOTP(phone: string, token: string) {
  // Normalize phone number
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  const phoneWithPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;
  
  // Clean token (remove spaces, only digits)
  const cleanToken = token.replace(/\s+/g, '').replace(/\D/g, '');
  
  if (cleanToken.length !== 6) {
    throw new Error('OTP code must be 6 digits');
  }
  
  const { data, error } = await supabase.auth.verifyOtp({
    phone: phoneWithPlus,
    token: cleanToken,
    type: 'sms',
  });
  
  if (error) {
    // Provide helpful error messages
    if (error.message?.toLowerCase().includes('expired')) {
      throw new Error('This verification code has expired. Please request a new one.');
    }
    if (error.message?.toLowerCase().includes('invalid')) {
      throw new Error('Invalid verification code. Please check and try again.');
    }
    throw error;
  }
  
  return data;
}

/**
 * Resend OTP code to phone number
 * @param phone Phone number in E.164 format (e.g., +1234567890)
 */
export async function resendPhoneOTP(phone: string) {
  // Normalize phone number
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  const phoneWithPlus = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`;
  
  const { error } = await supabase.auth.resend({
    type: 'sms',
    phone: phoneWithPlus,
  });
  
  if (error) {
    // Handle rate limiting gracefully
    if (error.message?.includes('after') || error.message?.includes('seconds')) {
      throw new Error('Please wait a moment before requesting another code. This is a security measure to prevent spam.');
    }
    if (error.message?.includes('rate limit')) {
      throw new Error('Too many requests. Please wait a moment before requesting another code.');
    }
    throw error;
  }
}

// Helper to send parent approval email (this would typically call a Supabase Edge Function or email service)
export async function sendParentApprovalEmail(parentEmail: string, token: string, teenInfo: {
  teenName: string;
  teenAge: number;
}) {
  const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'http://localhost:8081';
  const approvalUrl = `${webAppUrl}/parent-approve?token=${token}`;
  
  try {
    // Use Supabase Edge Function with Resend
    // Note: Edge Functions require authentication, so we use the anon key
    // IMPORTANT: Use the SLUG, not the function name (slug is shown in Dashboard → Details)
    const { data, error } = await supabase.functions.invoke('quick-action', {
      body: {
        parentEmail,
        token,
        teenName: teenInfo.teenName,
        teenAge: teenInfo.teenAge,
        approvalUrl,
      },
    });

    // Log full response for debugging
    console.log('📧 Edge Function response:', { 
      hasData: !!data, 
      hasError: !!error,
      dataKeys: data ? Object.keys(data) : null,
      errorType: error?.name,
      errorStatus: (error as any)?.context?.status,
    });

    // If we have data, use it (even if there's also an error)
    if (data) {
      console.log('✅ Edge Function returned data:', data);
      // If data has success field, use it
      if (data.success === true || data.success === false) {
        return data;
      }
      // If no success field but we have data, assume success
      return { success: true, ...data };
    }

    // Handle 404 specifically - function not found
    if (error && (error as any).context?.status === 404) {
      console.error('❌ Edge Function returned 404 (Not Found)');
      console.error('Function URL attempted:', (error as any).context?.url);
      console.error('This means the function is not deployed or has a different name.');
      console.error('');
      console.error('To fix:');
      console.error('   1. Go to Supabase Dashboard → Edge Functions → Functions');
      console.error('   2. Verify the function name is exactly: send-parent-approval-email');
      console.error('   3. If the name is different, either:');
      console.error('      - Rename the function in Dashboard to match, OR');
      console.error('      - Update the function name in lib/supabase.ts line 332');
      console.error('   4. Make sure the function is DEPLOYED (not just saved)');
      console.error('   5. Try redeploying the function');
      console.error('');
      console.error('Note: The function works in Dashboard test, so it exists but may have a different name.');
      
      // Don't block the flow - return approvalUrl so parent can still approve
      return { 
        success: false, 
        error: 'Edge Function not found (404). Check function name matches exactly.',
        approvalUrl, // Return approvalUrl so parent can still approve manually
      };
    }

    if (error) {
      console.error('❌ Error calling email function:', error);
      console.error('Error name:', (error as any).name);
      console.error('Error status:', (error as any).context?.status);
      console.error('Error message:', error.message);
      
      // Try to extract response body if available
      try {
        const errorBody = (error as any).context?._bodyInit?._data;
        if (errorBody) {
          console.error('Error response body:', errorBody);
        }
      } catch (e) {
        // Ignore
      }
      
      // Don't throw - allow flow to continue even if email fails
      // The pending signup is created, parent can still approve via direct link
      return { 
        success: false, 
        error: error.message || 'Unknown error',
        approvalUrl, // Return approvalUrl so parent can still approve manually
        note: 'Email sending may have failed, but signup request was created. Parent can approve via direct link.'
      };
    }

    // If we get here with no data and no error, something unexpected happened
    console.warn('⚠️ Edge Function returned no data and no error');
    return { success: false, error: 'No response from Edge Function', approvalUrl };
  } catch (error: any) {
    console.error('❌ Exception calling Edge Function:', error);
    // Log email details for debugging
    console.log('📧 Email details (for debugging):', {
      to: parentEmail,
      subject: `Parental Approval Required for Your Teen to Use Ollie`,
      approvalUrl,
      teenName: teenInfo.teenName,
      teenAge: teenInfo.teenAge,
    });
    
    // Don't throw error - allow the flow to continue even if email fails
    // The pending signup is still created, email can be sent manually if needed
    console.warn('⚠️ Email sending failed, but signup request was created. Check Edge Function logs.');
    return { success: false, error: error.message || 'Unknown error', approvalUrl };
  }
}

// Re-export profile functions from api/users
export { updateProfile, uploadProfilePhoto } from './api/users';

