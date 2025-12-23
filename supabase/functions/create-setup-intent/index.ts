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
    // SIMPLIFIED: Creating a setup intent is safe without auth - it just returns a client secret
    // The actual payment method is only created when the setup intent is confirmed (which happens client-side)
    // We still try to get user info if auth is provided for customer creation, but don't require it
    
    let userEmail = null;
    let userId = null;
    
    // Try to get user info from auth header if provided (optional)
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      if (user && !userError) {
        userId = user.id
        const { data: profile } = await supabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single()
        userEmail = profile?.email || user.email
      }
    }

    // Initialize Supabase client for database queries
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe customer (only if we have user info)
    let customerId = null
    if (userId) {
      // First check our database for existing customer
      const { data: existingPm } = await supabase
        .from('payment_methods')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (existingPm?.stripe_customer_id) {
        customerId = existingPm.stripe_customer_id
      } else if (userEmail) {
        // Check Stripe for existing customer with this email (to avoid duplicates)
        const searchParams = new URLSearchParams()
        searchParams.append('email', userEmail)
        searchParams.append('limit', '1')
        
        const searchResponse = await fetch(`https://api.stripe.com/v1/customers/search?${searchParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        })

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json()
          if (searchResult.data && searchResult.data.length > 0) {
            customerId = searchResult.data[0].id
            console.log('Found existing Stripe customer:', customerId)
          }
        }

        // If no existing customer found, create one
        if (!customerId) {
          const customerParams = new URLSearchParams()
          customerParams.append('email', userEmail)
          customerParams.append('metadata[user_id]', userId)

          const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': userId, // Use user ID as idempotency key to prevent duplicates
            },
            body: customerParams,
          })

          const customer = await customerResponse.json()
          if (customerResponse.ok) {
            customerId = customer.id
          } else {
            return new Response(
              JSON.stringify({ error: 'Failed to create customer', details: customer }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }

    // Create Setup Intent
    const setupIntentParams = new URLSearchParams()
    if (customerId) {
      setupIntentParams.append('customer', customerId)
    }
    setupIntentParams.append('payment_method_types[]', 'card')
    setupIntentParams.append('usage', 'off_session') // For future payments
    if (userId) {
      setupIntentParams.append('metadata[user_id]', userId)
    }

    const setupIntentResponse = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: setupIntentParams,
    })

    const setupIntent = await setupIntentResponse.json()

    if (!setupIntentResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to create setup intent', details: setupIntent }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        client_secret: setupIntent.client_secret,
        customer_id: customerId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in create-setup-intent function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

