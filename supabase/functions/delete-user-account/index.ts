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
    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify the authenticated user by extracting token from header
    const token = authHeader.replace('Bearer ', '')
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !authUser) {
      console.error('Error verifying user:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userIdToDelete = authUser.id

    console.log('🗑️ [delete-user-account] Deleting account for user:', userIdToDelete)

    // Step 1: Delete the user profile from public.users
    // This will cascade delete related data due to ON DELETE CASCADE constraints
    const { error: profileDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userIdToDelete)

    if (profileDeleteError) {
      console.error('Error deleting user profile:', profileDeleteError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user profile',
          details: profileDeleteError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ [delete-user-account] User profile deleted successfully')

    // Step 2: Delete the auth account from auth.users
    // This requires admin privileges (service role)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userIdToDelete)

    if (authDeleteError) {
      console.error('Error deleting auth account:', authDeleteError)
      // Profile is already deleted, but auth account deletion failed
      return new Response(
        JSON.stringify({ 
          success: true,
          warning: 'User profile deleted, but auth account deletion failed. Please contact support.',
          details: authDeleteError.message 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ [delete-user-account] Auth account deleted successfully')

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Account deleted successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    console.error('Error in delete-user-account function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error?.stack || error?.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

