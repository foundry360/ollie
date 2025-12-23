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
    // Get request body
    const { gig_id, earnings_id } = await req.json()

    if (!gig_id || !earnings_id) {
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

    // Get teen's Stripe account
    const { data: stripeAccount, error: accountError } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', gig.teen_id)
      .single()

    if (accountError || !stripeAccount) {
      return new Response(
        JSON.stringify({ error: 'Teenlancer Stripe account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (stripeAccount.onboarding_status !== 'complete' || !stripeAccount.charges_enabled) {
      return new Response(
        JSON.stringify({ error: 'Teenlancer Stripe account not ready for payments' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get platform fee percentage
    const { data: feeSetting } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'platform_fee_percentage')
      .single()

    const platformFeePercentage = feeSetting ? parseFloat(feeSetting.value) : 0.10 // Default 10%
    const platformFeeAmount = Math.round(gig.pay * platformFeePercentage * 100) / 100
    const transferAmount = gig.pay - platformFeeAmount

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update earnings status to processing
    await supabase
      .from('earnings')
      .update({ payment_status: 'processing' })
      .eq('id', earnings_id)

    // Create Payment Intent with application fee
    const paymentIntentParams = new URLSearchParams()
    paymentIntentParams.append('amount', Math.round(gig.pay * 100).toString()) // Convert to cents
    paymentIntentParams.append('currency', 'usd')
    paymentIntentParams.append('payment_method', paymentMethod.stripe_payment_method_id)
    paymentIntentParams.append('confirmation_method', 'automatic')
    paymentIntentParams.append('confirm', 'true')
    paymentIntentParams.append('application_fee_amount', Math.round(platformFeeAmount * 100).toString())
    paymentIntentParams.append('transfer_data[destination]', stripeAccount.stripe_account_id)
    paymentIntentParams.append('metadata[gig_id]', gig.id)
    paymentIntentParams.append('metadata[earnings_id]', earnings_id)
    paymentIntentParams.append('metadata[teen_id]', gig.teen_id)
    paymentIntentParams.append('metadata[poster_id]', gig.poster_id)

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
      console.error('Payment Intent creation error:', paymentIntent)
      
      // Update earnings with failure
      await supabase
        .from('earnings')
        .update({
          payment_status: 'failed',
          payment_failed_reason: paymentIntent.error?.message || 'Payment intent creation failed',
        })
        .eq('id', earnings_id)

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create payment intent', 
          details: paymentIntent 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get transfer ID from payment intent
    let transferId = null
    if (paymentIntent.charges?.data?.[0]?.transfer) {
      transferId = paymentIntent.charges.data[0].transfer
    }

    // Update earnings with payment info
    const { data: updatedEarnings, error: updateError } = await supabase
      .from('earnings')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        stripe_transfer_id: transferId,
        platform_fee_amount: platformFeeAmount,
        payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing',
        paid_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
        status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
      })
      .eq('id', earnings_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating earnings:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent: paymentIntent,
        earnings: updatedEarnings,
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

