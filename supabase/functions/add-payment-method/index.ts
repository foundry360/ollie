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
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    const { payment_method_id, is_default } = await req.json()

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
    const { data: existingPm } = await supabase
      .from('payment_methods')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (existingPm?.stripe_customer_id) {
      customerId = existingPm.stripe_customer_id
    } else {
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
      if (customerResponse.ok) {
        customerId = customer.id
      }
    }

    // Attach payment method to customer
    if (customerId) {
      await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}/attach`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          customer: customerId,
        }),
      })
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
    const { data: existing } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('stripe_payment_method_id', payment_method_id)
      .single()

    let savedPm
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('payment_methods')
        .update(pmData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      savedPm = data
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('payment_methods')
        .insert(pmData)
        .select()
        .single()

      if (error) throw error
      savedPm = data
    }

    return new Response(
      JSON.stringify({ payment_method: savedPm }),
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

