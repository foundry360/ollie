import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

    // Get payment methods for user
    const { data: paymentMethods, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (pmError) {
      console.error('Error fetching payment methods:', pmError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch payment methods', details: pmError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch billing details from Stripe for each payment method
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (stripeSecretKey && paymentMethods && paymentMethods.length > 0) {
      const paymentMethodsWithBilling = await Promise.all(
        paymentMethods.map(async (pm: any) => {
          try {
            const pmResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${pm.stripe_payment_method_id}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${stripeSecretKey}`,
              },
            })

            if (pmResponse.ok) {
              const stripePm = await pmResponse.json()
              return {
                ...pm,
                billing_name: stripePm.billing_details?.name || null,
                billing_phone: stripePm.billing_details?.phone || null,
                billing_address_line1: stripePm.billing_details?.address?.line1 || null,
                billing_city: stripePm.billing_details?.address?.city || null,
                billing_state: stripePm.billing_details?.address?.state || null,
                billing_postal_code: stripePm.billing_details?.address?.postal_code || null,
              }
            }
          } catch (error) {
            console.error(`Error fetching billing details for ${pm.stripe_payment_method_id}:`, error)
          }
          return pm
        })
      )

      return new Response(
        JSON.stringify({ payment_methods: paymentMethodsWithBilling || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ payment_methods: paymentMethods || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in get-payment-methods function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})






