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
    const { payment_method_id } = await req.json()

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

    // Verify the payment method belongs to this user
    const { data: paymentMethod, error: pmError } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id')
      .eq('user_id', user.id)
      .eq('stripe_payment_method_id', payment_method_id)
      .single()

    if (pmError || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Payment method not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Detach payment method from customer in Stripe
    const detachResponse = await fetch(`https://api.stripe.com/v1/payment_methods/${payment_method_id}/detach`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
      },
    })

    const detachResult = await detachResponse.json()

    if (!detachResponse.ok) {
      // Log error but continue with database deletion
      console.error('Error detaching payment method from Stripe:', detachResult)
      // Don't fail if it's already detached or doesn't exist
      if (detachResult.error?.code !== 'resource_missing') {
        return new Response(
          JSON.stringify({ error: 'Failed to remove payment method from Stripe', details: detachResult }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('payment_methods')
      .delete()
      .eq('user_id', user.id)
      .eq('stripe_payment_method_id', payment_method_id)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Failed to delete payment method', details: deleteError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error removing payment method:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})


