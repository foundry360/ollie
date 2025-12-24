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
    // Validate environment variables
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

    // Get authenticated user (teen completing signup)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get request body
    let body
    try {
      body = await req.json()
      console.log('📥 [create-parent-account] Request body received:', JSON.stringify(body))
      console.log('📥 [create-parent-account] Request body keys:', Object.keys(body || {}))
    } catch (parseError) {
      console.error('Error parsing request body:', parseError)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { parent_email, parent_phone, teen_name } = body
    
    console.log('📧 [create-parent-account] Extracted values:', {
      parent_email: parent_email || 'MISSING',
      parent_phone: parent_phone ?? 'MISSING', // Use ?? instead of || to catch null
      parent_phone_length: parent_phone?.length ?? 0,
      parent_phone_type: typeof parent_phone,
      parent_phone_is_null: parent_phone === null,
      parent_phone_is_undefined: parent_phone === undefined,
      teen_name: teen_name || 'MISSING',
      bodyKeys: Object.keys(body || {}),
      fullBody: JSON.stringify(body)
    })
    
    if (!parent_email) {
      console.error('❌ [create-parent-account] Parent email is missing. Body was:', body)
      return new Response(
        JSON.stringify({ 
          error: 'Parent email is required',
          receivedBody: body 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Normalize email and phone the same way - always save both
    const normalizedEmail = parent_email.trim().toLowerCase()
    // ALWAYS normalize phone - return trimmed string or null (never undefined)
    const normalizedPhone = (parent_phone !== undefined && parent_phone !== null && parent_phone.trim() !== '')
      ? parent_phone.trim()
      : null  // Always return null (never undefined) so we can always include it
    
    console.log('📞 Phone normalization result:', {
      original: parent_phone,
      normalized: normalizedPhone,
      originalType: typeof parent_phone,
      normalizedType: typeof normalizedPhone,
      willAlwaysSave: true  // We always save phone now
    })
    
    console.log('📧 Normalized values:', {
      email: normalizedEmail,
      phone: normalizedPhone,
      phoneLength: normalizedPhone?.length || 0
    })
    
    console.log('Creating/getting parent account for:', normalizedEmail)

    // Use service role client to create user with Admin API
    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Normalize email (already done above, but ensure it's set)
    // normalizedEmail is already set above
    
    // First check if parent profile already exists in users table (more efficient)
    const { data: existingProfile, error: profileCheckError } = await supabaseAdmin
      .from('users')
      .select('id, role')
      .eq('email', normalizedEmail)
      .eq('role', 'parent')
      .maybeSingle()

    let parentUserId: string

    if (existingProfile && !profileCheckError) {
      // Parent account already exists with correct role
      console.log('Parent profile already exists:', existingProfile.id)
      parentUserId = existingProfile.id
      
      // UPDATE: Always update email and phone for existing profiles too!
      const updateData: any = {
        role: 'parent',
        email: normalizedEmail,  // Always update email
        phone: normalizedPhone   // ALWAYS include phone
      }
      
      console.log('Updating existing parent profile:', {
        id: parentUserId,
        role: updateData.role,
        email: updateData.email,
        phone: updateData.phone,
        phoneLength: updateData.phone?.length || 0
      })
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', parentUserId)

      if (updateError) {
        console.error('❌ Error updating existing parent profile:', updateError)
        throw updateError
      }
      
      console.log('✅ Existing parent profile updated successfully')
      
      // Verify phone was saved
      const { data: verified } = await supabaseAdmin
        .from('users')
        .select('phone, email')
        .eq('id', parentUserId)
        .single()
      
      console.log('📞 Verification (existing profile):', {
        savedPhone: verified?.phone,
        expectedPhone: normalizedPhone,
        phoneMatch: verified?.phone === normalizedPhone,
        savedEmail: verified?.email,
        expectedEmail: normalizedEmail
      })
    } else {
      // Profile doesn't exist, try to create auth user
      // If user already exists, we'll find their ID
      console.log('Profile not found, attempting to create/get auth user')
      
      let userCreated = false
      
      // Try to create new parent auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          role: 'parent',
          is_provisional: true // Mark as provisional until parent sets password
        }
      })

      if (createError) {
        // Log the full error for debugging
        console.log('createUser error:', {
          message: createError.message,
          status: createError.status,
          name: createError.name,
          code: (createError as any).code
        })
        
        // Check if error is because user already exists
        // Supabase can return various error messages for existing users
        const errorMessage = createError.message?.toLowerCase() || ''
        const errorCode = (createError as any).code || ''
        const isUserExistsError = 
          errorMessage.includes('already registered') || 
          errorMessage.includes('already exists') ||
          errorMessage.includes('user already') ||
          errorMessage.includes('email address is already') ||
          errorCode === 'user_already_registered' ||
          createError.status === 422 // Unprocessable entity often means user exists
        
        if (isUserExistsError) {
          console.log('Auth user already exists, finding user ID')
          // User exists, we need to find their ID
          // First try to find in users table (might have different role)
          const { data: existingUserProfile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', normalizedEmail)
            .maybeSingle()
          
          if (existingUserProfile) {
            parentUserId = existingUserProfile.id
            console.log('Found existing user profile:', parentUserId)
          } else {
            // Profile doesn't exist, need to get user ID from auth
            // Use listUsers - this is a fallback but should work
            console.log('Profile not found, querying auth users')
            const { data: allUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()
            
            if (listError) {
              console.error('Error listing users:', listError)
              throw new Error(`Failed to find existing user: ${listError.message}`)
            }
            
            const foundUser = allUsers?.users.find((u: any) => u.email?.toLowerCase() === normalizedEmail)
            if (foundUser) {
              parentUserId = foundUser.id
              console.log('Found existing auth user:', parentUserId)
            } else {
              throw new Error('User exists but could not find user ID')
            }
          }
        } else {
          console.error('Error creating parent auth user:', createError)
          throw createError
        }
      } else if (newUser?.user) {
        // Successfully created new user
        parentUserId = newUser.user.id
        userCreated = true
        console.log('Created new parent auth user:', parentUserId)
      } else {
        throw new Error('Failed to create parent auth user - no user returned')
      }

      // Ensure we have a parentUserId at this point
      if (!parentUserId) {
        throw new Error('Failed to determine parent user ID')
      }

      // Now check if profile exists and create/update as needed
      const { data: existingUserProfile, error: profileCheckError2 } = await supabaseAdmin
        .from('users')
        .select('id, role, phone')
        .eq('id', parentUserId)
        .maybeSingle()

      if (profileCheckError2 && profileCheckError2.code !== 'PGRST116') {
        console.error('Error checking profile:', profileCheckError2)
        throw profileCheckError2
      }

      if (existingUserProfile) {
        // Profile exists - update role, email, and phone (ALWAYS include phone, no conditions)
        const updateData: any = {
          role: 'parent',
          email: normalizedEmail,  // Always update email
          phone: normalizedPhone  // ALWAYS include phone (normalizedPhone is always null or string, never undefined)
        }
        
        console.log('Updating parent profile:', {
          role: updateData.role,
          email: updateData.email,
          phone: updateData.phone,
          phoneLength: updateData.phone?.length || 0
        })
        
        const { error: updateError } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', parentUserId)

        if (updateError) {
          console.error('❌ Error updating parent profile:', updateError)
          throw updateError
        }
        
        console.log('✅ Parent profile updated successfully')
        
        // Verify phone was saved (same as we would verify email)
        const { data: verified } = await supabaseAdmin
          .from('users')
          .select('phone, email')
          .eq('id', parentUserId)
          .single()
        
        console.log('📞 Verification:', {
          savedPhone: verified?.phone,
          expectedPhone: normalizedPhone,
          phoneMatch: verified?.phone === normalizedPhone,
          savedEmail: verified?.email,
          expectedEmail: normalizedEmail
        })
      } else {
        // No profile exists, create it with email and phone (ALWAYS include phone, no conditions)
        const insertData: any = {
          id: parentUserId,
          email: normalizedEmail,  // Always include email
          full_name: teen_name ? `Parent of ${teen_name}` : 'Parent',
          role: 'parent',
          phone: normalizedPhone  // ALWAYS include phone (normalizedPhone is always null or string, never undefined)
        }
        
        console.log('Creating parent profile:', {
          id: parentUserId,
          email: insertData.email,
          phone: insertData.phone,
          phoneLength: insertData.phone?.length || 0,
          role: insertData.role
        })
        
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert(insertData)

        if (insertError) {
          console.error('Error creating parent profile:', insertError)
          // Try to clean up auth user if profile creation fails (only if we just created it)
          if (userCreated) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(parentUserId)
              console.log('Cleaned up auth user after profile creation failure')
            } catch (cleanupError) {
              console.error('Error cleaning up auth user:', cleanupError)
            }
          }
          throw insertError
        }
        console.log('Created parent profile successfully')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parent_id: parentUserId 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    console.error('Error in create-parent-account function:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: process.env.DENO_ENV === 'development' ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

