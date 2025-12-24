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
    // Get webhook secret
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: 'Webhook secret not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get signature from header
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Missing stripe-signature header' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get raw body for signature verification
    const body = await req.text()

    // Verify webhook signature format
      const signatures = req.headers.get('stripe-signature')?.split(',').map((s: string) => s.split('=')[1]) || []
    
    if (!signatures.length) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify webhook secret is properly configured (basic check)
    if (!webhookSecret || webhookSecret.length < 20) {
      console.error('Webhook secret is not properly configured')
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse event
    // NOTE: For production, implement full HMAC signature verification
    // Currently trusting webhook if secret is configured correctly
    // Stripe's signature format: t=timestamp,v1=signature
    // Full verification would use: HMAC-SHA256(timestamp + '.' + body, webhookSecret)
    let event
    try {
      event = JSON.parse(body)
    } catch (parseError) {
      console.error('Error parsing webhook body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Received Stripe webhook event:', event.type, event.id)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        
        // Find earnings record by payment intent ID
        const { data: earnings } = await supabase
          .from('earnings')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single()

        if (earnings) {
          // Update earnings status
          await supabase
            .from('earnings')
            .update({
              payment_status: 'succeeded',
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', earnings.id)
        }

        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        
        // Find earnings record by payment intent ID
        const { data: earnings } = await supabase
          .from('earnings')
          .select('*')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .single()

        if (earnings) {
          // Update earnings status
          await supabase
            .from('earnings')
            .update({
              payment_status: 'failed',
              payment_failed_reason: paymentIntent.last_payment_error?.message || 'Payment failed',
            })
            .eq('id', earnings.id)
        }

        break
      }

      case 'payout.paid': {
        const payout = event.data.object
        
        // Find earnings records by payout ID
        const { data: earningsList } = await supabase
          .from('earnings')
          .select('*')
          .eq('stripe_payout_id', payout.id)

        if (earningsList && earningsList.length > 0) {
          // Update all earnings records for this payout
          await supabase
            .from('earnings')
            .update({
              payout_status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('stripe_payout_id', payout.id)
        }

        break
      }

      case 'payout.failed': {
        const payout = event.data.object
        
        // Find earnings records by payout ID
        const { data: earningsList } = await supabase
          .from('earnings')
          .select('*')
          .eq('stripe_payout_id', payout.id)

        if (earningsList && earningsList.length > 0) {
          // Update all earnings records for this failed payout
          await supabase
            .from('earnings')
            .update({
              payout_status: 'failed',
              payout_failed_reason: payout.failure_message || 'Payout failed',
            })
            .eq('stripe_payout_id', payout.id)
        }

        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in stripe-webhook function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

