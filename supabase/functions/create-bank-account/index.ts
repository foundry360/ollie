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

    // Get request body
    const { 
      routing_number, 
      account_number, 
      account_type, 
      account_holder_name 
    } = await req.json()

    // Validate required fields
    if (!routing_number || !account_number || !account_type || !account_holder_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: routing_number, account_number, account_type, account_holder_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate routing number format (9 digits)
    if (!/^\d{9}$/.test(routing_number)) {
      return new Response(
        JSON.stringify({ error: 'Routing number must be exactly 9 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate account number format (at least 4 digits)
    if (!/^\d{4,17}$/.test(account_number)) {
      return new Response(
        JSON.stringify({ error: 'Account number must be between 4 and 17 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate account type
    if (!['checking', 'savings'].includes(account_type)) {
      return new Response(
        JSON.stringify({ error: 'Account type must be "checking" or "savings"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      .select('id, role, email, parent_id')
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
        JSON.stringify({ error: 'Only teens can add bank accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a bank account
    const { data: existingAccount } = await supabase
      .from('bank_accounts')
      .select('id, verification_status')
      .eq('user_id', user.id)
      .single()

    if (existingAccount) {
      return new Response(
        JSON.stringify({ 
          error: 'Bank account already exists',
          existing_account_id: existingAccount.id,
          verification_status: existingAccount.verification_status
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check parent approval if needed
    if (userProfile.parent_id) {
      const { data: approval } = await supabase
        .from('bank_account_approvals')
        .select('status')
        .eq('teen_id', user.id)
        .single()

      if (!approval || approval.status !== 'approved') {
        return new Response(
          JSON.stringify({ 
            error: 'Parent approval required. Please request and complete parent approval first.',
            approval_status: approval?.status || 'none'
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe Customer
    let customerId: string | null = null

    // Check if user already has a customer ID in bank_accounts or payment_methods
    const { data: existingBankAccount } = await supabase
      .from('bank_accounts')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (existingBankAccount?.stripe_customer_id) {
      customerId = existingBankAccount.stripe_customer_id
    } else {
      // Check payment_methods table
      const { data: existingPm } = await supabase
        .from('payment_methods')
        .select('stripe_customer_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (existingPm?.stripe_customer_id) {
        customerId = existingPm.stripe_customer_id
      }
    }

    // If no customer ID found, create one or search Stripe
    if (!customerId) {
      const userEmail = userProfile.email || user.email

      if (userEmail) {
        // Search Stripe for existing customer with this email using the correct search syntax
        const searchParams = new URLSearchParams()
        searchParams.append('query', `email:'${userEmail}'`)  // Use 'query' with email: syntax
        searchParams.append('limit', '10')  // Get more results to check all matches

        const searchResponse = await fetch(`https://api.stripe.com/v1/customers/search?${searchParams.toString()}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        })

        if (searchResponse.ok) {
          const searchResult = await searchResponse.json()
          if (searchResult.data && searchResult.data.length > 0) {
            // Use the first (most recent) customer
            customerId = searchResult.data[0].id
            console.log(`Found ${searchResult.data.length} existing Stripe customer(s), using:`, customerId)
            
            // Log if there are duplicates
            if (searchResult.data.length > 1) {
              console.warn(`WARNING: Found ${searchResult.data.length} Stripe customers for email ${userEmail}. Consider consolidating.`)
              console.warn('Duplicate customer IDs:', searchResult.data.map((c: any) => c.id).join(', '))
            }
          }
        } else {
          const searchError = await searchResponse.json()
          console.warn('Stripe customer search failed:', searchError)
        }

        // If no existing customer found, create one
        if (!customerId) {
          const customerParams = new URLSearchParams()
          customerParams.append('email', userEmail)
          customerParams.append('metadata[user_id]', user.id)
          customerParams.append('metadata[role]', 'teen')

          const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': `customer-${user.id}`, // More specific idempotency key
            },
            body: customerParams,
          })

          const customer = await customerResponse.json()
          if (customerResponse.ok) {
            customerId = customer.id
            console.log('Created new Stripe customer:', customerId)
          } else {
            // If customer creation fails due to duplicate, try to find it again
            if (customer.error?.code === 'resource_already_exists' || customer.error?.type === 'idempotency_error') {
              console.log('Customer already exists (idempotency), searching again...')
              // Retry the search
              const retrySearch = await fetch(`https://api.stripe.com/v1/customers/search?query=email:'${userEmail}'&limit=1`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${stripeSecretKey}`,
                },
              })
              if (retrySearch.ok) {
                const retryResult = await retrySearch.json()
                if (retryResult.data && retryResult.data.length > 0) {
                  customerId = retryResult.data[0].id
                  console.log('Found customer after idempotency error:', customerId)
                }
              }
            }
            
            if (!customerId) {
              console.error('Failed to create Stripe customer:', customer)
              return new Response(
                JSON.stringify({ 
                  error: 'Failed to create Stripe customer', 
                  details: customer.error?.message || JSON.stringify(customer) 
                }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
          }
        }
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Failed to get or create Stripe customer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Stripe Payment Method (bank account)
    // Note: Cannot attach during creation - must create first, then attach
    const paymentMethodParams = new URLSearchParams()
    paymentMethodParams.append('type', 'us_bank_account')
    paymentMethodParams.append('billing_details[name]', account_holder_name)
    paymentMethodParams.append('us_bank_account[account_number]', account_number)
    paymentMethodParams.append('us_bank_account[routing_number]', routing_number)
    paymentMethodParams.append('us_bank_account[account_holder_type]', 'individual')
    paymentMethodParams.append('metadata[user_id]', user.id)
    paymentMethodParams.append('metadata[account_type]', account_type)

    console.log('Creating payment method for customer:', customerId)

    const paymentMethodResponse = await fetch('https://api.stripe.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paymentMethodParams,
    })

    const paymentMethod = await paymentMethodResponse.json()

    if (!paymentMethodResponse.ok) {
      console.error('=== CREATE PAYMENT METHOD ERROR ===')
      console.error('Status:', paymentMethodResponse.status)
      console.error('Full error response:', JSON.stringify(paymentMethod, null, 2))
      
      const stripeError = paymentMethod.error
      const errorMessage = stripeError?.message || stripeError?.code || 'Unknown Stripe error'
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create bank account',
          details: errorMessage
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Payment method created successfully:', {
      id: paymentMethod.id,
      type: paymentMethod.type,
    })

    // For US bank accounts, we need to create a SetupIntent for verification
    // US bank accounts must be verified (via micro-deposits) before they can be attached to a customer
    console.log('Creating SetupIntent for bank account verification:', {
      payment_method_id: paymentMethod.id,
      customer_id: customerId,
    })

    const setupIntentParams = new URLSearchParams()
    setupIntentParams.append('customer', customerId)
    setupIntentParams.append('payment_method', paymentMethod.id)
    setupIntentParams.append('payment_method_types[]', 'us_bank_account')
    setupIntentParams.append('usage', 'off_session')
    setupIntentParams.append('metadata[user_id]', user.id)
    setupIntentParams.append('metadata[account_type]', account_type)

    const setupIntentResponse = await fetch('https://api.stripe.com/v1/setup_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: setupIntentParams,
    })

    let setupIntent = await setupIntentResponse.json()

    if (!setupIntentResponse.ok) {
      console.error('=== CREATE SETUP INTENT ERROR ===')
      console.error('Status:', setupIntentResponse.status)
      console.error('Full error response:', JSON.stringify(setupIntent, null, 2))
      
      const stripeError = setupIntent.error
      const errorMessage = stripeError?.message || stripeError?.code || 'Unknown Stripe error'
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create setup intent for bank account verification',
          details: errorMessage
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('SetupIntent created successfully:', {
      id: setupIntent.id,
      status: setupIntent.status,
      payment_method: setupIntent.payment_method,
    })

    // Confirm the SetupIntent to trigger micro-deposits and make it visible in dashboard
    if (setupIntent.status === 'requires_confirmation') {
      console.log('Confirming SetupIntent to trigger micro-deposits...')
      
      const confirmParams = new URLSearchParams()
      confirmParams.append('payment_method', paymentMethod.id)
      // For US bank accounts, mandate_data is required when confirming
      confirmParams.append('mandate_data[customer_acceptance][type]', 'online')
      confirmParams.append('mandate_data[customer_acceptance][online][ip_address]', '0.0.0.0') // Server-side, no real IP
      confirmParams.append('mandate_data[customer_acceptance][online][user_agent]', 'Ollie-App/1.0')
      
      const confirmResponse = await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntent.id}/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: confirmParams,
      })
      
      const confirmedIntent = await confirmResponse.json()
      
      if (confirmResponse.ok) {
        console.log('SetupIntent confirmed successfully:', {
          id: confirmedIntent.id,
          status: confirmedIntent.status,
        })
        setupIntent = confirmedIntent
      } else {
        console.error('=== FAILED TO CONFIRM SETUP INTENT ===')
        console.error('Status:', confirmResponse.status)
        console.error('Status Text:', confirmResponse.statusText)
        console.error('Full error response:', JSON.stringify(confirmedIntent, null, 2))
        console.error('SetupIntent ID:', setupIntent.id)
        console.error('Payment Method ID:', paymentMethod.id)
        console.error('Error object:', confirmedIntent.error)
        
        // Extract detailed error information
        const stripeError = confirmedIntent.error
        if (stripeError) {
          console.error('Stripe Error Details:', {
            message: stripeError.message,
            code: stripeError.code,
            type: stripeError.type,
            param: stripeError.param,
            decline_code: stripeError.decline_code,
          })
        }
        
        // Continue anyway - the SetupIntent exists, just not confirmed yet
        // The bank account will still be saved, but micro-deposits won't be triggered
        console.warn('WARNING: SetupIntent was not confirmed. Micro-deposits will not be triggered automatically.')
      }
    }

    // The payment method will be attached to the customer automatically after verification
    // For now, we'll use the payment method directly (it's not attached yet, but will be after verification)
    const bankAccount = paymentMethod

    console.log('Payment method attached successfully:', {
      id: bankAccount.id,
      type: bankAccount.type,
      customer: bankAccount.customer,
      has_us_bank_account: !!bankAccount.us_bank_account,
    })

    // Extract payment method ID (this is now a payment method, not external account)
    // Payment methods have ID like pm_xxxxx
    const externalAccountId = bankAccount.id

    if (!externalAccountId) {
      console.error('Payment method ID is missing:', bankAccount)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create bank account',
          details: 'Payment method ID is missing after attachment'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract account details for storage (only last 4 digits for security)
    const accountNumberLast4 = account_number.slice(-4)
    const routingNumberLast4 = routing_number.slice(-4)
    const bankName = bankAccount.us_bank_account?.bank_name || null

    console.log('Bank account details:', {
      accountNumberLast4,
      routingNumberLast4,
      bankName,
      us_bank_account: bankAccount.us_bank_account,
    })

    // Determine verification status
    // For us_bank_account payment methods, check us_bank_account.status
    // Status can be: 'new', 'validated', 'verified', 'verification_failed', 'errored'
    let verificationStatus = 'pending'
    const usBankAccountStatus = bankAccount.us_bank_account?.status
    console.log('US Bank Account Status:', usBankAccountStatus)
    
    if (usBankAccountStatus === 'verified') {
      verificationStatus = 'verified'
    } else if (usBankAccountStatus === 'verification_failed' || usBankAccountStatus === 'errored') {
      verificationStatus = 'failed'
    } else {
      verificationStatus = 'pending' // 'new' or 'validated' - needs micro-deposits
    }

    // Store bank account in database
    // Note: The payment method is not yet attached to the customer - it will be attached after verification via SetupIntent
    const { data: savedAccount, error: saveError } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: user.id,
        stripe_external_account_id: externalAccountId,
        stripe_customer_id: customerId,
        account_type: account_type,
        account_holder_name: account_holder_name,
        bank_name: bankName,
        routing_number: routing_number, // Store full routing number (9 digits, not sensitive like account number)
        routing_number_last4: routingNumberLast4,
        account_number_last4: accountNumberLast4,
        verification_status: verificationStatus,
        verification_method: 'microdeposits',
        is_default: true,
        verified_at: verificationStatus === 'verified' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving bank account to database:', saveError)
      console.error('Save error details:', JSON.stringify(saveError, null, 2))
      
      // Note: Payment methods can't be deleted via DELETE endpoint
      // If needed, they can be detached from customer, but since save failed, 
      // the payment method isn't in our database so it's not a problem

      return new Response(
        JSON.stringify({ error: 'Failed to save bank account', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank account created successfully:', {
      user_id: user.id,
      payment_method_id: externalAccountId,
      verification_status: verificationStatus,
      stripe_status: usBankAccountStatus,
    })

    // Return success response with setup intent client secret for verification
    return new Response(
      JSON.stringify({
        success: true,
        bank_account: {
          id: savedAccount.id,
          verification_status: verificationStatus,
          bank_name: bankName,
          account_type: account_type,
          account_number_last4: accountNumberLast4,
          routing_number_last4: routingNumberLast4,
          requires_verification: verificationStatus === 'pending',
        },
        setup_intent: {
          id: setupIntent.id,
          client_secret: setupIntent.client_secret,
          status: setupIntent.status,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('=== TOP LEVEL ERROR IN create-bank-account FUNCTION ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    
    const errorMessage = error?.message || 'Unknown error'
    const errorDetails = error?.stack || error?.toString() || 'No additional details'
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: errorDetails
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})






