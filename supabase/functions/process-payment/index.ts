import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  let earnings_id: string | null = null; // Store for error handling

  try {

    // Check if body is expected
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body with error handling
    let body
    try {
      // Check content-length first
      if (contentLength === '0' || (contentLength === null && req.body === null)) {
        console.error('No request body - content-length:', contentLength, 'body:', req.body)
        return new Response(
          JSON.stringify({ error: 'Request body is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Try to read body as text first (more forgiving than json())
      let bodyText: string
      try {
        bodyText = await req.text()
      } catch (readError: any) {
        console.error('Error reading request body:', readError?.message || String(readError))
        // If body is already consumed or empty, this will fail
        if (readError?.message?.includes('end of JSON') || readError?.message?.includes('Unexpected')) {
          return new Response(
            JSON.stringify({ 
              error: 'Request body is empty or invalid',
              details: 'The request body could not be read. Please ensure the body is sent correctly.'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        throw readError
      }
      
      console.log('Raw request body received, length:', bodyText?.length || 0)
      
      if (!bodyText || bodyText.trim() === '') {
        console.error('Empty request body after reading')
        return new Response(
          JSON.stringify({ error: 'Request body is empty' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      body = JSON.parse(bodyText)
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError?.message || String(parseError))
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : String(parseError)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { gig_id, earnings_id: bodyEarningsId } = body
    earnings_id = bodyEarningsId; // Store for error handling

    console.log('process-payment function called with:', { gig_id, earnings_id, body })

    if (!gig_id || !earnings_id) {
      console.error('Missing required fields:', { gig_id, earnings_id })
      return new Response(
        JSON.stringify({ error: 'Missing required fields: gig_id and earnings_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get earnings record
    const { data: earnings, error: earningsError } = await supabase
      .from('earnings')
      .select(`
        *,
        gigs!inner(
          id,
          pay,
          poster_id,
          teen_id
        )
      `)
      .eq('id', earnings_id)
      .single()

    if (earningsError || !earnings) {
      return new Response(
        JSON.stringify({ error: 'Earnings record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if payment already processed
    if (earnings.payment_status === 'succeeded') {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Payment already processed', 
          earnings 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const gig = earnings.gigs
    if (!gig) {
      return new Response(
        JSON.stringify({ error: 'Gig not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get neighbor's default payment method
    // Order by created_at DESC to get the most recently set default if multiple exist
    console.log('Looking for payment method for poster_id:', gig.poster_id);
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', gig.poster_id)
      .eq('is_default', true)
      .order('created_at', { ascending: false })
      .limit(1)

    console.log('Payment method query result:', { 
      found: !!paymentMethods, 
      count: paymentMethods?.length || 0, 
      error: pmError,
      poster_id: gig.poster_id 
    });

    if (pmError) {
      const errorMessage = `Error querying payment methods: ${pmError.message}`;
      console.error('Payment method query error:', pmError);
      
      // Update earnings with failure reason so it's visible in the database
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: errorMessage,
        })
        .eq('id', earnings_id);
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: pmError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!paymentMethods || paymentMethods.length === 0) {
      // Check if there are ANY payment methods for this user (not just default)
      const { data: allPaymentMethods } = await supabase
        .from('payment_methods')
        .select('id, is_default')
        .eq('user_id', gig.poster_id);
      
      console.log('All payment methods for poster:', allPaymentMethods);
      
      const errorMessage = `Neighbor payment method not found. Poster has ${allPaymentMethods?.length || 0} payment method(s), but none are set as default. Please ensure the poster has added a default payment method.`;
      console.error('Payment method not found:', { 
        poster_id: gig.poster_id, 
        total_payment_methods: allPaymentMethods?.length || 0,
        all_payment_methods: allPaymentMethods
      });
      
      // Update earnings with failure reason so it's visible in the database
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: errorMessage,
        })
        .eq('id', earnings_id);
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          poster_id: gig.poster_id,
          total_payment_methods: allPaymentMethods?.length || 0
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentMethod = paymentMethods[0]

    // Ensure payment method has a customer ID
    if (!paymentMethod.stripe_customer_id) {
      const errorMessage = 'Payment method is not attached to a Stripe customer. Please re-add your payment method.';
      console.error('Payment method missing customer ID:', paymentMethod);
      
      // Update earnings with failure reason
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: errorMessage,
        })
        .eq('id', earnings_id);
      
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify payment method is attached to customer in Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if payment method is attached to customer
    const pmCheckResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethod.stripe_payment_method_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })

    const pmData = await pmCheckResponse.json()
    
    if (!pmCheckResponse.ok) {
      const errorMessage = `Payment method not found in Stripe: ${pmData?.error?.message || 'Unknown error'}`;
      console.error('Error checking payment method:', pmData);
      
      // Update earnings with failure reason
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: errorMessage,
        })
        .eq('id', earnings_id);
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: pmData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If payment method is not attached to the customer, attach it
    if (!pmData.customer || pmData.customer !== paymentMethod.stripe_customer_id) {
      console.log('Attaching payment method to customer:', {
        payment_method: paymentMethod.stripe_payment_method_id,
        customer: paymentMethod.stripe_customer_id
      })

      const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethod.stripe_payment_method_id}/attach`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: paymentMethod.stripe_customer_id,
        }),
      })

      const attachResult = await attachResponse.json()
      
      if (!attachResponse.ok) {
        console.error('Failed to attach payment method:', attachResult)
        return new Response(
          JSON.stringify({ error: 'Failed to attach payment method to customer', details: attachResult }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Get platform fee percentage
    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single()

    const platformFeePercentage = feeSetting ? parseFloat(feeSetting.value) : 0.12 // Default 12%
    
    // Calculate amount to charge neighbor including Stripe fees
    // We want to receive gig.pay after Stripe fees, so:
    // total - (total × 0.029 + $0.30) = gig.pay
    // total × (1 - 0.029) = gig.pay + $0.30
    // total = (gig.pay + $0.30) / 0.971
    const STRIPE_FEE_PERCENTAGE = 0.029 // 2.9%
    const STRIPE_FIXED_FEE = 0.30 // $0.30
    const totalToCharge = (gig.pay + STRIPE_FIXED_FEE) / (1 - STRIPE_FEE_PERCENTAGE)
    const estimatedStripeFee = (totalToCharge * STRIPE_FEE_PERCENTAGE) + STRIPE_FIXED_FEE
    
    // Calculate platform fee on the net amount (gig.pay), not the total charged
    const platformFeeAmount = Math.round(gig.pay * platformFeePercentage * 100) / 100
    const transferAmount = gig.pay - platformFeeAmount
    
    console.log('Fee calculation:', {
      gig_pay: gig.pay,
      total_to_charge: totalToCharge,
      estimated_stripe_fee: estimatedStripeFee,
      net_after_stripe_fee: totalToCharge - estimatedStripeFee,
      platform_fee_percentage: platformFeePercentage,
      platform_fee: platformFeeAmount,
      transfer_to_teen: transferAmount,
    })

    // Stripe minimum charge amount is $0.50 USD (50 cents)
    const STRIPE_MINIMUM_AMOUNT = 0.50
    // Check minimum on the total amount to charge (including fees)
    const amountInCents = Math.round(totalToCharge * 100)
    
    if (totalToCharge < STRIPE_MINIMUM_AMOUNT) {
      console.error('Payment amount too small:', {
        gig_pay: gig.pay,
        total_to_charge: totalToCharge,
        minimum: STRIPE_MINIMUM_AMOUNT,
        amountInCents,
      })
      
      // Update earnings with failure
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: `Payment amount ($${totalToCharge.toFixed(2)} including fees) is below Stripe's minimum of $${STRIPE_MINIMUM_AMOUNT.toFixed(2)}`,
        })
        .eq('id', earnings_id)

      return new Response(
        JSON.stringify({ 
          error: 'Payment amount too small',
          message: `Payment amount ($${totalToCharge.toFixed(2)} including fees) is below Stripe's minimum charge of $${STRIPE_MINIMUM_AMOUNT.toFixed(2)}. Please ensure gig pay is at least $${STRIPE_MINIMUM_AMOUNT.toFixed(2)}.`,
          amount: totalToCharge,
          minimum_amount: STRIPE_MINIMUM_AMOUNT,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already processing to prevent duplicate charges
    if (earnings.payment_status === 'processing' || earnings.payment_status === 'succeeded') {
      console.log('Payment already processing or completed, skipping duplicate charge')
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Payment already processing or completed', 
          earnings 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update earnings status to processing (atomic update to prevent race conditions)
    const { data: processingEarnings, error: processingUpdateError } = await supabase
      .from('earnings')
      .update({ payment_status: 'processing' })
      .eq('id', earnings_id)
      .eq('payment_status', 'pending') // Only update if still pending
      .select()
      .single()

    // If update failed, it means payment_status was already changed (race condition)
    if (processingUpdateError || !processingEarnings || processingEarnings.payment_status !== 'processing') {
      console.log('Payment status already changed, another process is handling it')
      // Re-fetch to get current status
      const { data: currentEarnings } = await supabase
        .from('earnings')
        .select('*')
        .eq('id', earnings_id)
        .single()
      
      if (currentEarnings?.payment_status === 'succeeded') {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Payment already processed', 
            earnings: currentEarnings 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          message: 'Payment is being processed by another request', 
          earnings: currentEarnings 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Simplified Payment Intent creation for neighbors
    // Use off_session=true since neighbor isn't actively present (automatic payment on task completion)
    const paymentIntentParams = new URLSearchParams()
    paymentIntentParams.append('amount', amountInCents.toString()) // Convert to cents
    paymentIntentParams.append('currency', 'usd')
    paymentIntentParams.append('customer', paymentMethod.stripe_customer_id)
    paymentIntentParams.append('payment_method', paymentMethod.stripe_payment_method_id)
    paymentIntentParams.append('off_session', 'true') // Customer not present - automatic payment
    paymentIntentParams.append('confirm', 'true') // Confirm immediately
    // Add metadata for tracking
    paymentIntentParams.append('metadata[gig_id]', gig.id)
    paymentIntentParams.append('metadata[earnings_id]', earnings_id)
    paymentIntentParams.append('metadata[teen_id]', gig.teen_id)
    paymentIntentParams.append('metadata[poster_id]', gig.poster_id)

    console.log('Creating simplified Payment Intent:', {
      amount: amountInCents,
      amountInDollars: totalToCharge,
      gig_pay: gig.pay,
      stripe_fee: estimatedStripeFee,
      customer: paymentMethod.stripe_customer_id,
      payment_method: paymentMethod.stripe_payment_method_id,
      off_session: true,
    })

    const paymentIntentResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paymentIntentParams,
    })

    const paymentIntent = await paymentIntentResponse.json()
    

    if (!paymentIntentResponse.ok) {
      console.error('Payment Intent creation error:', {
        status: paymentIntentResponse.status,
        statusText: paymentIntentResponse.statusText,
        error: paymentIntent,
        requestParams: {
          amount: amountInCents,
          amountInDollars: gig.pay,
          customer: paymentMethod.stripe_customer_id,
          payment_method: paymentMethod.stripe_payment_method_id,
          off_session: true,
        },
        requestBody: paymentIntentParams.toString()
      })
      
      // Update earnings with failure
      const errorMessage = paymentIntent.error?.message || paymentIntent.error?.type || 'Payment intent creation failed'
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: errorMessage,
        })
        .eq('id', earnings_id)

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment intent',
          stripe_error: errorMessage,
          stripe_error_code: paymentIntent.error?.code,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }


    // Handle payment status
    // If requires_action, the payment needs 3D Secure - we'll handle via webhook
    // For off_session payments, if it requires action, we mark as pending and webhook will complete it
    let paymentStatus: string
    if (paymentIntent.status === 'succeeded') {
      paymentStatus = 'succeeded'
    } else if (paymentIntent.status === 'requires_action') {
      // 3D Secure required - webhook will handle completion
      console.log('Payment requires 3D Secure authentication - will be handled by webhook')
      paymentStatus = 'requires_action'
    } else if (paymentIntent.status === 'requires_payment_method') {
      // Payment method failed - mark as failed
      console.error('Payment method failed:', paymentIntent.last_payment_error)
      paymentStatus = 'failed'
    } else {
      // Processing or other status
      paymentStatus = 'processing'
    }
    
    
    // Update earnings with payment info
    const updateData: any = {
      stripe_payment_intent_id: paymentIntent.id,
      stripe_fee_amount: estimatedStripeFee, // Store Stripe fee charged to neighbor
      platform_fee_amount: platformFeeAmount,
      payment_status: paymentStatus,
    }
    
    // Payment succeeded means neighbor's card was charged, but money hasn't been transferred to teenlancer's bank yet
    // Keep status as 'pending' until actual bank transfer/payout is completed
    // Only set status to 'paid' when money is actually deposited to teenlancer's bank account
    if (paymentStatus === 'failed') {
      updateData.payment_failed_reason = paymentIntent.last_payment_error?.message || 'Payment failed'
      updateData.status = 'pending' // Keep as pending so it can be retried
    }
    // Note: We do NOT set status = 'paid' here because the payout to teenlancer's bank hasn't happened yet
    // The payment_status = 'succeeded' indicates payment was received from neighbor, but earnings remain pending
    // until the bank transfer is completed (which would be handled by a separate payout/transfer function)
    
    const { data: updatedEarnings, error: updateError } = await supabase
      .from('earnings')
      .update(updateData)
      .eq('id', earnings_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating earnings:', updateError)
    } else {
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent: paymentIntent,
        payment_status: paymentIntent.status,
        earnings: updatedEarnings,
        requires_action: paymentIntent.status === 'requires_action',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in process-payment function:', error)
    
    // Try to update earnings record with error if we have the earnings_id
    if (earnings_id) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        
        if (supabaseUrl && supabaseServiceKey) {
          const supabase = createClient(supabaseUrl, supabaseServiceKey)
          await supabase
            .from('earnings')
            .update({
              payment_status: 'failed',
              payment_failed_reason: `Unexpected error: ${error?.message || String(error)}`,
            })
            .eq('id', earnings_id)
          console.log('Updated earnings record with error:', earnings_id)
        }
      } catch (updateError) {
        console.error('Failed to update earnings with error:', updateError)
      }
    }
    
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

