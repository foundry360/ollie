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
    console.log('=== save-financial-connections-account function called ===')
    
    // Get request body
    const body = await req.json()
    const { 
      session_id, // Financial Connections session ID
      teen_user_id,
      approval_token // Optional - for parent approval flow
    } = body
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:38',message:'Function entry',data:{has_session_id:!!session_id,has_teen_user_id:!!teen_user_id,has_approval_token:!!approval_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!session_id || !teen_user_id) {
      return new Response(
        JSON.stringify({ error: 'session_id and teen_user_id are required' }),
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

    // Retrieve the Financial Connections session to get the account and payment method
    console.log('Retrieving Financial Connections session:', session_id)
    const sessionResponse = await fetch(
      `https://api.stripe.com/v1/financial_connections/sessions/${session_id}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      }
    )

    const session = await sessionResponse.json()

    if (!sessionResponse.ok) {
      console.error('Failed to retrieve Financial Connections session:', {
        status: sessionResponse.status,
        statusText: sessionResponse.statusText,
        sessionError: session.error,
        fullResponse: session
      })
      return new Response(
        JSON.stringify({ 
          error: 'Failed to retrieve Financial Connections session',
          details: session.error?.message || session.error?.code || 'Unknown error',
          stripeError: session.error
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Session retrieved successfully:', {
      session_id: session.id,
      status: session.status,
      accounts_count: session.accounts?.data?.length || 0,
      customer: session.account_holder?.customer,
      has_accounts_data: !!session.accounts?.data,
      accounts_structure: session.accounts ? Object.keys(session.accounts) : null
    })

    // Log full session structure for debugging
    console.log('Full session structure:', {
      id: session.id,
      status: session.status,
      object: session.object,
      client_secret: session.client_secret ? 'present' : 'missing',
      accounts_type: typeof session.accounts,
      accounts_value: session.accounts,
      account_holder: session.account_holder,
      all_keys: Object.keys(session)
    })

    // Check if session is in a valid state
    // Note: Some sessions might be 'pending' or 'requires_action' but still have accounts
    // Let's be more lenient and check for accounts first
    let accounts = session.accounts?.data || []
    
    // If no accounts in session but session exists, try to retrieve accounts directly from Stripe
    if (accounts.length === 0) {
      console.warn('No accounts found in session response. Attempting to retrieve accounts directly from Stripe...')
      const customerId = session.account_holder?.customer
      
      if (customerId) {
        // Try to get Financial Connections accounts for this customer
        const accountsResponse = await fetch(
          `https://api.stripe.com/v1/financial_connections/accounts?customer=${customerId}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          }
        )
        
        const accountsData = await accountsResponse.json()
        
        if (accountsResponse.ok && accountsData.data && accountsData.data.length > 0) {
          console.log('Retrieved accounts directly from Stripe:', accountsData.data.length)
          accounts = accountsData.data
        } else {
          console.error('Failed to retrieve accounts from Stripe:', accountsData)
        }
      }
    }
    
    if (accounts.length === 0) {
      // If no accounts but session exists, log the status
      console.error('No accounts found in session or Stripe. Session status:', session.status)
      // Don't fail immediately - check if status allows retry
      if (session.status === 'pending' || session.status === 'requires_action') {
        return new Response(
          JSON.stringify({ 
            error: 'Financial Connections session is still processing',
            details: `Session status: ${session.status}. Please wait a moment and try again.`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ 
          error: 'No accounts found in Financial Connections session',
          details: `Session status: ${session.status}. Your account can't be connected at this time. Please try again later.`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // If we have accounts, proceed even if status isn't 'succeeded' or 'active'
    // Some banks might complete the connection but status might be different
    if (session.status !== 'succeeded' && session.status !== 'active' && accounts.length > 0) {
      console.warn('Session status is not succeeded/active but has accounts. Status:', session.status, 'Accounts:', accounts.length)
      // Continue processing since we have accounts
    }

    // Accounts already extracted above, just log
    console.log('Processing accounts:', {
      count: accounts.length,
      account_ids: accounts.map((a: any) => a.id),
      account_types: accounts.map((a: any) => a.type)
    })

    // Use the first account (most common case)
    const account = accounts[0]
    console.log('Using account:', {
      account_id: account.id,
      account_type: account.type,
      account_display_name: account.display_name,
      account_status: account.status
    })
    
    // Get the payment method that was created from this account
    // Financial Connections automatically creates and attaches a payment method
    // We need to find it by looking at the customer's payment methods
    const customerId = session.account_holder?.customer
    
    if (!customerId) {
      console.error('Customer ID not found in session. Session structure:', {
        account_holder: session.account_holder,
        session_keys: Object.keys(session)
      })
      return new Response(
        JSON.stringify({ 
          error: 'Customer ID not found in session',
          details: 'Unable to retrieve customer information from Financial Connections session.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Customer ID from session:', customerId)

    // Get customer's payment methods to find the one created by Financial Connections
    // Try multiple times with a small delay to handle timing issues
    let paymentMethods: any = { data: [] }
    let paymentMethodsResponse: Response
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
      paymentMethodsResponse = await fetch(
        `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=us_bank_account`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      )

      paymentMethods = await paymentMethodsResponse.json()
      
      if (!paymentMethodsResponse.ok) {
        console.error('Failed to retrieve payment methods:', paymentMethods)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to retrieve payment methods',
            details: paymentMethods.error?.message || 'Unknown error'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log(`Payment methods retrieved (attempt ${retryCount + 1}):`, {
        count: paymentMethods.data?.length || 0,
        payment_method_ids: paymentMethods.data?.map((pm: any) => pm.id) || [],
        payment_methods: paymentMethods.data?.map((pm: any) => ({
          id: pm.id,
          type: pm.type,
          financial_connections_account: pm.us_bank_account?.financial_connections?.account
        })) || []
      })

      // If we found payment methods, break out of retry loop
      if (paymentMethods.data && paymentMethods.data.length > 0) {
        break
      }
      
      // If no payment methods found and we have retries left, wait longer with exponential backoff
      if (retryCount < maxRetries - 1) {
        const waitTime = 1000 * (retryCount + 1); // Exponential backoff: 1s, 2s, 3s
        console.log(`No payment methods found, retrying in ${waitTime}ms... (attempt ${retryCount + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
      
      retryCount++
    }

    // Find the payment method that matches this Financial Connections account
    // The payment method's us_bank_account.financial_connections should match the account
    const matchingPaymentMethod = paymentMethods.data?.find((pm: any) => {
      const fcAccount = pm.us_bank_account?.financial_connections?.account
      console.log('Checking payment method:', pm.id, 'FC account:', fcAccount, 'matches:', fcAccount === account.id)
      return fcAccount === account.id
    })

    let paymentMethod = matchingPaymentMethod || paymentMethods.data?.[0]
    
    console.log('Payment method selection:', {
      found_matching: !!matchingPaymentMethod,
      using_payment_method: paymentMethod?.id || 'none',
      account_id: account.id
    })
    
    // If no payment method exists, create one from the Financial Connections account
    // But first, check if a payment method already exists for this account by querying directly
    if (!paymentMethod) {
      console.log('No payment method found in initial query. Checking if payment method exists for this account...', {
        account_id: account.id,
        customer_id: customerId
      })
      
      // Try to find payment methods that reference this Financial Connections account
      // by querying all payment methods and filtering
      const allPaymentMethodsResponse = await fetch(
        `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=us_bank_account&limit=100`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      )
      
      const allPaymentMethods = await allPaymentMethodsResponse.json()
      
      if (allPaymentMethodsResponse.ok && allPaymentMethods.data) {
        const existingForAccount = allPaymentMethods.data.find((pm: any) => 
          pm.us_bank_account?.financial_connections?.account === account.id
        )
        
        if (existingForAccount) {
          console.log('Found existing payment method for this account:', existingForAccount.id)
          paymentMethod = existingForAccount
        }
      }
    }
    
    // If still no payment method exists, create one from the Financial Connections account
    if (!paymentMethod) {
      console.log('No payment method found. Creating payment method from Financial Connections account...', {
        account_id: account.id,
        customer_id: customerId
      })
      
      // Step 1: Create the payment method WITHOUT customer (Stripe doesn't allow attaching during creation)
      // Stripe requires billing_details[name] when creating from Financial Connections account
      const createPaymentMethodParams = new URLSearchParams()
      createPaymentMethodParams.append('type', 'us_bank_account')
      createPaymentMethodParams.append('us_bank_account[financial_connections_account]', account.id)
      createPaymentMethodParams.append('billing_details[name]', teenUser.full_name || 'Account Holder')
      
      console.log('Creating payment method with params:', {
        type: 'us_bank_account',
        financial_connections_account: account.id,
        billing_details_name: teenUser.full_name || 'Account Holder'
      })
      
      const createPaymentMethodResponse = await fetch(
        'https://api.stripe.com/v1/payment_methods',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: createPaymentMethodParams,
        }
      )
      
      const createdPaymentMethod = await createPaymentMethodResponse.json()
      
      console.log('Payment method creation response:', {
        ok: createPaymentMethodResponse.ok,
        status: createPaymentMethodResponse.status,
        has_error: !!createdPaymentMethod.error,
        error: createdPaymentMethod.error,
        payment_method_id: createdPaymentMethod.id
      })
      
      if (!createPaymentMethodResponse.ok) {
        console.error('Failed to create payment method from Financial Connections account:', createdPaymentMethod)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create payment method from Financial Connections account',
            details: createdPaymentMethod.error?.message || 'Unknown error',
            stripe_error: createdPaymentMethod.error,
            stripe_error_code: createdPaymentMethod.error?.code,
            stripe_error_type: createdPaymentMethod.error?.type
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Step 2: Attach the payment method to the customer
      console.log('Attaching payment method to customer:', {
        payment_method_id: createdPaymentMethod.id,
        customer_id: customerId
      })
      
      const attachParams = new URLSearchParams()
      attachParams.append('customer', customerId)
      
      const attachResponse = await fetch(
        `https://api.stripe.com/v1/payment_methods/${createdPaymentMethod.id}/attach`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: attachParams,
        }
      )
      
      const attachedPaymentMethod = await attachResponse.json()
      
      console.log('Payment method attachment response:', {
        ok: attachResponse.ok,
        status: attachResponse.status,
        has_error: !!attachedPaymentMethod.error,
        error: attachedPaymentMethod.error
      })
      
      if (!attachResponse.ok) {
        console.error('Failed to attach payment method to customer:', attachedPaymentMethod)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to attach payment method to customer',
            details: attachedPaymentMethod.error?.message || 'Unknown error',
            stripe_error: attachedPaymentMethod.error
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      paymentMethod = attachedPaymentMethod
      console.log('Successfully created and attached payment method from Financial Connections account:', paymentMethod.id)
      
      // After attaching, refresh the payment method to get the full us_bank_account details
      const refreshResponse = await fetch(
        `https://api.stripe.com/v1/payment_methods/${paymentMethod.id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      )
      
      const refreshedPaymentMethod = await refreshResponse.json()
      if (refreshResponse.ok && refreshedPaymentMethod.us_bank_account) {
        paymentMethod = refreshedPaymentMethod
        console.log('Refreshed payment method with full details')
      }
    } else {
      console.log('Using existing payment method:', paymentMethod.id)
    }

    const usBankAccount = paymentMethod.us_bank_account

    if (!usBankAccount) {
      console.error('Payment method does not have us_bank_account data:', {
        payment_method_id: paymentMethod.id,
        payment_method_type: paymentMethod.type,
        payment_method_keys: Object.keys(paymentMethod)
      })
      return new Response(
        JSON.stringify({ 
          error: 'Payment method does not have bank account information',
          details: 'The payment method created from Financial Connections does not contain bank account details.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract bank account details
    const accountNumberLast4 = usBankAccount.last4 || '****'
    const routingNumber = usBankAccount.routing_number || '****'
    const routingNumberLast4 = routingNumber.slice(-4)
    const bankName = usBankAccount.bank_name || account.display_name || 'Unknown Bank'
    const accountType = usBankAccount.account_type || 'checking'
    const accountHolderName = usBankAccount.account_holder_name || teenUser.full_name || ''

    // Check verification status
    // Financial Connections accounts are verified instantly - they don't need micro-deposits
    // The us_bank_account.status might be 'new' initially, but Financial Connections accounts are pre-verified
    // Always set to 'verified' for Financial Connections accounts
    const verificationStatus = 'verified'
    const verifiedAt = new Date().toISOString()
    
    console.log('Setting verification status for Financial Connections account:', {
      verification_status: verificationStatus,
      us_bank_account_status: usBankAccount.status,
      account_id: account.id
    })

    // Check if bank account already exists for this user
    const { data: existingAccount } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', teenUser.id)
      .eq('stripe_external_account_id', paymentMethod.id)
      .maybeSingle()

    let savedAccount
    if (existingAccount) {
      // Update existing account
      const { data: updated, error: updateError } = await supabase
        .from('bank_accounts')
        .update({
          stripe_customer_id: customerId,
          verification_status: verificationStatus,
          verified_at: verifiedAt,
          bank_name: bankName,
          account_type: accountType,
          account_holder_name: accountHolderName,
          routing_number: routingNumber,
          routing_number_last4: routingNumberLast4,
          account_number_last4: accountNumberLast4,
          verification_method: 'financial_connections',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAccount.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating bank account:', updateError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to update bank account',
            details: updateError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      savedAccount = updated
      console.log('Updated existing bank account:', savedAccount.id)
    } else {
      // Create new bank account
      // First, mark any existing bank accounts as not default
      await supabase
        .from('bank_accounts')
        .update({ is_default: false })
        .eq('user_id', teenUser.id)

      const { data: created, error: createError } = await supabase
        .from('bank_accounts')
        .insert({
          user_id: teenUser.id,
          stripe_external_account_id: paymentMethod.id,
          stripe_customer_id: customerId,
          account_type: accountType,
          account_holder_name: accountHolderName,
          bank_name: bankName,
          routing_number: routingNumber,
          routing_number_last4: routingNumberLast4,
          account_number_last4: accountNumberLast4,
          verification_status: verificationStatus,
          verification_method: 'financial_connections',
          is_default: true,
          verified_at: verifiedAt,
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating bank account:', createError)
        return new Response(
          JSON.stringify({ 
            error: 'Failed to create bank account',
            details: createError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      savedAccount = created
      console.log('Created new bank account:', savedAccount.id)
    }

    // If approval_token was provided, mark the approval as completed
    if (approval_token) {
      const { error: approvalError } = await supabase
        .from('bank_account_approvals')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('setup_token', approval_token)
        .eq('teen_id', teenUser.id)

      if (approvalError) {
        console.warn('Failed to update approval status:', approvalError)
        // Don't fail the whole operation if approval update fails
      }
    }

    console.log('Bank account saved successfully:', {
      user_id: teenUser.id,
      bank_account_id: savedAccount.id,
      verification_status: verificationStatus,
      payment_method_id: paymentMethod.id,
      stripe_customer_id: customerId,
      bank_name: bankName,
      account_type: accountType,
    })

    // Verify the account was actually saved by querying it back
    const { data: verifyAccount, error: verifyError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', savedAccount.id)
      .single()

    if (verifyError || !verifyAccount) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:603',message:'Bank account verification failed',data:{verifyError:verifyError?.message,has_verifyAccount:!!verifyAccount,savedAccount_id:savedAccount?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('WARNING: Bank account save verification failed:', verifyError)
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:606',message:'Bank account verified in database',data:{verifyAccount_id:verifyAccount.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log('Bank account verified in database:', verifyAccount.id)
    }

    const successResponse = {
      success: true,
      bank_account: {
        id: savedAccount.id,
        verification_status: savedAccount.verification_status,
        bank_name: savedAccount.bank_name,
        account_type: savedAccount.account_type,
        account_number_last4: savedAccount.account_number_last4,
        verified_at: savedAccount.verified_at,
      },
      payment_method_id: paymentMethod.id,
      customer_id: customerId,
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:609',message:'Returning success response',data:{success:successResponse.success,bank_account_id:successResponse.bank_account.id,payment_method_id:successResponse.payment_method_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    return new Response(
      JSON.stringify(successResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:626',message:'Caught exception',data:{error_message:error?.message,error_name:error?.name,error_type:error?.constructor?.name,has_stack:!!error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    console.error('Error in save-financial-connections-account:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      type: error?.constructor?.name
    })
    const errorResponse = { 
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
      error_type: error?.constructor?.name
    };
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'save-financial-connections-account/index.ts:633',message:'Returning error response',data:{error:errorResponse.error,status:500},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})




