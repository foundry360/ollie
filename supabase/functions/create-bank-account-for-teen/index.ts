
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

  // Wrap everything in try-catch to ensure we always return a valid response
  try {
    console.log('=== create-bank-account-for-teen function called ===')
    
    // Get request body
    let body: any
    try {
      body = await req.json()
    } catch (parseError: any) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body', details: parseError?.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Request body received:', {
      setup_token: body.setup_token ? '***' : undefined,
      routing_number: body.routing_number ? '***' : undefined,
      account_number: body.account_number ? '***' : undefined,
      account_type: body.account_type,
      bank_name: body.bank_name,
      account_holder_name: body.account_holder_name ? '***' : undefined,
    })
    
    const { 
      setup_token,
      routing_number, 
      account_number, 
      account_type, 
      bank_name,
      account_holder_name 
    } = body

    // Validate required fields
    if (!setup_token || !routing_number || !account_number || !account_type || !bank_name || !account_holder_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: setup_token, routing_number, account_number, account_type, bank_name, account_holder_name' }),
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized')

    // Validate setup token and get approval record
    console.log('Validating setup token...')
    const { data: approval, error: approvalError } = await supabase
      .from('bank_account_approvals')
      .select('id, teen_id, status, token_expires_at, expires_at')
      .eq('setup_token', setup_token)
      .single()

    if (approvalError || !approval) {
      console.error('Approval lookup error:', approvalError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired setup token', details: approvalError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Approval found:', { id: approval.id, teen_id: approval.teen_id, status: approval.status })

    // Check if token is expired
    const expirationDate = approval.token_expires_at || approval.expires_at
    if (expirationDate && new Date(expirationDate) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Setup token has expired. Please request a new link.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already approved
    if (approval.status === 'approved') {
      return new Response(
        JSON.stringify({ error: 'Bank account has already been set up for this approval request.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get teen user profile
    console.log('Fetching teen user:', approval.teen_id)
    const { data: teenUser, error: teenError } = await supabase
      .from('users')
      .select('id, role, email, parent_id')
      .eq('id', approval.teen_id)
      .single()

    if (teenError || !teenUser) {
      console.error('Teen user lookup error:', teenError)
      return new Response(
        JSON.stringify({ error: 'Teen user not found', details: teenError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Teen user found:', { id: teenUser.id, email: teenUser.email, role: teenUser.role })

    // Verify user is a teen
    if (teenUser.role !== 'teen') {
      return new Response(
        JSON.stringify({ error: 'Invalid user role' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user already has a bank account
    const { data: existingAccount } = await supabase
      .from('bank_accounts')
      .select('id, verification_status')
      .eq('user_id', teenUser.id)
      .single()

    if (existingAccount) {
      // Update approval status to approved even if account exists
      await supabase
        .from('bank_account_approvals')
        .update({ 
          status: 'approved',
          verified_at: new Date().toISOString()
        })
        .eq('id', approval.id)

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Bank account already exists',
          bank_account: {
            id: existingAccount.id,
            verification_status: existingAccount.verification_status,
            requires_verification: existingAccount.verification_status === 'pending',
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      console.error('STRIPE_SECRET_KEY not found in environment')
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Stripe secret key found, proceeding with customer lookup/creation...')

    // Get or create Stripe Customer
    let customerId: string | null = null

    // Check if user already has a customer ID in bank_accounts or payment_methods
    const { data: existingBankAccount } = await supabase
      .from('bank_accounts')
      .select('stripe_customer_id')
      .eq('user_id', teenUser.id)
      .limit(1)
      .maybeSingle()

    if (existingBankAccount?.stripe_customer_id) {
      customerId = existingBankAccount.stripe_customer_id
    } else {
      // Check payment_methods table
      const { data: existingPm } = await supabase
        .from('payment_methods')
        .select('stripe_customer_id')
        .eq('user_id', teenUser.id)
        .limit(1)
        .maybeSingle()

      if (existingPm?.stripe_customer_id) {
        customerId = existingPm.stripe_customer_id
      }
    }

    // If no customer ID found, create one or search Stripe
    if (!customerId) {
      const userEmail = teenUser.email

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
          customerParams.append('metadata[user_id]', teenUser.id)
          customerParams.append('metadata[role]', 'teen')

          const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': `customer-${teenUser.id}`, // More specific idempotency key
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

    // Helper function to ensure customer exists in Stripe
    const ensureCustomerExists = async (customerIdToCheck: string | null): Promise<string> => {
      if (!customerIdToCheck) {
        // No customer ID, search first then create if needed
        if (!teenUser.email) {
          throw new Error('Cannot create Stripe customer without email')
        }
        
        // Search for existing customer first
        const searchParams = new URLSearchParams()
        searchParams.append('query', `email:'${teenUser.email}'`)
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
            return searchResult.data[0].id
          }
        }
        
        // Create new customer if not found
        const customerParams = new URLSearchParams()
        customerParams.append('email', teenUser.email)
        customerParams.append('metadata[user_id]', teenUser.id)
        customerParams.append('metadata[role]', 'teen')

        const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Idempotency-Key': `customer-${teenUser.id}`, // More specific idempotency key
          },
          body: customerParams,
        })

        const customer = await customerResponse.json()
        if (!customerResponse.ok) {
          // If idempotency error, try to find the customer
          if (customer.error?.code === 'resource_already_exists' || customer.error?.type === 'idempotency_error') {
            const retrySearch = await fetch(`https://api.stripe.com/v1/customers/search?query=email:'${teenUser.email}'&limit=1`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
              },
            })
            if (retrySearch.ok) {
              const retryResult = await retrySearch.json()
              if (retryResult.data && retryResult.data.length > 0) {
                return retryResult.data[0].id
              }
            }
          }
          throw new Error(`Failed to create Stripe customer: ${customer.error?.message || 'Unknown error'}`)
        }
        return customer.id
      }

      // Verify customer exists
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
        errorMessage: verifyBody.error?.message,
        hasId: !!verifyBody.id,
        customerId: customerIdToCheck
      })
      
      // If customer exists and is valid, return it
      // Check: status is 200, no error in body, and has id field
      const isValidCustomer = verifyResponse.status === 200 && !verifyBody.error && verifyBody.id
      if (isValidCustomer) {
        console.log('Customer verified successfully:', customerIdToCheck)
        return customerIdToCheck
      }

      // Customer doesn't exist (404 or error in response), create new one
      console.log('Customer not found or invalid in Stripe (status:', verifyResponse.status, 'error:', verifyBody.error?.code, '), creating new customer...')
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
        console.error('Failed to create new customer:', customer)
        throw new Error(`Failed to create Stripe customer: ${customer.error?.message || 'Unknown error'}`)
      }
      console.log('Created new Stripe customer:', customer.id)
      return customer.id
    }

    // Ensure we have a valid customer ID
    console.log('Ensuring customer exists, current customerId:', customerId)
    try {
      const verifiedCustomerId = await ensureCustomerExists(customerId)
      console.log('Customer verified/created:', verifiedCustomerId)
      customerId = verifiedCustomerId
    } catch (error: any) {
      console.error('Failed to ensure customer exists:', error)
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to get or create Stripe customer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!customerId) {
      return new Response(
        JSON.stringify({ error: 'Customer ID is missing after verification' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Stripe Payment Method (bank account) - MODERN API
    // Using Payment Methods API instead of deprecated /sources endpoint
    console.log('Creating Stripe bank account payment method for customer:', customerId)
    
    // Step 1: Create a Payment Method with type us_bank_account
    // For us_bank_account, we must create it WITHOUT customer, then attach it separately
    const paymentMethodParams = new URLSearchParams()
    paymentMethodParams.append('type', 'us_bank_account')
    // DO NOT include customer parameter - Stripe doesn't allow it during creation
    paymentMethodParams.append('billing_details[name]', account_holder_name)
    paymentMethodParams.append('us_bank_account[account_number]', account_number)
    paymentMethodParams.append('us_bank_account[routing_number]', routing_number)
    paymentMethodParams.append('us_bank_account[account_holder_type]', 'individual')
    paymentMethodParams.append('metadata[user_id]', teenUser.id)
    paymentMethodParams.append('metadata[account_type]', account_type)
    if (bank_name) {
      paymentMethodParams.append('metadata[bank_name]', bank_name)
    }

    console.log('Stripe Payment Method API request params (sanitized):', {
      type: 'us_bank_account',
      account_number: '***',
      routing_number: '***',
      account_holder_name: '***',
      account_holder_type: 'individual'
    })

    
    // Create the payment method
    const paymentMethodResponse = await fetch('https://api.stripe.com/v1/payment_methods', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paymentMethodParams,
    })
    
    console.log('Stripe Payment Method API response status:', paymentMethodResponse.status)

    const paymentMethod = await paymentMethodResponse.json()

    if (!paymentMethodResponse.ok) {
      console.error('Failed to create Stripe payment method:', {
        status: paymentMethodResponse.status,
        error: paymentMethod.error,
        response: paymentMethod,
        fullResponse: JSON.stringify(paymentMethod, null, 2)
      })
      
      // Log the full error for debugging
      console.error('Full Stripe error response:', JSON.stringify(paymentMethod, null, 2))
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create bank account',
          details: paymentMethod.error?.message || paymentMethod.error || 'Unknown error',
          stripe_error: paymentMethod.error,
          stripe_error_code: paymentMethod.error?.code,
          stripe_error_type: paymentMethod.error?.type,
          full_stripe_response: paymentMethod
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Stripe payment method created successfully:', {
      id: paymentMethod.id,
      type: paymentMethod.type,
      us_bank_account: paymentMethod.us_bank_account ? {
        bank_name: paymentMethod.us_bank_account.bank_name,
        account_holder_type: paymentMethod.us_bank_account.account_holder_type,
        account_type: paymentMethod.us_bank_account.account_type,
        status: paymentMethod.us_bank_account.status
      } : null
    })

    // Step 2: For us_bank_account, Stripe requires verification before attaching
    // This is a limitation of the Payment Methods API for ACH
    // We'll store the payment method without attaching it
    // Verification and attachment will be handled in a separate flow
    // (e.g., via Financial Connections API or a separate verification endpoint)
    
    console.log('Payment method created (not attached yet - requires verification first):', {
      id: paymentMethod.id,
      status: paymentMethod.us_bank_account?.status,
      supportedMethods: paymentMethod.us_bank_account?.supported_verification_methods
    })

    // Payment method is NOT attached to customer yet
    // It needs to be verified before it can be attached
    // We'll store it in the database and handle verification/attachment separately
    const attachedPaymentMethod = paymentMethod

    // Extract external account ID from the payment method
    // For us_bank_account payment methods, we use the payment method ID
    const externalAccountId = paymentMethod.id
    const bankAccountData = paymentMethod.us_bank_account || {}

    // Extract account details for storage
    const accountNumberLast4 = account_number.slice(-4)
    const routingNumberLast4 = routing_number.slice(-4)
    // Use user-provided bank_name, fallback to Stripe's bank_name if not provided
    const bankName = bank_name || bankAccountData.bank_name || null

    // Determine verification status
    // For us_bank_account payment methods, verification happens via micro-deposits
    // The status is typically 'new' initially, then 'verified' after micro-deposits
    let verificationStatus = 'pending'
    const pmStatus = bankAccountData.status
    if (pmStatus === 'verified') {
      verificationStatus = 'verified'
    } else if (pmStatus === 'verification_failed' || pmStatus === 'errored') {
      verificationStatus = 'failed'
    } else {
      verificationStatus = 'pending' // Needs micro-deposits
    }

    // Store bank account in database
    const { data: savedAccount, error: saveError } = await supabase
      .from('bank_accounts')
      .insert({
        user_id: teenUser.id,
        stripe_external_account_id: externalAccountId, // Now stores payment method ID
        stripe_customer_id: customerId,
        account_type: account_type,
        account_holder_name: account_holder_name,
        bank_name: bankName,
        routing_number: routing_number,
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
      console.error('Error saving bank account to database:', {
        error: saveError,
        message: saveError.message,
        code: saveError.code,
        details: saveError.details,
        hint: saveError.hint
      })
      
      // Attempt to detach and delete the payment method to clean up
      try {
        // Detach from customer
        await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethod.id}/detach`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        })
        // Delete the payment method
        await fetch(`https://api.stripe.com/v1/payment_methods/${paymentMethod.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        })
        console.log('Stripe cleanup completed')
      } catch (cleanupError) {
        console.error('Failed to cleanup Stripe payment method:', cleanupError)
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to save bank account', 
          details: saveError.message,
          code: saveError.code,
          hint: saveError.hint
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Bank account saved to database:', savedAccount.id)

    // Update approval status to approved
    const { error: updateApprovalError } = await supabase
      .from('bank_account_approvals')
      .update({ 
        status: 'approved',
        verified_at: new Date().toISOString()
      })
      .eq('id', approval.id)

    if (updateApprovalError) {
      console.error('Error updating approval status:', updateApprovalError)
      // Don't fail the request, but log the error
    }

    console.log('Bank account created successfully for teen:', {
      teen_id: teenUser.id,
      external_account_id: externalAccountId,
      payment_method_id: paymentMethod.id,
      verification_status: verificationStatus,
      stripe_status: bankAccountData.status,
      attached: false, // Not attached yet - will be attached after verification
    })
    
    // Note: Payment method is NOT attached to customer yet
    // It needs to be verified first (via micro-deposits)
    // After verification, it should be attached to the customer

    // Return success response
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
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('=== UNHANDLED ERROR in create-bank-account-for-teen function ===')
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    
    // Try to stringify error, but handle circular references
    let errorDetails: any = {}
    try {
      errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error))
    } catch (stringifyError) {
      errorDetails = {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        type: error?.constructor?.name
      }
    }
    console.error('Full error object:', errorDetails)
    
    // Ensure we always return valid JSON
    const errorResponse = {
      success: false,
      error: error?.message || 'Unknown error occurred',
      error_type: error?.constructor?.name || typeof error,
      details: error?.stack ? error.stack.substring(0, 500) : 'No stack trace available'
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

