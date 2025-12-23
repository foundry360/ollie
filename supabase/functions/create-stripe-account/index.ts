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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseServiceKey 
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing Supabase credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
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

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, email, full_name')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only teens can create Stripe accounts
    if (profile.role !== 'teen') {
      return new Response(
        JSON.stringify({ error: 'Only teenlancers can create Stripe accounts' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if parent approval is required and obtained
    const { data: userProfile } = await supabase
      .from('users')
      .select('date_of_birth, parent_id')
      .eq('id', user.id)
      .single()

    if (userProfile?.parent_id) {
      // Check if user is under 18
      let needsApproval = false
      if (userProfile.date_of_birth) {
        const birthDate = new Date(userProfile.date_of_birth)
        const today = new Date()
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--
        }
        needsApproval = age < 18
      } else {
        // If no birthdate, assume approval needed (better safe than sorry)
        needsApproval = true
      }

      if (needsApproval) {
        // Check for approval status
        const { data: approval } = await supabase
          .from('stripe_account_approvals')
          .select('status')
          .eq('teen_id', user.id)
          .single()

        if (!approval || approval.status !== 'approved') {
          return new Response(
            JSON.stringify({ 
              error: 'Parent approval required',
              code: 'PARENT_APPROVAL_REQUIRED',
              approval_status: approval?.status || 'pending'
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Check if account already exists
    let { data: existingAccount } = await supabase
      .from('stripe_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existingAccount) {
      // Return existing account info
      const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
      if (!stripeSecretKey) {
        return new Response(
          JSON.stringify({ error: 'Stripe not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // First, refresh account status from Stripe to ensure we have latest info
      const accountRefreshResponse = await fetch(
        `https://api.stripe.com/v1/accounts/${existingAccount.stripe_account_id}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
          },
        }
      )

      if (accountRefreshResponse.ok) {
        const stripeAccountData = await accountRefreshResponse.json()
        
        // Determine current onboarding status
        let onboardingStatus: 'pending' | 'in_progress' | 'complete' | 'failed' = 'pending'
        if (stripeAccountData.details_submitted) {
          if (stripeAccountData.charges_enabled && stripeAccountData.payouts_enabled) {
            onboardingStatus = 'complete'
          } else {
            onboardingStatus = 'in_progress'
          }
        }

        // Update database with latest status
        const { data: updatedAccount } = await supabase
          .from('stripe_accounts')
          .update({
            onboarding_status: onboardingStatus,
            charges_enabled: stripeAccountData.charges_enabled || false,
            payouts_enabled: stripeAccountData.payouts_enabled || false,
            email: stripeAccountData.email || existingAccount.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAccount.id)
          .select()
          .single()

        if (updatedAccount) {
          existingAccount = updatedAccount
        }
      }

      // Get account link if onboarding is not complete
      if (existingAccount.onboarding_status !== 'complete') {
        const accountLinkResponse = await fetch('https://api.stripe.com/v1/account_links', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            account: existingAccount.stripe_account_id,
            // For mobile apps, these URLs are placeholders - the app will check status when user returns
            refresh_url: Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') || 'https://olliejobs.com/payment-setup',
            return_url: Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') || 'https://olliejobs.com/payment-setup',
            type: 'account_onboarding',
          }),
        })

        const accountLink = await accountLinkResponse.json()

        if (!accountLinkResponse.ok) {
          console.error('Stripe account link creation error:', accountLink)
          return new Response(
            JSON.stringify({ error: 'Failed to create account link', details: accountLink }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(
          JSON.stringify({
            account: existingAccount,
            onboarding_url: accountLink.url,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ account: existingAccount }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Create Stripe Connect account
    const accountParams = new URLSearchParams()
    accountParams.append('type', 'express')
    accountParams.append('country', 'US') // Default to US, can be made configurable
    accountParams.append('email', profile.email)
    accountParams.append('capabilities[card_payments][requested]', 'true')
    accountParams.append('capabilities[transfers][requested]', 'true')

    const accountResponse = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: accountParams,
    })

    const account = await accountResponse.json()

    if (!accountResponse.ok) {
      console.error('Stripe account creation error:', account)
      return new Response(
        JSON.stringify({ error: 'Failed to create Stripe account', details: account }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create account link for onboarding
    const accountLinkResponse = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        account: account.id,
        // For mobile apps, these URLs are placeholders - the app will check status when user returns
        refresh_url: Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') || 'https://olliejobs.com/payment-setup',
        return_url: Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') || 'https://olliejobs.com/payment-setup',
        type: 'account_onboarding',
      }),
    })

    const accountLink = await accountLinkResponse.json()

    if (!accountLinkResponse.ok) {
      console.error('Stripe account link creation error:', accountLink)
      return new Response(
        JSON.stringify({ error: 'Failed to create account link', details: accountLink }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Store account in database
    const { data: stripeAccount, error: dbError } = await supabase
      .from('stripe_accounts')
      .insert({
        user_id: user.id,
        stripe_account_id: account.id,
        onboarding_status: 'in_progress',
        charges_enabled: account.capabilities?.card_payments === 'active',
        payouts_enabled: account.capabilities?.transfers === 'active',
        email: profile.email,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return new Response(
        JSON.stringify({ error: 'Failed to save account to database', details: dbError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        account: stripeAccount,
        onboarding_url: accountLink.url,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in create-stripe-account function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

