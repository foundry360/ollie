import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    console.log('=== Function called ===')
    console.log('Method:', req.method)
    console.log('URL:', req.url)
    
    const url = new URL(req.url)
    
    // Handle POST request to save payment method (called from the HTML page)
    if (req.method === 'POST') {
      console.log('=== POST request received ===')
      console.log('Request URL:', req.url)
      console.log('Request method:', req.method)
      
      // Log all headers
      const allHeaders: Record<string, string> = {}
      req.headers.forEach((value, key) => {
        allHeaders[key] = key.toLowerCase() === 'authorization' ? (value.substring(0, 20) + '...') : value
      })
      console.log('All request headers:', JSON.stringify(allHeaders, null, 2))
      
      // Try multiple header name variations
      const authHeader = req.headers.get('Authorization') || 
                        req.headers.get('authorization') ||
                        req.headers.get('AUTHORIZATION')
      
      console.log('Authorization header present:', !!authHeader)
      console.log('Authorization header value:', authHeader ? (authHeader.substring(0, 30) + '...') : 'null')
      console.log('Authorization header length:', authHeader ? authHeader.length : 0)
      
      if (!authHeader) {
        console.error('POST request missing Authorization header')
        return new Response(
          JSON.stringify({ error: 'Missing authorization header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const body = await req.json()
      console.log('Request body keys:', Object.keys(body))
      const { payment_method_id } = body
      
      if (!payment_method_id) {
        console.error('POST request missing payment_method_id')
        return new Response(
          JSON.stringify({ error: 'Missing payment_method_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Payment method ID:', payment_method_id)

      // Validate token and get user
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      console.log('Supabase URL configured:', !!supabaseUrl)
      console.log('Supabase service key configured:', !!supabaseServiceKey)
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      
      const token = authHeader.replace('Bearer ', '').trim()
      console.log('Token extracted, length:', token.length)
      console.log('Token prefix:', token.substring(0, 20) + '...')
      console.log('Token suffix:', '...' + token.substring(token.length - 20))
      
      // Validate token format first
      const tokenParts = token.split('.')
      if (tokenParts.length !== 3) {
        console.error('Invalid token format - not a JWT (should have 3 parts separated by dots)')
        return new Response(
          JSON.stringify({ 
            error: 'Invalid token format',
            hint: 'Token must be a valid JWT with 3 parts (header.payload.signature). Make sure you are using a user access_token from a session, not a service role key or anon key.'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Decode token to check if it has required claims
      try {
        const payload = JSON.parse(atob(tokenParts[1]))
        console.log('Token payload decoded:', {
          sub: payload.sub,
          exp: payload.exp,
          iat: payload.iat,
          aud: payload.aud,
          role: payload.role,
          expDate: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          now: new Date().toISOString(),
          expired: payload.exp ? Date.now() > payload.exp * 1000 : null,
        })
        
        if (!payload.sub) {
          console.error('Token missing sub claim - this is not a valid user JWT token')
          return new Response(
            JSON.stringify({ 
              error: 'Invalid token: missing sub claim',
              hint: 'This token is not a valid user JWT. You need to use a user access_token from a session (session.access_token), not a service role key or anon key. Get it from: supabase.auth.getSession() or from your app\'s auth state.'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (payload.role === 'service_role') {
          console.error('Token is a service role key, not a user token')
          return new Response(
            JSON.stringify({ 
              error: 'Invalid token: service role key detected',
              hint: 'You are using a service role key. You need to use a user access_token from a session instead. Get it from: const { data: { session } } = await supabase.auth.getSession(); const token = session.access_token'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        if (payload.exp && Date.now() > payload.exp * 1000) {
          console.error('Token is expired')
          return new Response(
            JSON.stringify({ 
              error: 'Token expired',
              hint: 'The token has expired. Get a fresh token from: const { data: { session } } = await supabase.auth.getSession()'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      } catch (decodeError) {
        console.error('Could not decode token:', decodeError)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid token format',
            hint: 'Token could not be decoded. Make sure you are using a valid JWT token (user access_token from session).'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Try validating with service role key first
      console.log('Validating token with Supabase (service role)...')
      let { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      // If that fails, try with anon key (some tokens might need this)
      if (userError || !user) {
        console.log('Service role validation failed, trying with anon key...')
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
        if (supabaseAnonKey) {
          const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
          const anonResult = await supabaseAnon.auth.getUser(token)
          if (anonResult.data?.user && !anonResult.error) {
            console.log('Token validated successfully with anon key')
            user = anonResult.data.user
            userError = null
          } else {
            console.error('Anon key validation also failed:', anonResult.error)
          }
        }
      }
      
      if (userError) {
        console.error('Token validation error:', userError)
        console.error('Error message:', userError.message)
        console.error('Error status:', userError.status)
        console.error('Error name:', userError.name)
        console.error('Error code:', userError.code)
      }
      
      if (userError || !user) {
        console.error('Invalid token - userError:', userError)
        console.error('Invalid token - user:', user)
        return new Response(
          JSON.stringify({ 
            error: 'Invalid or expired token', 
            details: userError?.message,
            hint: 'Make sure you are using a valid user JWT token (access_token from session), not a service role key'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Token validated successfully, user ID:', user.id)

      // Get user profile
      console.log('Fetching user profile...')
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('email')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('Error fetching user profile:', profileError)
      } else {
        console.log('User profile fetched, email:', profile?.email)
      }

      // Initialize Stripe
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
      console.log('Stripe secret key configured:', !!stripeSecretKey)
      if (!stripeSecretKey) {
        console.error('Stripe secret key not configured')
        return new Response(
          JSON.stringify({ error: 'Stripe not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get payment method details from Stripe
      console.log('Fetching payment method from Stripe...')
      const pmResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      })

      const paymentMethod = await pmResponse.json()
      console.log('Stripe payment method response status:', pmResponse.status)
      console.log('Payment method type:', paymentMethod?.type)

      if (!pmResponse.ok) {
        console.error('Stripe payment method fetch failed:', paymentMethod)
        return new Response(
          JSON.stringify({ error: 'Invalid payment method', details: paymentMethod }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      console.log('Payment method retrieved successfully from Stripe')

      // Get or create Stripe customer
      console.log('Checking for existing Stripe customer...')
      let customerId = null
      const { data: existingPm, error: existingPmError } = await supabase
        .from('payment_methods')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (existingPmError && existingPmError.code !== 'PGRST116') {
        console.error('Error checking existing payment methods:', existingPmError)
      }

      if (existingPm?.stripe_customer_id) {
        customerId = existingPm.stripe_customer_id
        console.log('Using existing Stripe customer:', customerId)
      } else {
        console.log('Creating new Stripe customer...')
        // Create customer
        const customerParams = new URLSearchParams()
        customerParams.append('email', profile?.email || user.email || '')
        customerParams.append('metadata[user_id]', user.id)

        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: customerParams,
        })

        const customer = await customerResponse.json()
        console.log('Stripe customer creation response status:', customerResponse.status)
        if (customerResponse.ok) {
          customerId = customer.id
          console.log('Stripe customer created:', customerId)
        } else {
          console.error('Failed to create Stripe customer:', customer)
        }
      }

      // Attach payment method to customer
      if (customerId) {
        console.log('Attaching payment method to customer...')
        const attachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            customer: customerId,
          }),
        })
        const attachResult = await attachResponse.json()
        console.log('Payment method attach response status:', attachResponse.status)
        if (!attachResponse.ok) {
          console.error('Failed to attach payment method:', attachResult)
        } else {
          console.log('Payment method attached successfully')
        }
      } else {
        console.warn('No customer ID, skipping payment method attachment')
      }

      // Check if this is the first payment method for this user
      console.log('Checking for existing payment methods...')
      const { data: existingMethods, error: existingMethodsError } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
      
      if (existingMethodsError) {
        console.error('Error checking existing methods:', existingMethodsError)
      }
      
      // Set as default if this is the first payment method
      const shouldBeDefault = existingMethods?.length === 0
      console.log('Is first payment method (should be default):', shouldBeDefault)
      console.log('Existing methods count:', existingMethods?.length || 0)
      
      // If setting as default, unset all other defaults for this user
      if (shouldBeDefault) {
        console.log('Unsetting other default payment methods...')
        const { error: unsetError } = await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('is_default', true)
        
        if (unsetError) {
          console.error('Error unsetting defaults:', unsetError)
        }
      }

      // Extract payment method details
      const pmData: any = {
        user_id: user.id,
        stripe_payment_method_id: payment_method_id,
        stripe_customer_id: customerId,
        type: paymentMethod.type,
        is_default: shouldBeDefault,
      }

      if (paymentMethod.type === 'card' && paymentMethod.card) {
        pmData.card_brand = paymentMethod.card.brand
        pmData.card_last4 = paymentMethod.card.last4
        pmData.card_exp_month = paymentMethod.card.exp_month
        pmData.card_exp_year = paymentMethod.card.exp_year
      } else if (paymentMethod.type === 'us_bank_account' && paymentMethod.us_bank_account) {
        pmData.bank_name = paymentMethod.us_bank_account.bank_name
        pmData.bank_last4 = paymentMethod.us_bank_account.last4
      }

      // Check if payment method already exists
      console.log('Checking if payment method already exists in database...')
      const { data: existing, error: existingError } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('stripe_payment_method_id', payment_method_id)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('Error checking existing payment method:', existingError)
      }

      let savedPm
      if (existing) {
        console.log('Updating existing payment method, ID:', existing.id)
        // Update existing
        const { data, error } = await supabase
          .from('payment_methods')
          .update(pmData)
          .eq('id', existing.id)
          .select()
          .single()

        if (error) {
          console.error('Error updating payment method:', error)
          throw error
        }
        savedPm = data
        console.log('Payment method updated successfully')
      } else {
        console.log('Inserting new payment method...')
        // Insert new
        const { data, error } = await supabase
          .from('payment_methods')
          .insert(pmData)
          .select()
          .single()

        if (error) {
          console.error('Error inserting payment method:', error)
          throw error
        }
        savedPm = data
        console.log('Payment method inserted successfully, ID:', savedPm.id)
      }

      console.log('=== POST request completed successfully ===')
      return new Response(
        JSON.stringify({ payment_method: savedPm }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle GET request to show payment form
    console.log('=== GET request received ===')
    console.log('Request URL:', req.url)
    
    // Log all headers for debugging
    console.log('All request headers:')
    req.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`)
    })
    
    const authToken = url.searchParams.get('token') || ''
    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY') || ''

    console.log('Auth token present:', !!authToken)
    console.log('Auth token length:', authToken.length)
    console.log('Publishable key configured:', !!publishableKey)
    console.log('Stripe secret key configured:', !!stripeSecretKey)

    if (!authToken) {
      console.error('Missing token parameter')
      return new Response('Missing token parameter', { status: 400 })
    }

    if (!stripeSecretKey) {
      console.error('Stripe secret key not configured')
      return new Response('Stripe not configured', { status: 500 })
    }

    // SIMPLIFIED: Create setup intent right here - no separate function call needed!
    let clientSecret = null
    let userId = null
    
    // Try to get user info from token (optional - for linking to Stripe customer)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    try {
      const token = authToken.trim()
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      
      if (user && !userError) {
        userId = user.id
      }
    } catch (e) {
      console.log('Could not get user from token, continuing without user info')
    }

    // Get or create Stripe customer (optional - only if we have user)
    let customerId = null
    if (userId) {
      try {
        const { data: existingPm } = await supabase
          .from('payment_methods')
          .select('stripe_customer_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle()

        if (existingPm?.stripe_customer_id) {
          customerId = existingPm.stripe_customer_id
        }
      } catch (e) {
        console.log('Could not check for existing customer')
      }
    }

    // Create Setup Intent directly
    const setupIntentParams = new URLSearchParams()
    if (customerId) {
      setupIntentParams.append('customer', customerId)
    }
    setupIntentParams.append('payment_method_types[]', 'card')
    setupIntentParams.append('usage', 'off_session')

    const setupIntentResponse = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: setupIntentParams,
    })

    const setupIntent = await setupIntentResponse.json()

    if (!setupIntentResponse.ok || !setupIntent.client_secret) {
      console.error('Failed to create setup intent:', setupIntent)
      return new Response('Failed to create setup intent', { status: 500 })
    }

    clientSecret = setupIntent.client_secret
    console.log('Setup intent created successfully, client_secret length:', clientSecret?.length)
    
    console.log('Rendering payment form HTML...')

    // Return HTML page with Stripe Elements
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Add Payment Method</title>
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      height: 100%;
      width: 100%;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      padding: 20px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100%;
      overflow-y: auto;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin: 20px auto;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 24px;
      color: #111827;
    }
    #payment-element {
      margin-bottom: 24px;
      min-height: 200px;
    }
    /* Ensure Stripe Elements are visible */
    #payment-element .StripeElement,
    #payment-element iframe {
      min-height: 200px;
    }
    /* Mobile-friendly adjustments */
    @media (max-width: 600px) {
      body {
        padding: 10px;
      }
      .container {
        padding: 20px;
        margin: 10px auto;
      }
      h1 {
        font-size: 20px;
        margin-bottom: 20px;
      }
    }
    button {
      width: 100%;
      background: #73af17;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 16px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #5a8a12;
    }
    button:disabled {
      background: #9CA3AF;
      cursor: not-allowed;
    }
    #error-message {
      color: #EF4444;
      margin-top: 12px;
      font-size: 14px;
    }
    #success-message {
      color: #10B981;
      margin-top: 12px;
      font-size: 14px;
    }
    .loading {
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Add Payment Method</h1>
    <form id="payment-form">
      <div id="payment-element">
        <!-- Stripe Elements will create form elements here -->
      </div>
      <button id="submit" type="submit">
        <span id="button-text">Add Payment Method</span>
      </button>
      <div id="error-message" role="alert"></div>
      <div id="success-message"></div>
    </form>
  </div>

  <script>
    // Store token in sessionStorage as backup (in case URL params are lost)
    const urlParamsOnLoad = new URLSearchParams(window.location.search);
    const tokenOnLoad = urlParamsOnLoad.get('token');
    if (tokenOnLoad) {
      try {
        sessionStorage.setItem('stripe_payment_token', tokenOnLoad);
        console.log('Token stored in sessionStorage');
      } catch (e) {
        console.warn('Could not store token in sessionStorage:', e);
      }
    }

    const stripe = Stripe('${publishableKey}');
    const elements = stripe.elements({
      clientSecret: '${clientSecret}',
      appearance: {
        theme: 'stripe',
      },
    });

    const paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');

    const form = document.getElementById('payment-form');
    const submitButton = document.getElementById('submit');
    const buttonText = document.getElementById('button-text');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      submitButton.disabled = true;
      buttonText.textContent = 'Processing...';
      errorMessage.textContent = '';
      successMessage.textContent = '';

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.origin + window.location.pathname + '?success=true',
        },
        redirect: 'if_required',
      });

      if (error) {
        errorMessage.textContent = error.message;
        submitButton.disabled = false;
        buttonText.textContent = 'Add Payment Method';
      } else {
        // Success - add payment method to database
        if (setupIntent && setupIntent.payment_method) {
          buttonText.textContent = 'Saving...';
          
          try {
            // Get token from URL params, sessionStorage, or embedded token from server
            console.log('=== Preparing to save payment method ===');
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            console.log('Token from URL params:', urlToken ? (urlToken.substring(0, 20) + '...') : 'null');
            
            // Try to get token from sessionStorage (backup)
            let storedToken = null;
            try {
              storedToken = sessionStorage.getItem('stripe_payment_token');
              console.log('Token from sessionStorage:', storedToken ? (storedToken.substring(0, 20) + '...') : 'null');
            } catch (e) {
              console.warn('Could not read from sessionStorage:', e);
            }
            
            const embeddedTokenValue = ${authToken ? JSON.stringify(authToken) : 'null'};
            // Handle case where embeddedTokenValue might be the string 'null'
            const embeddedToken = (embeddedTokenValue && embeddedTokenValue !== 'null') ? embeddedTokenValue : null;
            console.log('Embedded token from server:', embeddedToken ? (embeddedToken.substring(0, 20) + '...') : 'null');
            console.log('Embedded token type:', typeof embeddedToken);
            
            // Try URL token first, then sessionStorage, then embedded
            const finalToken = urlToken || storedToken || embeddedToken;
            console.log('Final token to use:', finalToken ? (finalToken.substring(0, 20) + '...') : 'null');
            console.log('Final token length:', finalToken ? finalToken.length : 0);
            console.log('Final token type:', typeof finalToken);
            
            if (!finalToken || (typeof finalToken === 'string' && finalToken.trim() === '') || finalToken === 'null') {
              console.error('No valid token available - URL token:', !!urlToken, 'Embedded token:', !!embeddedToken);
              console.error('URL token value:', urlToken);
              console.error('Embedded token value:', embeddedToken);
              throw new Error('Missing authentication token. Please close and try again.');
            }
            
            // Ensure token is a string
            const tokenString = String(finalToken).trim();
            if (!tokenString || tokenString === 'null' || tokenString === 'undefined') {
              console.error('Token is invalid after conversion:', tokenString);
              throw new Error('Invalid authentication token. Please close and try again.');
            }
            
            // Call the same function (stripe-payment-form) with POST to save payment method
            // This avoids CORS and authorization issues
            const functionUrl = window.location.origin + window.location.pathname;
            
            console.log('Calling stripe-payment-form to save payment method at:', functionUrl);
            console.log('Payment method ID:', setupIntent.payment_method);
            console.log('Authorization header will be:', 'Bearer ' + tokenString.substring(0, 20) + '...');
            console.log('Full Authorization header length:', ('Bearer ' + tokenString).length);
            
            // Build headers object
            const headers = {
              'Authorization': 'Bearer ' + tokenString,
              'Content-Type': 'application/json',
            };
            
            console.log('Request headers:', JSON.stringify(Object.keys(headers)));
            console.log('Authorization header present in headers object:', !!headers['Authorization']);
            console.log('Authorization header value (first 30 chars):', headers['Authorization'] ? headers['Authorization'].substring(0, 30) + '...' : 'MISSING');
            
            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: headers,
              body: JSON.stringify({
                payment_method_id: setupIntent.payment_method,
              }),
            });
            
            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);
            
            if (!response.ok) {
              const errorText = await response.text();
              let errorData;
              try {
                errorData = JSON.parse(errorText);
              } catch {
                errorData = { error: errorText };
              }
              console.error('Error response:', response.status, errorData);
              throw new Error(errorData.error || 'Failed to save payment method (Status: ' + response.status + ')');
            }
            
            const result = await response.json();
            
            successMessage.textContent = 'Payment method added successfully!';
            
            // Redirect back to app after 2 seconds
            setTimeout(() => {
              // Try to close if in WebView, otherwise redirect
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAYMENT_METHOD_ADDED',
                  paymentMethodId: setupIntent.payment_method
                }));
              } else {
                // For expo-web-browser, we'll use a deep link
                window.location.href = 'ollie://payment-method-added?payment_method_id=' + setupIntent.payment_method;
              }
            }, 2000);
          } catch (err) {
            console.error('Error saving payment method:', err);
            errorMessage.textContent = err.message || 'Payment method was added but failed to save. Please try again.';
            submitButton.disabled = false;
            buttonText.textContent = 'Add Payment Method';
          }
        }
      }
    });
  </script>
</body>
</html>
    `

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    })
  } catch (error: any) {
    console.error('Error in stripe-payment-form function:', error)
    return new Response(
      `Error: ${error?.message || String(error)}`,
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
      }
    )
  }
})

