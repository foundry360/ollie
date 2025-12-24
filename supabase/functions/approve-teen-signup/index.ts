import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req: Request) => {
  // Log that function was called
  console.log('🚀 [approve-teen-signup] Function called', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  })

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ [approve-teen-signup] Handling OPTIONS request')
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    console.log('📥 [approve-teen-signup] Processing request')
    // Parse request body
    let body
    try {
      body = await req.json()
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { token, action } = body
    
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Approval token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return new Response(
        JSON.stringify({ error: 'Action must be "approve" or "reject"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      })
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use service role client to bypass RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Get pending signup by token
    const { data: pendingSignup, error: fetchError } = await supabaseAdmin
      .from('pending_teen_signups')
      .select('*')
      .eq('approval_token', token)
      .single()

    if (fetchError) {
      console.error('Error fetching pending signup:', fetchError)
      // Check if it's a "not found" error
      if (fetchError.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired approval token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch pending signup', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!pendingSignup) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired approval token' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if already processed
    if (pendingSignup.status !== 'pending') {
      return new Response(
        JSON.stringify({ 
          error: `This signup has already been ${pendingSignup.status}`,
          status: pendingSignup.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token is expired
    if (new Date(pendingSignup.token_expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('pending_teen_signups')
        .update({ status: 'expired' })
        .eq('id', pendingSignup.id)

      return new Response(
        JSON.stringify({ error: 'Approval token has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update status based on action
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const updateData: any = {
      status: newStatus
    }

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString()
    }

    const { error: updateError } = await supabaseAdmin
      .from('pending_teen_signups')
      .update(updateData)
      .eq('id', pendingSignup.id)

    if (updateError) {
      console.error('Error updating pending signup:', updateError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to update signup status',
          details: updateError.message,
          code: updateError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        status: newStatus,
        pendingSignup: {
          id: pendingSignup.id,
          full_name: pendingSignup.full_name,
          parent_email: pendingSignup.parent_email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    console.error('Error in approve-teen-signup function:', error)
    console.error('Error stack:', error?.stack)
    console.error('Error name:', error?.name)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error?.stack || error?.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

