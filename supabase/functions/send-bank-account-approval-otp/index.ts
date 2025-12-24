import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

/**
 * Generate a random 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

serve(async (req: Request) => {
  // #region agent log
  console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:22',message:'Function entry',data:{method:req.method,hasAuthHeader:!!req.headers.get('Authorization')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}));
  // #endregion
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    
    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:35',message:'Auth header check',data:{hasAuthHeader:!!authHeader,authHeaderLength:authHeader?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'}));
    // #endregion
    
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:47',message:'Environment variables check',data:{hasSupabaseUrl:!!supabaseUrl,hasServiceKey:!!supabaseServiceKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'}));
    // #endregion
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    
    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:52',message:'Before getUser',data:{tokenLength:token.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'}));
    // #endregion
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:57',message:'After getUser',data:{hasUser:!!user,hasError:!!userError,errorMessage:userError?.message,userId:user?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'}));
    // #endregion

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get teen user profile
    const { data: teenUser, error: teenError } = await supabase
      .from('users')
      .select('id, full_name, parent_id, role')
      .eq('id', user.id)
      .single()

    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:70',message:'After teen user query',data:{hasTeenUser:!!teenUser,hasError:!!teenError,errorMessage:teenError?.message,teenRole:teenUser?.role,hasParentId:!!teenUser?.parent_id,parentId:teenUser?.parent_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})).catch(()=>{});
    // #endregion

    if (teenError || !teenUser) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a teen
    if (teenUser.role !== 'teen') {
      return new Response(
        JSON.stringify({ error: 'Only teens can request bank account approval' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if teen has a parent
    if (!teenUser.parent_id) {
      return new Response(
        JSON.stringify({ error: 'No parent associated with this account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get parent's phone number
    const { data: parentUser, error: parentError } = await supabase
      .from('users')
      .select('id, phone, full_name, email')
      .eq('id', teenUser.parent_id)
      .single()

    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:95',message:'After parent user query',data:{hasParentUser:!!parentUser,hasError:!!parentError,errorMessage:parentError?.message,hasPhone:!!parentUser?.phone,phoneLength:parentUser?.phone?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'}));
    // #endregion

    if (parentError || !parentUser) {
      console.error('Parent user query error:', parentError)
      return new Response(
        JSON.stringify({ 
          error: 'Parent profile not found',
          details: parentError?.message || 'Parent user not found in database'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if parent has phone number, if not, try to get it from pending_teen_signups as fallback
    let parentPhone = parentUser.phone?.trim() || ''
    
    if (!parentPhone) {
      console.log('📞 Parent phone missing from users table, checking pending_teen_signups as fallback...')
      
      // Try to get phone from pending_teen_signups table
      const { data: pendingSignup, error: pendingError } = await supabase
        .from('pending_teen_signups')
        .select('parent_phone, parent_email')
        .eq('parent_email', parentUser.email?.toLowerCase() || '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!pendingError && pendingSignup?.parent_phone) {
        parentPhone = pendingSignup.parent_phone.trim()
        console.log('✅ Found parent phone in pending_teen_signups, using it:', parentPhone)
        
        // Update the users table with the phone number for future use
        // This ensures phone is always synced between both tables
        const { error: updateError } = await supabase
          .from('users')
          .update({ phone: parentPhone.trim() })
          .eq('id', parentUser.id)
        
        if (updateError) {
          console.warn('⚠️ Failed to update users table with phone from pending_teen_signups:', updateError)
          // Continue anyway - we have the phone number to use
        } else {
          console.log('✅ Successfully synced phone from pending_teen_signups to users table:', parentPhone)
          
          // Verify the sync worked
          const { data: verifiedUser } = await supabase
            .from('users')
            .select('phone')
            .eq('id', parentUser.id)
            .single()
          
          console.log('📞 Phone sync verification:', {
            phoneInUsers: verifiedUser?.phone,
            phoneMatches: verifiedUser?.phone === parentPhone.trim()
          })
        }
      } else {
        console.error('❌ Parent phone number missing from both users and pending_teen_signups:', { 
          parentId: parentUser.id,
          parentEmail: parentUser.email,
          pendingError: pendingError?.message
        })
        return new Response(
          JSON.stringify({ 
            error: 'Parent phone number not found',
            message: 'Parent phone number is required for bank account approval. Please contact support to update the parent profile with a phone number.',
            details: 'The parent account does not have a phone number on file. This is required to send the OTP code for bank account approval.'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Normalize phone number (ensure E.164 format with +)
    // Use parentPhone variable which may have been set from fallback
    const normalizedPhone = parentPhone.trim().replace(/\s+/g, '')
    const finalParentPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`

    // Generate OTP code
    const otpCode = generateOTP()

    // Set expiration to 15 minutes from now
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // Check if there's an existing pending approval
    const { data: existingApproval } = await supabase
      .from('bank_account_approvals')
      .select('id, status, expires_at, attempts')
      .eq('teen_id', teenUser.id)
      .single()

    // If there's an existing pending approval that hasn't expired, check rate limiting
    if (existingApproval && existingApproval.status === 'pending') {
      const expiresAtDate = new Date(existingApproval.expires_at)
      if (expiresAtDate > new Date()) {
        // Check if we've hit max attempts (5 attempts max)
        if (existingApproval.attempts >= 5) {
          return new Response(
            JSON.stringify({ 
              error: 'Maximum OTP verification attempts reached. Please request a new code after the current one expires.',
              expires_at: existingApproval.expires_at
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Rate limit: Only allow new OTP requests every 2 minutes
        const { data: lastRequest } = await supabase
          .from('bank_account_approvals')
          .select('updated_at')
          .eq('teen_id', teenUser.id)
          .single()
        
        if (lastRequest) {
          const lastRequestTime = new Date(lastRequest.updated_at)
          const timeSinceLastRequest = Date.now() - lastRequestTime.getTime()
          const twoMinutes = 2 * 60 * 1000
          
          if (timeSinceLastRequest < twoMinutes) {
            const waitSeconds = Math.ceil((twoMinutes - timeSinceLastRequest) / 1000)
            return new Response(
              JSON.stringify({ 
                error: `Please wait ${waitSeconds} seconds before requesting a new OTP code.`,
                retry_after: waitSeconds
              }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }

    // Insert or update bank_account_approval record
    const approvalData = {
      teen_id: teenUser.id,
      parent_phone: finalParentPhone,
      otp_code: otpCode,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified_at: null,
    }

    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:178',message:'Before upsert approval',data:{teenId:approvalData.teen_id,hasParentPhone:!!approvalData.parent_phone},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'}));
    // #endregion
    
    const { data: approval, error: approvalError } = await supabase
      .from('bank_account_approvals')
      .upsert(approvalData, {
        onConflict: 'teen_id',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:189',message:'After upsert approval',data:{hasApproval:!!approval,hasError:!!approvalError,errorMessage:approvalError?.message,errorCode:approvalError?.code,errorDetails:approvalError?.details},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'}));
    // #endregion

    if (approvalError) {
      console.error('Error creating approval record:', approvalError)
      return new Response(
        JSON.stringify({ error: 'Failed to create approval record', details: approvalError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send SMS via Twilio
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.warn('Twilio not configured. OTP code generated but SMS not sent.')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twilio not configured',
          message: 'OTP code generated but SMS not sent. Configure Twilio credentials in Edge Function secrets.',
          otp_code: otpCode, // Only return in dev/testing
          expires_at: expiresAt.toISOString(),
          note: 'In production, OTP codes should only be sent via SMS, never returned in API response.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Format SMS message
    const smsBody = `Your teen ${teenUser.full_name} requested bank account setup approval on Ollie. OTP code: ${otpCode}. This code expires in 15 minutes.`

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
    
    const formData = new URLSearchParams()
    formData.append('From', TWILIO_PHONE_NUMBER)
    formData.append('To', finalParentPhone)
    formData.append('Body', smsBody)

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const twilioData = await twilioResponse.json()

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', twilioData)
      
      // Update approval status to reflect SMS failure
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' }) // Mark as expired so they can retry
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send SMS',
          twilioError: twilioData.message || twilioData.error_message,
          message: 'Could not send OTP code to parent phone. Please check phone number and try again.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('OTP SMS sent successfully:', {
      to: finalParentPhone,
      teenName: teenUser.full_name,
      messageSid: twilioData.sid,
      status: twilioData.status,
      expiresAt: expiresAt.toISOString(),
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP code sent to parent phone',
        expires_at: expiresAt.toISOString(),
        parent_phone_masked: finalParentPhone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****') // Mask phone for privacy
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    // #region agent log
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:270',message:'Catch block error',data:{errorMessage:error?.message,errorName:error?.name,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'}));
    // #endregion
    
    console.error('Error in send-bank-account-approval-otp:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error',
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


