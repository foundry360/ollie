import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  console.log('=== create-setup-intent function called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('Processing create-setup-intent request')
    // SIMPLIFIED: Creating a setup intent is safe without auth - it just returns a client secret
    // The actual payment method is only created when the setup intent is confirmed (which happens client-side)
    // We still try to get user info if auth is provided for customer creation, but don't require it
    
    let userEmail = null;
    let userId = null;
    
    // Try to get user info from auth header if provided (optional)
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    if (authHeader) {
      console.log('Getting user from auth token')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      console.log('Supabase config:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseServiceKey })
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Missing Supabase configuration')
        throw new Error('Server configuration error')
      }
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      console.log('User lookup result:', { hasUser: !!user, hasError: !!userError, error: userError?.message })
      
      if (user && !userError) {
        userId = user.id
        console.log('User ID:', userId)
        const { data: profile } = await supabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single()
        userEmail = profile?.email || user.email
        console.log('User email:', userEmail)
      }
    }

    // Initialize Supabase client for database queries
    console.log('Initializing Supabase client for database')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration for database')
      throw new Error('Server configuration error')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized')

    // Initialize Stripe
    console.log('Checking Stripe configuration')
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('Stripe not configured')
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Stripe key found')

    // Get or create Stripe customer (only if we have user info)
    let customerId = null
    if (userId) {
      console.log('Looking up customer for user:', userId)
      // First check our database for existing customer
      const { data: existingPm } = await supabase
        .from('payment_methods')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (existingPm?.stripe_customer_id) {
        const dbCustomerId = existingPm.stripe_customer_id
        console.log('Found customer ID in database:', dbCustomerId)
        
        // Verify customer exists in Stripe
        try {
          const verifyResponse = await fetch(`https://api.stripe.com/v1/customers/${dbCustomerId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          })
          
          if (verifyResponse.ok) {
            customerId = dbCustomerId
            console.log('Verified customer exists in Stripe:', customerId)
          } else {
            const verifyResult = await verifyResponse.json().catch(() => ({}))
            console.warn('Customer from database not found in Stripe:', verifyResult)
            // Customer doesn't exist, will search or create new one
            customerId = null
          }
        } catch (verifyError) {
          console.error('Error verifying customer in Stripe:', verifyError)
          customerId = null
        }
      }
      
      // If no valid customer found, search Stripe by email
      if (!customerId && userEmail) {
        console.log('Searching Stripe for customer by email:', userEmail)
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
          if (searchResult.data && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
            // Prefer customer with matching user_id in metadata
            const foundCustomer = searchResult.data.find((c: any) => 
              c.metadata && c.metadata.user_id === userId
            ) || searchResult.data[0]
            
            if (foundCustomer && foundCustomer.id) {
              customerId = foundCustomer.id
              console.log('Found existing Stripe customer by email:', customerId)
            }
          }
        } else {
          const searchError = await searchResponse.json().catch(() => ({}))
          console.warn('Error searching Stripe for customer:', searchError)
        }

        // If no existing customer found, create one
        if (!customerId) {
          console.log('Creating new Stripe customer')
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
          if (customerResponse.ok && customer.id) {
            customerId = customer.id
            console.log('Created new Stripe customer:', customerId)
          } else {
            console.error('Failed to create Stripe customer:', customer)
            return new Response(
              JSON.stringify({ error: 'Failed to create customer', details: customer }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }
      }
    }
    
    console.log('Final customer ID:', customerId)

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
    console.log('Setup intent response:', { status: setupIntentResponse.status, ok: setupIntentResponse.ok, hasClientSecret: !!setupIntent?.client_secret, error: setupIntent?.error })

    if (!setupIntentResponse.ok) {
      console.error('Failed to create setup intent:', setupIntent)
      return new Response(
        JSON.stringify({ error: 'Failed to create setup intent', details: setupIntent }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Setup intent created successfully')

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

