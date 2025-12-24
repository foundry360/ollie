import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    // Get request body
    const { otp_code } = await req.json()

    if (!otp_code) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: otp_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Clean OTP code (remove spaces, only digits)
    const cleanOTP = otp_code.toString().replace(/\s+/g, '').replace(/\D/g, '')

    if (cleanOTP.length !== 6) {
      return new Response(
        JSON.stringify({ error: 'OTP code must be 6 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify user token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get teen user profile
    const { data: teenUser, error: teenError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (teenError || !teenUser) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a teen
    if (teenUser.role !== 'teen') {
      return new Response(
        JSON.stringify({ error: 'Only teens can verify bank account approval OTP' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get pending approval for this teen
    const { data: approval, error: approvalError } = await supabase
      .from('bank_account_approvals')
      .select('*')
      .eq('teen_id', teenUser.id)
      .single()

    if (approvalError || !approval) {
      return new Response(
        JSON.stringify({ error: 'No approval request found. Please request a new OTP code.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already approved
    if (approval.status === 'approved') {
      return new Response(
        JSON.stringify({ 
          success: true,
          approved: true,
          message: 'Bank account approval already verified',
          verified_at: approval.verified_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if expired
    const expiresAt = new Date(approval.expires_at)
    const now = new Date()
    
    if (expiresAt <= now) {
      // Mark as expired
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          error: 'OTP code has expired. Please request a new code.',
          expired: true,
          expires_at: approval.expires_at
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if max attempts reached
    if (approval.attempts >= 5) {
      // Mark as expired due to too many attempts
      await supabase
        .from('bank_account_approvals')
        .update({ status: 'expired' })
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          error: 'Maximum verification attempts reached. Please request a new OTP code.',
          max_attempts_reached: true
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify OTP code
    if (approval.otp_code !== cleanOTP) {
      // Increment attempts counter
      const newAttempts = approval.attempts + 1
      const remainingAttempts = 5 - newAttempts

      await supabase
        .from('bank_account_approvals')
        .update({ 
          attempts: newAttempts,
          // If this was the last attempt, mark as expired
          status: newAttempts >= 5 ? 'expired' : approval.status
        })
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          error: 'Invalid OTP code',
          remaining_attempts: remainingAttempts > 0 ? remainingAttempts : 0,
          max_attempts_reached: remainingAttempts === 0
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // OTP is valid! Update approval status
    const verifiedAt = new Date().toISOString()
    
    const { data: updatedApproval, error: updateError } = await supabase
      .from('bank_account_approvals')
      .update({ 
        status: 'approved',
        verified_at: verifiedAt,
        attempts: approval.attempts + 1 // Increment to track successful attempt
      })
      .eq('id', approval.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating approval:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update approval status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank account approval verified successfully:', {
      teen_id: teenUser.id,
      verified_at: verifiedAt,
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        approved: true,
        message: 'Bank account approval verified successfully',
        verified_at: verifiedAt
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error in verify-bank-account-approval-otp:', error)
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

