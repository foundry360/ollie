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
    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body - descriptor code is required
    const { descriptorCode } = await req.json()

    // Validate that descriptor code is provided
    if (!descriptorCode) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: descriptorCode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate descriptor code format (6-character alphanumeric)
    const codeUpper = descriptorCode.toUpperCase().trim()
    if (!/^[A-Z0-9]{6}$/.test(codeUpper)) {
      return new Response(
        JSON.stringify({ error: 'Invalid code format. Please enter the 6-character code from your bank statement (e.g., SMPXDQ)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify user is a teen
    if (userProfile.role !== 'teen') {
      return new Response(
        JSON.stringify({ error: 'Only teens can verify bank accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's bank account
    const { data: bankAccount, error: accountError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (accountError || !bankAccount) {
      return new Response(
        JSON.stringify({ error: 'Bank account not found. Please add a bank account first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already verified
    if (bankAccount.verification_status === 'verified') {
      return new Response(
        JSON.stringify({ 
          success: true,
          verified: true,
          message: 'Bank account is already verified',
          verified_at: bankAccount.verified_at
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if verification failed
    if (bankAccount.verification_status === 'failed') {
      return new Response(
        JSON.stringify({ 
          error: 'Bank account verification has failed. Please add a new bank account.',
          verification_status: 'failed'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the SetupIntent ID (required for verification)
    let setupIntentId = bankAccount.stripe_setup_intent_id

    // If SetupIntent ID is missing, create a new one for the existing payment method
    if (!setupIntentId) {
      console.log('SetupIntent ID missing, creating new SetupIntent for existing payment method:', bankAccount.stripe_external_account_id)
      
      if (!bankAccount.stripe_external_account_id || !bankAccount.stripe_customer_id) {
        return new Response(
          JSON.stringify({ error: 'Bank account is missing required Stripe information. Please add a bank account again.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create a new SetupIntent for the existing payment method
      const setupIntentParams = new URLSearchParams()
      setupIntentParams.append('customer', bankAccount.stripe_customer_id)
      setupIntentParams.append('payment_method', bankAccount.stripe_external_account_id)
      setupIntentParams.append('payment_method_types[]', 'us_bank_account')
      setupIntentParams.append('usage', 'off_session')

      const createSetupIntentResponse = await fetch('https://api.stripe.com/v1/setup_intents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: setupIntentParams,
      })

      const newSetupIntent = await createSetupIntentResponse.json()

      if (!createSetupIntentResponse.ok) {
        console.error('Failed to create SetupIntent for existing payment method:', newSetupIntent)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to set up verification. Please add a bank account again.',
            details: newSetupIntent.error?.message || 'Unknown error'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      setupIntentId = newSetupIntent.id
      console.log('Created new SetupIntent for existing payment method:', setupIntentId)

      // Update the bank account with the new SetupIntent ID
      await supabase
        .from('bank_accounts')
        .update({ 
          stripe_setup_intent_id: setupIntentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', bankAccount.id)

      // Confirm the SetupIntent to trigger micro-deposits if needed
      if (newSetupIntent.status === 'requires_confirmation') {
        const confirmParams = new URLSearchParams()
        confirmParams.append('payment_method', bankAccount.stripe_external_account_id)
        confirmParams.append('mandate_data[customer_acceptance][type]', 'online')
        confirmParams.append('mandate_data[customer_acceptance][online][ip_address]', '0.0.0.0')
        confirmParams.append('mandate_data[customer_acceptance][online][user_agent]', 'Ollie-App/1.0')

        await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntentId}/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: confirmParams,
        })
      }
    }

    // Verify the bank account using SetupIntent API with descriptor code
    const verifyParams = new URLSearchParams()
    verifyParams.append('descriptor_code', codeUpper)
    console.log('Verifying micro-deposits with descriptor code for SetupIntent:', setupIntentId)

    const verifyResponse = await fetch(
      `https://api.stripe.com/v1/setup_intents/${setupIntentId}/verify_microdeposits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: verifyParams,
      }
    )

    const verifyResult = await verifyResponse.json()

    if (!verifyResponse.ok) {
      console.error('Stripe verification failed:', verifyResult)
      
      // Update database to reflect failed verification
      await supabase
        .from('bank_accounts')
        .update({ 
          verification_status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', bankAccount.id)

      const errorMessage = 'Verification failed. The code you entered is incorrect. Please try again.'
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: verifyResult.error?.message || 'Invalid verification data'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // After verification, check the SetupIntent status to confirm verification
    // The verify_microdeposits endpoint returns the SetupIntent object
    // Check the SetupIntent status and the payment_method's us_bank_account status
    const setupIntentStatus = verifyResult.status
    const paymentMethod = verifyResult.payment_method
    // Payment method can be a string ID or an expanded object
    const paymentMethodId = typeof paymentMethod === 'string' ? paymentMethod : paymentMethod?.id || bankAccount.stripe_external_account_id
    
    // If payment_method is expanded, check its us_bank_account status
    // Otherwise, we'll check the SetupIntent status
    let usBankAccountStatus: string | undefined
    if (typeof paymentMethod === 'object' && paymentMethod?.us_bank_account) {
      usBankAccountStatus = paymentMethod.us_bank_account.status
    }

    console.log('SetupIntent verification response:', {
      setup_intent_id: verifyResult.id,
      setup_intent_status: setupIntentStatus,
      payment_method_id: paymentMethodId,
      us_bank_account_status: usBankAccountStatus,
    })

    // Check if verification was successful
    // SetupIntent status should be 'succeeded' when verification is complete
    // Also check payment method's us_bank_account status if available
    const isVerified = setupIntentStatus === 'succeeded' || 
      (usBankAccountStatus === 'verified')

    if (!isVerified) {
      // Still pending or failed verification
      const newStatus = setupIntentStatus === 'canceled' || usBankAccountStatus === 'verification_failed' || usBankAccountStatus === 'errored'
        ? 'failed' 
        : 'pending'
      
      await supabase
        .from('bank_accounts')
        .update({ 
          verification_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', bankAccount.id)

      if (newStatus === 'failed') {
        const errorMessage = 'Verification failed. The code you entered is incorrect. Please add a new bank account.'
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            verification_status: 'failed'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const pendingMessage = 'Verification is still pending. Please check the code and try again.'

      return new Response(
        JSON.stringify({ 
          error: pendingMessage,
          verification_status: 'pending'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verification successful!
    // The payment method should already be attached to the customer via the SetupIntent
    // But let's verify it's attached
    console.log('Verification successful. Payment method should already be attached via SetupIntent:', {
      payment_method_id: paymentMethodId,
      customer_id: bankAccount.stripe_customer_id
    })

    const verifiedAt = new Date().toISOString()

    const { data: updatedAccount, error: updateError } = await supabase
      .from('bank_accounts')
      .update({ 
        verification_status: 'verified',
        verified_at: verifiedAt,
        updated_at: verifiedAt
      })
      .eq('id', bankAccount.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bank account verification status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update verification status', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank account verified successfully:', {
      user_id: user.id,
      bank_account_id: bankAccount.id,
      verified_at: verifiedAt,
    })

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        message: 'Bank account verified successfully',
        verified_at: verifiedAt,
        bank_account: {
          id: updatedAccount.id,
          verification_status: 'verified',
          bank_name: updatedAccount.bank_name,
          account_type: updatedAccount.account_type,
          account_number_last4: updatedAccount.account_number_last4,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in verify-bank-account function:', error)
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






