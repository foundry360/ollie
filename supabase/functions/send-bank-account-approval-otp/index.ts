import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Note: OTP code generation removed - Twilio Verify generates the code automatically

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
    console.log(JSON.stringify({location:'send-bank-account-approval-otp/index.ts:70',message:'After teen user query',data:{hasTeenUser:!!teenUser,hasError:!!teenError,errorMessage:teenError?.message,teenRole:teenUser?.role,hasParentId:!!teenUser?.parent_id,parentId:teenUser?.parent_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'}));
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

    // Get parent's phone number from users table
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

    // Get parent phone from users table - this is the source of truth
    const parentPhone = parentUser.phone?.trim() || ''
    
    if (!parentPhone) {
      console.error('❌ Parent phone number missing from users table:', { 
        parentId: parentUser.id,
        parentEmail: parentUser.email,
        parentName: parentUser.full_name
      })
      return new Response(
        JSON.stringify({ 
          error: 'Parent phone number not found',
          message: 'Parent phone number is required for bank account approval. The parent account does not have a phone number on file in the users table.',
          details: 'Please ensure the parent profile has a phone number set in the users table. This is required to send the OTP code for bank account approval.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize phone number (ensure E.164 format with +)
    // Parent phone is retrieved from users table - this is the source of truth
    const normalizedPhone = parentPhone.trim().replace(/\s+/g, '')
    const finalParentPhone = normalizedPhone.startsWith('+') ? normalizedPhone : `+${normalizedPhone}`

    // Set expiration to 15 minutes from now (Twilio Verify default is 10 minutes, but we'll track our own)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 15)

    // Check if there's an existing pending approval
    const { data: existingApproval, error: existingApprovalError } = await supabase
      .from('bank_account_approvals')
      .select('id, status, expires_at, attempts')
      .eq('teen_id', teenUser.id)
      .maybeSingle()
    
    // Log any error (but don't fail - maybeSingle returns null if no record exists)
    if (existingApprovalError && existingApprovalError.code !== 'PGRST116') {
      console.error('Error checking existing approval:', existingApprovalError)
    }

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
          .maybeSingle()
        
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
    // Note: otp_code will be set to verification SID after Twilio Verify sends the code
    // Use temporary placeholder if column is still NOT NULL (will be updated after Twilio call)
    const approvalData: any = {
      teen_id: teenUser.id,
      parent_phone: finalParentPhone,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified_at: null,
    }
    
    // Only include otp_code if migration has been run (column is nullable)
    // Otherwise, we'll update it after the Twilio Verify call succeeds
    // For now, use a placeholder that will be replaced
    approvalData.otp_code = 'PENDING_VERIFICATION'

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

    // Read Twilio config inside the handler (in case of timing issues)
    console.log('📞 [send-bank-account-approval-otp] Reading Twilio environment variables...')
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_VERIFY_SERVICE_SID = Deno.env.get('TWILIO_VERIFY_SERVICE_SID')

    // Debug: Check what Twilio secrets are available
    const allEnvKeys = Object.keys(Deno.env.toObject())
    const twilioKeys = allEnvKeys.filter((k: string) => k.includes('TWILIO'))
    
    console.log('🔍 [send-bank-account-approval-otp] Twilio config check:', JSON.stringify({
      hasAccountSid: !!TWILIO_ACCOUNT_SID,
      hasAuthToken: !!TWILIO_AUTH_TOKEN,
      hasVerifyServiceSid: !!TWILIO_VERIFY_SERVICE_SID,
      accountSidLength: TWILIO_ACCOUNT_SID?.length || 0,
      authTokenLength: TWILIO_AUTH_TOKEN?.length || 0,
      verifyServiceSidLength: TWILIO_VERIFY_SERVICE_SID?.length || 0,
      allTwilioKeys: twilioKeys,
      accountSidFirstChars: TWILIO_ACCOUNT_SID ? TWILIO_ACCOUNT_SID.substring(0, 3) : 'N/A',
      authTokenFirstChars: TWILIO_AUTH_TOKEN ? TWILIO_AUTH_TOKEN.substring(0, 3) : 'N/A'
    }));

    // Send OTP via Twilio Verify
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
      console.error('❌ Twilio Verify not configured. Missing secrets:', {
        hasAccountSid: !!TWILIO_ACCOUNT_SID,
        hasAuthToken: !!TWILIO_AUTH_TOKEN,
        hasVerifyServiceSid: !!TWILIO_VERIFY_SERVICE_SID
      })
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twilio Verify not configured',
          message: 'Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID in Edge Function secrets.',
          expires_at: expiresAt.toISOString(),
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('✅ Twilio Verify configured. Sending OTP via Verify API...')

    // Send OTP via Twilio Verify API
    const verifyUrl = `https://verify.twilio.com/v2/Services/${TWILIO_VERIFY_SERVICE_SID}/Verifications`

    const formData = new URLSearchParams()
    formData.append('To', finalParentPhone)
    formData.append('Channel', 'sms')

    console.log('📤 [send-bank-account-approval-otp] Sending OTP via Twilio Verify:', {
      to: finalParentPhone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****'), // Mask for privacy
      serviceSid: TWILIO_VERIFY_SERVICE_SID,
      channel: 'sms'
    })

    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const verifyData = await verifyResponse.json()
    
    console.log('📥 [send-bank-account-approval-otp] Twilio Verify API response:', JSON.stringify({
      ok: verifyResponse.ok,
      httpStatus: verifyResponse.status,
      verificationSid: verifyData.sid,
      status: verifyData.status,
      error: verifyData.error_message || verifyData.message
    }, null, 2))

    if (!verifyResponse.ok) {
      console.error('❌ Twilio Verify API error:', JSON.stringify(verifyData, null, 2))
      
      // Update approval status to reflect SMS failure
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to send OTP via Twilio Verify',
          twilioError: verifyData.message || verifyData.error_message,
          twilioErrorCode: verifyData.code,
          message: 'Could not send OTP code to parent phone. Please check phone number and try again.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store the verification SID instead of OTP code (Twilio Verify handles the code)
    // Update the approval record to store verification SID
    await supabase
      .from('bank_account_approvals')
      .update({ 
        otp_code: verifyData.sid, // Store verification SID instead of generated code
        parent_phone: finalParentPhone 
      })
      .eq('id', approval.id)

    console.log('✅ OTP sent via Twilio Verify:', {
      to: finalParentPhone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****'),
      teenName: teenUser.full_name,
      verificationSid: verifyData.sid,
      status: verifyData.status,
      expiresAt: expiresAt.toISOString(),
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'OTP code sent to parent phone via Twilio Verify',
        expires_at: expiresAt.toISOString(),
        parent_phone_masked: finalParentPhone.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d{4})/, '$1***$2****'),
        verification_sid: verifyData.sid // Include for tracking
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


