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

    // Get request body
    const { amount1, amount2 } = await req.json()

    // Validate required fields
    if (!amount1 || !amount2) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount1 and amount2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and parse amounts
    const parsedAmount1 = parseFloat(amount1)
    const parsedAmount2 = parseFloat(amount2)

    if (isNaN(parsedAmount1) || isNaN(parsedAmount2)) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount format. Please enter valid numbers (e.g., 0.32)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate amounts are between $0.01 and $0.99
    if (parsedAmount1 <= 0 || parsedAmount1 >= 1 || parsedAmount2 <= 0 || parsedAmount2 >= 1) {
      return new Response(
        JSON.stringify({ error: 'Amounts must be between $0.01 and $0.99' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate amounts are different
    if (parsedAmount1 === parsedAmount2) {
      return new Response(
        JSON.stringify({ error: 'Amounts must be different' }),
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

    // Verify micro-deposits with Stripe using Payment Methods API
    // Convert amounts to cents (Stripe uses cents)
    const amount1Cents = Math.round(parsedAmount1 * 100)
    const amount2Cents = Math.round(parsedAmount2 * 100)

    // The stripe_external_account_id stores the Payment Method ID (pm_xxxxx)
    const paymentMethodId = bankAccount.stripe_external_account_id

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ error: 'Payment method ID not found. Please add a bank account again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the bank account using Payment Methods API
    // For us_bank_account payment methods, use verify_microdeposits endpoint
    const verifyParams = new URLSearchParams()
    verifyParams.append('amounts[0]', amount1Cents.toString())
    verifyParams.append('amounts[1]', amount2Cents.toString())

    console.log('Verifying micro-deposits for payment method:', paymentMethodId)

    const verifyResponse = await fetch(
      `https://api.stripe.com/v1/payment_methods/${paymentMethodId}/verify_microdeposits`,
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

      return new Response(
        JSON.stringify({ 
          error: 'Verification failed. The amounts you entered do not match. Please try again.',
          details: verifyResult.error?.message || 'Invalid verification amounts'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // After verification, check the payment method status to confirm verification
    // The verify_microdeposits endpoint returns the payment method object
    // Check the us_bank_account.status field
    const usBankAccountStatus = verifyResult.us_bank_account?.status

    console.log('Payment method verification response:', {
      payment_method_id: verifyResult.id,
      us_bank_account_status: usBankAccountStatus,
      verified: verifyResult.us_bank_account?.verified
    })

    // Check if verification was successful
    // Status can be 'new', 'verified', 'verification_failed', or 'errored'
    const isVerified = usBankAccountStatus === 'verified' || verifyResult.us_bank_account?.verified === true

    if (!isVerified) {
      // Still pending or failed verification
      const newStatus = usBankAccountStatus === 'verification_failed' || usBankAccountStatus === 'errored' 
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
        return new Response(
          JSON.stringify({ 
            error: 'Verification failed. The amounts you entered do not match. Please add a new bank account.',
            verification_status: 'failed'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ 
          error: 'Verification is still pending. Please check the amounts and try again.',
          verification_status: 'pending'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verification successful!
    // Now attach the payment method to the customer so it can be used for payouts
    console.log('Attaching verified payment method to customer:', {
      payment_method_id: paymentMethodId,
      customer_id: bankAccount.stripe_customer_id
    })

    const attachParams = new URLSearchParams()
    attachParams.append('customer', bankAccount.stripe_customer_id)

    const attachResponse = await fetch(
      `https://api.stripe.com/v1/payment_methods/${paymentMethodId}/attach`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: attachParams,
      }
    )

    if (!attachResponse.ok) {
      const attachError = await attachResponse.json()
      console.error('Failed to attach payment method to customer:', attachError)
      // Don't fail the verification, but log the error
      // The payment method is verified, attachment can be retried if needed
    } else {
      console.log('Payment method attached to customer successfully')
    }

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






