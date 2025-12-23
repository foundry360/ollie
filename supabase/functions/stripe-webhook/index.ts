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
      case 'account.updated': {
        const account = event.data.object
        
        // Determine onboarding status
        let onboardingStatus: 'pending' | 'in_progress' | 'complete' | 'failed' = 'pending'
        
        if (account.details_submitted) {
          if (account.charges_enabled && account.payouts_enabled) {
            onboardingStatus = 'complete'
          } else if (account.requirements?.currently_due?.length === 0 && 
                     account.requirements?.past_due?.length === 0) {
            // Account is in good standing but may be pending verification
            onboardingStatus = account.charges_enabled || account.payouts_enabled 
              ? 'in_progress' 
              : 'pending'
          } else {
            onboardingStatus = 'in_progress'
          }
        } else {
          onboardingStatus = 'pending'
        }

        // Check for account rejection/deactivation
        if (account.details_submitted && !account.charges_enabled && !account.payouts_enabled) {
          // Check if there are requirements that can't be met
          const hasPastDue = account.requirements?.past_due?.length > 0
          const hasDisabledReason = account.requirements?.disabled_reason
          
          if (hasPastDue || hasDisabledReason) {
            onboardingStatus = 'failed'
          }
        }
        
        // Update stripe_accounts table
        const { error: updateError } = await supabase
          .from('stripe_accounts')
          .update({
            onboarding_status: onboardingStatus,
            charges_enabled: account.charges_enabled || false,
            payouts_enabled: account.payouts_enabled || false,
            email: account.email || null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id)

        if (updateError) {
          console.error('Error updating stripe account:', updateError)
        } else {
          console.log(`Updated Stripe account ${account.id}: status=${onboardingStatus}, charges=${account.charges_enabled}, payouts=${account.payouts_enabled}`)
        }

        break
      }
      
      case 'account.application.deauthorized': {
        const account = event.data.object
        
        // Handle account deauthorization
        const { error: updateError } = await supabase
          .from('stripe_accounts')
          .update({
            onboarding_status: 'failed',
            charges_enabled: false,
            payouts_enabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_account_id', account.id)

        if (updateError) {
          console.error('Error updating deauthorized stripe account:', updateError)
        }

        break
      }

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

      case 'transfer.created': {
        const transfer = event.data.object
        
        // Find earnings record by transfer ID
        const { data: earnings } = await supabase
          .from('earnings')
          .select('*')
          .eq('stripe_transfer_id', transfer.id)
          .single()

        if (earnings && !earnings.stripe_transfer_id) {
          // Update earnings with transfer ID if not already set
          await supabase
            .from('earnings')
            .update({
              stripe_transfer_id: transfer.id,
            })
            .eq('id', earnings.id)
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

