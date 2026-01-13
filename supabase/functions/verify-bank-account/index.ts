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

    // Get request body - support both verification methods
    const { descriptorCode, amount1, amount2 } = await req.json()

    // Determine which verification method to use
    const useDescriptorCode = !!descriptorCode
    const useAmounts = !!(amount1 && amount2)

    // Validate that at least one method is provided
    if (!useDescriptorCode && !useAmounts) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields. Please provide either descriptorCode or both amount1 and amount2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate descriptor code format if provided (4 digits)
    if (useDescriptorCode && !/^\d{4}$/.test(descriptorCode)) {
      return new Response(
        JSON.stringify({ error: 'Invalid code format. Please enter the 4-digit code (e.g., 1234)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate amounts if provided
    if (useAmounts) {
      const amount1Num = parseFloat(amount1)
      const amount2Num = parseFloat(amount2)
      
      if (isNaN(amount1Num) || isNaN(amount2Num)) {
        return new Response(
          JSON.stringify({ error: 'Invalid amount format. Please enter valid numbers (e.g., 0.32)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (amount1Num <= 0 || amount2Num <= 0) {
        return new Response(
          JSON.stringify({ error: 'Amounts must be greater than 0' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (amount1Num === amount2Num) {
        return new Response(
          JSON.stringify({ error: 'Amounts must be different' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
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

    // The stripe_external_account_id stores the Payment Method ID (pm_xxxxx)
    const paymentMethodId = bankAccount.stripe_external_account_id

    if (!paymentMethodId) {
      return new Response(
        JSON.stringify({ error: 'Payment method ID not found. Please add a bank account again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the bank account using Payment Methods API
    // Support both descriptor code and two-amount verification methods
    const verifyParams = new URLSearchParams()
    
    if (useDescriptorCode) {
      verifyParams.append('descriptor_code', descriptorCode)
      console.log('Verifying micro-deposits with descriptor code for payment method:', paymentMethodId)
    } else {
      // Convert amounts to cents
      const amount1Cents = Math.round(parseFloat(amount1) * 100)
      const amount2Cents = Math.round(parseFloat(amount2) * 100)
      verifyParams.append('amounts[0]', amount1Cents.toString())
      verifyParams.append('amounts[1]', amount2Cents.toString())
      console.log('Verifying micro-deposits with two amounts for payment method:', paymentMethodId, {
        amount1: amount1Cents,
        amount2: amount2Cents
      })
    }

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

      const errorMessage = useDescriptorCode
        ? 'Verification failed. The code you entered is incorrect. Please try again.'
        : 'Verification failed. The amounts you entered are incorrect. Please check your bank statement and try again.'
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: verifyResult.error?.message || 'Invalid verification data'
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
        const errorMessage = useDescriptorCode
          ? 'Verification failed. The code you entered is incorrect. Please add a new bank account.'
          : 'Verification failed. The amounts you entered are incorrect. Please add a new bank account.'
        
        return new Response(
          JSON.stringify({ 
            error: errorMessage,
            verification_status: 'failed'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const pendingMessage = useDescriptorCode
        ? 'Verification is still pending. Please check the code and try again.'
        : 'Verification is still pending. Please check the amounts and try again.'

      return new Response(
        JSON.stringify({ 
          error: pendingMessage,
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






