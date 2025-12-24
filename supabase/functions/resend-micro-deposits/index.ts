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
      .select('id, role')
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
        JSON.stringify({ error: 'Only teens can resend micro-deposits' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's bank account
    const { data: bankAccount, error: accountError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (accountError || !bankAccount) {
      return new Response(
        JSON.stringify({ error: 'Bank account not found. Please add a bank account first.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only allow resend if verification is pending or failed
    if (bankAccount.verification_status === 'verified') {
      return new Response(
        JSON.stringify({ 
          error: 'Bank account is already verified. No need to resend deposits.',
          verification_status: 'verified'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (bankAccount.verification_status !== 'pending' && bankAccount.verification_status !== 'failed') {
      return new Response(
        JSON.stringify({ 
          error: 'Cannot resend deposits for this bank account status',
          verification_status: bankAccount.verification_status
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Get the Stripe customer ID
    let stripeCustomerId = bankAccount.stripe_customer_id

    // If no customer ID, get or create one
    if (!stripeCustomerId) {
      // Try to find existing customer by email
      const customerSearchResponse = await fetch(
        `https://api.stripe.com/v1/customers/search?query=email:'${user.email}'&limit=1`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      )

      const customerSearchResult = await customerSearchResponse.json()

      if (customerSearchResponse.ok && customerSearchResult.data && customerSearchResult.data.length > 0) {
        stripeCustomerId = customerSearchResult.data[0].id
      } else {
        // Create new Stripe customer
        const createCustomerResponse = await fetch(
          'https://api.stripe.com/v1/customers',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              email: user.email || '',
              metadata: JSON.stringify({
                user_id: user.id,
                platform: 'ollie',
              }),
            }),
          }
        )

        const customer = await createCustomerResponse.json()
        if (!createCustomerResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to create Stripe customer', details: customer.error?.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        stripeCustomerId = customer.id
      }
    }

    // Delete the old external account from Stripe
    const deleteResponse = await fetch(
      `https://api.stripe.com/v1/customers/${stripeCustomerId}/sources/${bankAccount.stripe_external_account_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
        },
      }
    )

    if (!deleteResponse.ok) {
      const deleteError = await deleteResponse.json()
      // If account doesn't exist in Stripe, that's okay - continue to delete from our DB
      if (deleteError.error?.code !== 'resource_missing') {
        console.error('Failed to delete old Stripe external account:', deleteError)
        // Still try to delete from our database
      }
    }

    // Delete the bank account record from our database
    const { error: deleteDbError } = await supabase
      .from('bank_accounts')
      .delete()
      .eq('id', bankAccount.id)

    if (deleteDbError) {
      console.error('Failed to delete bank account from database:', deleteDbError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete bank account. Please try again.',
          details: deleteDbError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Bank account deleted successfully for micro-deposit resend:', {
      user_id: user.id,
      bank_account_id: bankAccount.id,
    })

    // Return success - user can now add their bank account again which will trigger new micro-deposits
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Your bank account has been removed. You can now add it again with the same details to receive new verification deposits.',
        deleted: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in resend-micro-deposits function:', error)
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

