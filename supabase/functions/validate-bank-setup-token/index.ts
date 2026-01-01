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
    let setup_token: string | null = null;

    // Handle both GET (query params) and POST (body) requests
    if (req.method === 'GET') {
      const url = new URL(req.url);
      setup_token = url.searchParams.get('token') || url.searchParams.get('setup_token');
    } else {
      // POST request - get from body
      const body = await req.json();
      setup_token = body.setup_token;
    }

    if (!setup_token) {
      console.log('Missing setup_token in request');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing setup_token',
          valid: false
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Validating setup_token:', setup_token.substring(0, 10) + '...');

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate setup token and get approval record
    console.log('Querying bank_account_approvals for setup_token');
    const { data: approval, error: approvalError } = await supabase
      .from('bank_account_approvals')
      .select('id, teen_id, status, token_expires_at, expires_at')
      .eq('setup_token', setup_token)
      .single()

    console.log('Query result:', { 
      hasApproval: !!approval, 
      hasError: !!approvalError,
      error: approvalError?.message,
      status: approval?.status 
    });

    if (approvalError || !approval) {
      console.log('Approval not found or error:', approvalError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid or expired setup token',
          valid: false,
          details: approvalError?.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token is expired
    const expirationDate = approval.token_expires_at || approval.expires_at
    if (expirationDate && new Date(expirationDate) < new Date()) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Setup token has expired',
          valid: false,
          expired: true
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already approved
    if (approval.status === 'approved') {
      return new Response(
        JSON.stringify({ 
          success: true,
          valid: true,
          approved: true,
          message: 'Bank account has already been set up'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get teen's name for display
    const { data: teenUser } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', approval.teen_id)
      .single()

    console.log('Token is valid, returning approval data:', {
      approval_id: approval.id,
      teen_id: approval.teen_id,
      status: approval.status,
      teen_name: teenUser?.full_name
    });

    // Return valid token with approval data
    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        approval: {
          id: approval.id,
          teen_id: approval.teen_id,
          status: approval.status,
        },
        teen_name: teenUser?.full_name || null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in validate-bank-setup-token function:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Unknown error',
        valid: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

