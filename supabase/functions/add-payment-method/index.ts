import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  console.log('=== add-payment-method function called ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('Processing add-payment-method request')
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const requestBody = await req.json()
    const { payment_method_id, is_default } = requestBody

    if (!payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'Missing payment_method_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.id)
      .single()

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get payment method details from Stripe
    const pmResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })

    const paymentMethod = await pmResponse.json()

    if (!pmResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Invalid payment method', details: paymentMethod }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get or create Stripe customer
    let customerId = null
    
    // First, try to find existing customer in database
    console.log('Looking up customer for user:', user.id)
    const { data: existingPms } = await supabase
      .from('payment_methods')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)

    if (existingPms && existingPms.length > 0 && existingPms[0]?.stripe_customer_id) {
      const dbCustomerId = existingPms[0].stripe_customer_id
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
          customerId = null // Will search or create new one
        }
      } catch (verifyError) {
        console.error('Error verifying customer in Stripe:', verifyError)
        customerId = null
      }
    }
    
    // If no valid customer found, search Stripe by email
    if (!customerId) {
      const userEmail = profile?.email || user.email
      console.log('Searching Stripe for customer by email:', userEmail)
      
      if (userEmail) {
        try {
          const searchResponse = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(userEmail)}&limit=10`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
            },
          })
          
          if (searchResponse.ok) {
            const searchResult = await searchResponse.json().catch(() => ({ data: [] }))
            if (searchResult.data && Array.isArray(searchResult.data) && searchResult.data.length > 0) {
              // Prefer customer with matching user_id in metadata
              const foundCustomer = searchResult.data.find((c: any) => 
                c.metadata && c.metadata.user_id === user.id
              ) || searchResult.data[0]
              
              if (foundCustomer && foundCustomer.id) {
                customerId = foundCustomer.id
                console.log('Found existing customer in Stripe by email:', customerId)
              }
            }
          } else {
            const searchError = await searchResponse.json().catch(() => ({}))
            console.warn('Error searching Stripe for customer:', searchError)
          }
        } catch (searchError) {
          console.error('Exception while searching for customer in Stripe:', searchError)
        }
      }
    }
    
    // If still no customer, create a new one
    if (!customerId) {
      console.log('Creating new Stripe customer')
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

      const customer = await customerResponse.json().catch(() => ({}))
      if (customerResponse.ok && customer.id) {
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
    
    console.log('Final customer ID:', customerId)

    // Attach payment method to customer
    if (customerId) {
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
      if (!attachResponse.ok) {
        console.error('Failed to attach payment method to customer:', attachResult)
        return new Response(
          JSON.stringify({ error: 'Failed to attach payment method to Stripe customer', details: attachResult }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('Successfully attached payment method to customer:', payment_method_id, customerId)
    } else {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer ID available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if this is the first payment method for this user
    const { data: existingMethods } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
    
    // Set as default if this is the first payment method OR if explicitly requested
    const shouldBeDefault = existingMethods?.length === 0 || is_default
    
    // If setting as default, unset all other defaults for this user
    // (The database trigger also handles this, but we do it explicitly for clarity)
    if (shouldBeDefault) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('user_id', user.id)
        .eq('is_default', true)
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
    const { data: existingPmList } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('stripe_payment_method_id', payment_method_id)
      .limit(1)
    
    const existing = existingPmList && existingPmList.length > 0 ? existingPmList[0] : null

    let savedPm
    if (existing) {
      // Update existing
      console.log('Updating existing payment method:', existing.id, 'with data:', pmData)
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
      if (!data) {
        console.error('Update returned no data')
        throw new Error('Update returned no data')
      }
      savedPm = data
      console.log('Successfully updated payment method:', savedPm)
    } else {
      // Insert new
      console.log('Inserting new payment method with data:', JSON.stringify(pmData))
      const { data, error } = await supabase
        .from('payment_methods')
        .insert(pmData)
        .select()
        .single()

      if (error) {
        console.error('Error inserting payment method:', error)
        throw error
      }
      if (!data) {
        console.error('Insert returned no data')
        throw new Error('Insert returned no data')
      }
      savedPm = data
      console.log('Successfully inserted payment method:', savedPm)
    }

    // Verify the payment method was saved
    if (!savedPm || !savedPm.id) {
      console.error('Payment method was not saved correctly:', savedPm)
      throw new Error('Payment method was not saved correctly')
    }

    console.log('Returning response with payment_method:', savedPm.id)
    const responseBody = { payment_method: savedPm }
    console.log('Response body:', JSON.stringify(responseBody, null, 2))
    return new Response(
      JSON.stringify(responseBody),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in add-payment-method function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

