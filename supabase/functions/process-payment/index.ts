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

  try {
    // #region agent log - Check request details
    const contentType = req.headers.get('content-type') || 'none'
    const contentLength = req.headers.get('content-length')
    console.log('Request details:', {
      method: req.method,
      contentType,
      contentLength,
      url: req.url,
      hasBody: req.body !== null,
    })
    // #endregion

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
    
    const { gig_id, earnings_id } = body

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
        JSON.stringify({ message: 'Payment already processed', earnings }),
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
    const { data: paymentMethod, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', gig.poster_id)
      .eq('is_default', true)
      .single()

    if (pmError || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Neighbor payment method not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ensure payment method has a customer ID
    if (!paymentMethod.stripe_customer_id) {
      console.error('Payment method missing customer ID:', paymentMethod)
      return new Response(
        JSON.stringify({ error: 'Payment method is not attached to a Stripe customer. Please re-add your payment method.' }),
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
      console.error('Error checking payment method:', pmData)
      return new Response(
        JSON.stringify({ error: 'Payment method not found in Stripe', details: pmData }),
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

    const platformFeePercentage = feeSetting ? parseFloat(feeSetting.value) : 0.10 // Default 10%
    const platformFeeAmount = Math.round(gig.pay * platformFeePercentage * 100) / 100
    const transferAmount = gig.pay - platformFeeAmount

    // Update earnings status to processing
    await supabase
      .from('earnings')
      .update({ payment_status: 'processing' })
      .eq('id', earnings_id)

    // Get web app URL for return URL (for 3D Secure and other authentication flows)
    const webAppUrl = Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') || Deno.env.get('WEB_APP_URL') || 'https://olliejobs.com'
    const returnUrl = `${webAppUrl}/payment/return?gig_id=${gig.id}&earnings_id=${earnings_id}`
    
    console.log('Setting return_url:', returnUrl, 'from webAppUrl:', webAppUrl)

    // Create Payment Intent (platform receives all funds, will payout to teenlancer separately)
    const paymentIntentParams = new URLSearchParams()
    paymentIntentParams.append('amount', Math.round(gig.pay * 100).toString()) // Convert to cents
    paymentIntentParams.append('currency', 'usd')
    paymentIntentParams.append('customer', paymentMethod.stripe_customer_id) // Use customer ID
    paymentIntentParams.append('payment_method', paymentMethod.stripe_payment_method_id)
    paymentIntentParams.append('confirmation_method', 'automatic')
    paymentIntentParams.append('confirm', 'true')
    paymentIntentParams.append('return_url', returnUrl) // Required for 3D Secure and authentication flows
    // Disable redirect-based payment methods to avoid requiring return_url handling
    // If you want to support redirects, keep return_url and handle the redirect flow
    paymentIntentParams.append('automatic_payment_methods[enabled]', 'true')
    paymentIntentParams.append('automatic_payment_methods[allow_redirects]', 'never')
    // Note: Platform receives full amount, payout to teenlancer will be handled separately
    paymentIntentParams.append('metadata[gig_id]', gig.id)
    paymentIntentParams.append('metadata[earnings_id]', earnings_id)
    paymentIntentParams.append('metadata[teen_id]', gig.teen_id)
    paymentIntentParams.append('metadata[poster_id]', gig.poster_id)

    console.log('Creating Payment Intent with params:', {
      amount: Math.round(gig.pay * 100),
      customer: paymentMethod.stripe_customer_id,
      payment_method: paymentMethod.stripe_payment_method_id,
      return_url: returnUrl,
      has_return_url: !!returnUrl,
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
    
    // #region agent log - Payment Intent response
    console.log('Payment Intent API response:', {
      ok: paymentIntentResponse.ok,
      status: paymentIntentResponse.status,
      paymentIntentStatus: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
      requiresAction: paymentIntent.status === 'requires_action',
      requiresPaymentMethod: paymentIntent.status === 'requires_payment_method',
      succeeded: paymentIntent.status === 'succeeded',
      clientSecret: paymentIntent.client_secret,
      nextAction: paymentIntent.next_action,
    })
    // #endregion

    if (!paymentIntentResponse.ok) {
      console.error('Payment Intent creation error:', {
        status: paymentIntentResponse.status,
        statusText: paymentIntentResponse.statusText,
        error: paymentIntent,
        requestParams: {
          amount: Math.round(gig.pay * 100),
          customer: paymentMethod.stripe_customer_id,
          payment_method: paymentMethod.stripe_payment_method_id,
          return_url: returnUrl,
          automatic_payment_methods_enabled: 'true',
          automatic_payment_methods_allow_redirects: 'never',
        },
        requestBody: paymentIntentParams.toString()
      })
      
      // Update earnings with failure
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: paymentIntent.error?.message || paymentIntent.error?.type || 'Payment intent creation failed',
        })
        .eq('id', earnings_id)

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment intent',
          stripe_error: paymentIntent.error?.message || paymentIntent.error?.type,
          stripe_error_code: paymentIntent.error?.code,
          details: paymentIntent 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // #region agent log - Payment Intent status check
    console.log('Payment Intent created successfully:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer,
      payment_method: paymentIntent.payment_method,
      charges: paymentIntent.charges?.data?.length || 0,
      latest_charge: paymentIntent.latest_charge,
    })
    // #endregion

    // Check if payment requires action (e.g., 3D Secure)
    if (paymentIntent.status === 'requires_action') {
      console.warn('Payment Intent requires action:', {
        payment_intent_id: paymentIntent.id,
        next_action: paymentIntent.next_action,
        client_secret: paymentIntent.client_secret,
      })
      // For now, we'll mark it as processing and the webhook will handle completion
      // In a production app, you'd redirect the user to complete 3D Secure
    }

    // Update earnings with payment info
    // Note: Platform fee and payout will be handled separately via payout creation
    const paymentStatus = paymentIntent.status === 'succeeded' ? 'succeeded' : 
                         paymentIntent.status === 'requires_action' ? 'requires_action' : 'processing'
    
    // #region agent log - Earnings update
    console.log('Updating earnings with payment status:', {
      earnings_id,
      payment_status: paymentStatus,
      payment_intent_id: paymentIntent.id,
      payment_intent_status: paymentIntent.status,
    })
    // #endregion
    
    const { data: updatedEarnings, error: updateError } = await supabase
      .from('earnings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        platform_fee_amount: platformFeeAmount,
        payment_status: paymentStatus,
        paid_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
        status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
      })
      .eq('id', earnings_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating earnings:', updateError)
    } else {
      // #region agent log - Earnings updated
      console.log('Earnings updated successfully:', {
        earnings_id: updatedEarnings?.id,
        payment_status: updatedEarnings?.payment_status,
        stripe_payment_intent_id: updatedEarnings?.stripe_payment_intent_id,
      })
      // #endregion
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
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

