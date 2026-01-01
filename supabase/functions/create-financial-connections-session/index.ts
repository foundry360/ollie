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
    console.log('=== create-financial-connections-session function called ===')
    
    // Get request body
    const body = await req.json()
    const { 
      teen_user_id, 
      approval_token,
      customer_id // Optional - will create if not provided
    } = body

    if (!teen_user_id) {
      return new Response(
        JSON.stringify({ error: 'teen_user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the teen user exists
    const { data: teenUser, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name')
      .eq('id', teen_user_id)
      .eq('role', 'teen')
      .single()

    if (userError || !teenUser) {
      return new Response(
        JSON.stringify({ error: 'Teen user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Stripe secret key
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper function to ensure customer exists in Stripe
    const ensureCustomerExists = async (customerIdToCheck: string | null): Promise<string> => {
      if (!customerIdToCheck) {
        // No customer ID, create new one
        if (!teenUser.email) {
          throw new Error('Cannot create Stripe customer without email')
        }
        const customerParams = new URLSearchParams()
        customerParams.append('email', teenUser.email)
        customerParams.append('metadata[user_id]', teenUser.id)
        customerParams.append('metadata[role]', 'teen')

        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': teenUser.id,
          },
          body: customerParams,
        })

        const customer = await customerResponse.json()
        if (!customerResponse.ok) {
          throw new Error(`Failed to create Stripe customer: ${customer.error?.message || 'Unknown error'}`)
        }
        console.log('Created new Stripe customer:', customer.id)
        return customer.id
      }

      // Verify customer exists
      console.log('Verifying existing customer in Stripe:', customerIdToCheck)
      const verifyResponse = await fetch(`https://api.stripe.com/v1/customers/${customerIdToCheck}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      })

      const verifyBody = await verifyResponse.json()
      console.log('Customer verification result:', {
        status: verifyResponse.status,
        ok: verifyResponse.ok,
        hasError: !!verifyBody.error,
        errorCode: verifyBody.error?.code,
        hasId: !!verifyBody.id,
        customerId: customerIdToCheck
      })
      
      // If customer exists and is valid, return it
      if (verifyResponse.ok && !verifyBody.error && verifyBody.id) {
        console.log('Customer verified:', customerIdToCheck)
        return customerIdToCheck
      }

      // Customer doesn't exist (404 or error in response), create new one
      console.log('Customer not found in Stripe, creating new customer...')
      if (!teenUser.email) {
        throw new Error('Customer not found and cannot create new customer without email')
      }

      const customerParams = new URLSearchParams()
      customerParams.append('email', teenUser.email)
      customerParams.append('metadata[user_id]', teenUser.id)
      customerParams.append('metadata[role]', 'teen')

      const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Idempotency-Key': teenUser.id,
        },
        body: customerParams,
      })

      const customer = await customerResponse.json()
      if (!customerResponse.ok) {
        throw new Error(`Failed to create Stripe customer: ${customer.error?.message || 'Unknown error'}`)
      }
      console.log('Created new Stripe customer after verification failed:', customer.id)
      return customer.id
    }

    // Get or create Stripe customer
    let customerId = customer_id || null

    // Check if user already has a customer ID
    const { data: existingBankAccount } = await supabase
      .from('bank_accounts')
      .select('stripe_customer_id')
      .eq('user_id', teenUser.id)
      .limit(1)
      .maybeSingle()

    if (existingBankAccount?.stripe_customer_id) {
      customerId = existingBankAccount.stripe_customer_id
    }

    // Ensure customer exists in Stripe (verify and create if needed)
    try {
      customerId = await ensureCustomerExists(customerId)
      console.log('Customer verified/created successfully:', customerId)
    } catch (error: any) {
      console.error('Failed to ensure customer exists:', {
        message: error?.message,
        stack: error?.stack,
        error: error
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get or create Stripe customer',
          details: error?.message || 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!customerId) {
      console.error('Customer ID is null after ensureCustomerExists')
      return new Response(
        JSON.stringify({ error: 'Customer ID is missing after verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Financial Connections Session
    // Note: Financial Connections Sessions don't accept customer, payment_method_type, or payment_method_collection
    // These are handled separately after the connection is established
    const sessionParams = new URLSearchParams()
    
    // Account holder is required - use the teen's information
    sessionParams.append('account_holder[type]', 'customer')
    sessionParams.append('account_holder[customer]', customerId)
    
    // Stripe expects permissions as array: permissions[]=value1&permissions[]=value2
    sessionParams.append('permissions[]', 'payment_method') // Request payment method permission
    sessionParams.append('permissions[]', 'balances') // Optional: request balance access
    // For filters, use the indexed format: filters[countries][0]=US
    sessionParams.append('filters[countries][0]', 'US') // US banks only
    
    // Add return URL for web redirects (optional - can be passed from client)
    const returnUrl = body.return_url
    if (returnUrl) {
      sessionParams.append('return_url', returnUrl)
    }

    console.log('Creating Financial Connections session for customer:', customerId)
    console.log('Session params (sanitized):', {
      permissions: ['payment_method', 'balances'],
      filters: { countries: ['US'] },
      has_return_url: !!returnUrl,
      customer_id: customerId // Note: customer is not passed to session, but stored for later use
    })

    const sessionResponse = await fetch('https://api.stripe.com/v1/financial_connections/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: sessionParams,
    })

    const session = await sessionResponse.json()

    if (!sessionResponse.ok) {
      console.error('Failed to create Financial Connections session:', {
        status: sessionResponse.status,
        statusText: sessionResponse.statusText,
        error: session.error,
        full_response: session
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create Financial Connections session',
          details: session.error?.message || 'Unknown error',
          stripe_error: session.error,
          stripe_error_code: session.error?.code,
          stripe_error_type: session.error?.type
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Financial Connections session created:', session.id)
    console.log('Session response keys:', Object.keys(session))
    console.log('Session full response:', JSON.stringify(session, null, 2))
    
    // Log specific URL-related fields that might be in the session
    const sessionAny = session as any
    console.log('Session URL fields:', {
      url: sessionAny.url,
      hosted_url: sessionAny.hosted_url,
      redirect_url: sessionAny.redirect_url,
      hosted_redirect_url: sessionAny.hosted_redirect_url,
      client_secret: sessionAny.client_secret,
      client_secret_present: !!sessionAny.client_secret
    })

    // Return the session with client_secret and any URLs for client-side use
    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: session.id,
          client_secret: session.client_secret,
          customer: session.customer,
          status: session.status,
          // Include any URL fields from the session if available
          url: (session as any).url,
          hosted_url: (session as any).hosted_url,
        },
        customer_id: customerId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in create-financial-connections-session:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      type: error?.constructor?.name
    })
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error?.message || 'Unknown error',
        error_type: error?.constructor?.name
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

