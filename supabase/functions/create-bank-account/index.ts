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
        // Search Stripe for existing customer with this email
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
          customerParams.append('metadata[user_id]', user.id)
          customerParams.append('metadata[role]', 'teen')

          const customerResponse = await fetch('https://api.stripe.com/v1/customers', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Idempotency-Key': user.id, // Use user ID as idempotency key
            },
            body: customerParams,
          })

          const customer = await customerResponse.json()
          if (customerResponse.ok) {
            customerId = customer.id
            console.log('Created new Stripe customer:', customerId)
          } else {
            console.error('Failed to create Stripe customer:', customer)
            return new Response(
              JSON.stringify({ error: 'Failed to create Stripe customer', details: customer }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
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

    // Create Stripe External Account (bank account)
    // Note: For ACH payouts, we create a bank account on the customer
    const bankAccountParams = new URLSearchParams()
    bankAccountParams.append('object', 'bank_account')
    bankAccountParams.append('account_number', account_number)
    bankAccountParams.append('routing_number', routing_number)
    bankAccountParams.append('account_holder_name', account_holder_name)
    bankAccountParams.append('account_holder_type', 'individual')
    bankAccountParams.append('country', 'US')
    bankAccountParams.append('currency', 'usd')
    bankAccountParams.append('metadata[user_id]', user.id)
    bankAccountParams.append('metadata[account_type]', account_type)

    const bankAccountResponse = await fetch(`https://api.stripe.com/v1/customers/${customerId}/sources`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bankAccountParams,
    })

    const bankAccount = await bankAccountResponse.json()

    if (!bankAccountResponse.ok) {
      console.error('Failed to create Stripe bank account:', bankAccount)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create bank account',
          details: bankAccount.error?.message || bankAccount.error || 'Unknown error'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Extract external account ID
    // Stripe returns bank accounts with ID like ba_xxxxx
    const externalAccountId = bankAccount.id

    // Extract account details for storage (only last 4 digits for security)
    const accountNumberLast4 = account_number.slice(-4)
    const routingNumberLast4 = routing_number.slice(-4)
    const bankName = bankAccount.bank_name || null

    // Determine verification status
    // Stripe returns status: 'new', 'validated', 'verified', 'verification_failed', 'errored'
    let verificationStatus = 'pending'
    if (bankAccount.status === 'verified') {
      verificationStatus = 'verified'
    } else if (bankAccount.status === 'verification_failed' || bankAccount.status === 'errored') {
      verificationStatus = 'failed'
    } else {
      verificationStatus = 'pending' // 'new' or 'validated' - needs micro-deposits
    }

    // Store bank account in database
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
      
      // Attempt to delete the Stripe bank account to clean up
      try {
        await fetch(`https://api.stripe.com/v1/customers/${customerId}/sources/${externalAccountId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        })
      } catch (cleanupError) {
        console.error('Failed to cleanup Stripe bank account:', cleanupError)
      }

      return new Response(
        JSON.stringify({ error: 'Failed to save bank account', details: saveError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank account created successfully:', {
      user_id: user.id,
      external_account_id: externalAccountId,
      verification_status: verificationStatus,
      stripe_status: bankAccount.status,
    })

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
    console.error('Error in create-bank-account function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error',
        details: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


