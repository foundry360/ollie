-- Fix trigger to verify auth user exists before creating profile
-- This prevents foreign key constraint errors when application.user_id doesn't match auth.users.id

CREATE OR REPLACE FUNCTION update_user_address_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
  v_correct_user_id UUID;
  v_final_user_id UUID;
  v_auth_user_exists BOOLEAN;
  v_auth_user_email TEXT;
  v_auth_user_count INTEGER;
BEGIN
  -- When a neighbor application is approved, automatically update the user's address and phone
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    RAISE NOTICE '📧 [update_user_address_on_approval] Application % approved for user % (email: %)', NEW.id, NEW.user_id, NEW.email;
    
    -- Verify that the user_id exists in auth.users before creating the profile
    -- This prevents foreign key constraint errors
    v_final_user_id := NEW.user_id;
    
    -- Log all auth users with this email for debugging
    RAISE NOTICE '🔍 [update_user_address_on_approval] Checking user_id: %, email: %', NEW.user_id, NEW.email;
    
    -- Check if the user_id exists in auth.users AND matches the email
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = NEW.user_id) INTO v_auth_user_exists;
    SELECT email INTO v_auth_user_email FROM auth.users WHERE id = NEW.user_id;
    SELECT COUNT(*) INTO v_auth_user_count FROM auth.users WHERE email = NEW.email;
    
    RAISE NOTICE '🔍 [update_user_address_on_approval] Auth user check: exists=%, email=%, count with email=%', 
      v_auth_user_exists, v_auth_user_email, v_auth_user_count;
    
    -- Check if user_id exists AND matches the email (both must be true)
    IF NOT v_auth_user_exists OR (v_auth_user_exists AND v_auth_user_email != NEW.email) THEN
      IF NOT v_auth_user_exists THEN
        RAISE WARNING '❌ [update_user_address_on_approval] User % does not exist in auth.users. Cannot create profile.', NEW.user_id;
      ELSE
        RAISE WARNING '❌ [update_user_address_on_approval] User_id % exists but email mismatch! Application email: %, Auth user email: %', 
          NEW.user_id, NEW.email, v_auth_user_email;
      END IF;
      RAISE WARNING 'Application user_id: %, Email: %, Auth users with this email: %', NEW.user_id, NEW.email, v_auth_user_count;
      
      -- Try to find the correct auth user by email
      SELECT id INTO v_correct_user_id
      FROM auth.users
      WHERE email = NEW.email
      ORDER BY created_at DESC
      LIMIT 1;
      
      IF v_correct_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ [update_user_address_on_approval] Found auth user % for email %. Using correct user_id.', v_correct_user_id, NEW.email;
        -- Update the application with the correct user_id
        UPDATE public.pending_neighbor_applications
        SET user_id = v_correct_user_id
        WHERE id = NEW.id;
        
        -- Use the correct user_id for profile creation
        v_final_user_id := v_correct_user_id;
        RAISE NOTICE '✅ [update_user_address_on_approval] Updated application user_id from % to %', NEW.user_id, v_correct_user_id;
        
        -- Delete any existing profile with wrong ID (same email, different id)
        DELETE FROM public.users 
        WHERE email = NEW.email 
          AND id != v_correct_user_id;
        
        IF FOUND THEN
          RAISE NOTICE '✅ [update_user_address_on_approval] Deleted profile with wrong ID for email %', NEW.email;
        END IF;
      ELSE
        RAISE WARNING '❌ [update_user_address_on_approval] No auth user found for email %. Profile will not be created.', NEW.email;
        RETURN NEW; -- Don't create profile if auth user doesn't exist
      END IF;
    ELSE
      -- User_id exists, but check if email matches
      IF v_auth_user_email != NEW.email THEN
        RAISE WARNING '⚠️ [update_user_address_on_approval] Email mismatch! Application email: %, Auth user email: %. Finding correct user.', 
          NEW.email, v_auth_user_email;
        
        -- Find the correct auth user by email
        SELECT id INTO v_correct_user_id
        FROM auth.users
        WHERE email = NEW.email
        ORDER BY created_at DESC
        LIMIT 1;
        
        IF v_correct_user_id IS NOT NULL THEN
          RAISE NOTICE '✅ [update_user_address_on_approval] Found correct auth user % for email %.', v_correct_user_id, NEW.email;
          -- Update the application with the correct user_id
          UPDATE public.pending_neighbor_applications
          SET user_id = v_correct_user_id
          WHERE id = NEW.id;
          
          -- Use the correct user_id for profile creation
          v_final_user_id := v_correct_user_id;
          
          -- Delete any existing profile with wrong ID
          DELETE FROM public.users 
          WHERE email = NEW.email 
            AND id != v_correct_user_id;
          
          IF FOUND THEN
            RAISE NOTICE '✅ [update_user_address_on_approval] Deleted profile with wrong ID for email %', NEW.email;
          END IF;
        END IF;
      ELSE
        RAISE NOTICE '✅ [update_user_address_on_approval] User_id % exists in auth.users and email matches.', NEW.user_id;
      END IF;
    END IF;
  
    -- Check if profile already exists (it might have been created by ensure_user_profile_on_approval function)
    -- If it exists, just update it. If it doesn't exist, create it.
    DECLARE
      v_profile_exists BOOLEAN;
    BEGIN
      SELECT EXISTS(SELECT 1 FROM public.users WHERE id = v_final_user_id) INTO v_profile_exists;
      
      IF v_profile_exists THEN
        -- Profile already exists, just update it with address and phone
        RAISE NOTICE '✅ [update_user_address_on_approval] Profile exists, updating address and phone for user %', v_final_user_id;
        UPDATE public.users
        SET 
          phone = COALESCE(NEW.phone, users.phone),
          address = COALESCE(NEW.address, users.address),
          date_of_birth = COALESCE(NEW.date_of_birth, users.date_of_birth),
          verified = true,
          updated_at = NOW()
        WHERE id = v_final_user_id;
      ELSE
        -- Profile doesn't exist, create it
        RAISE NOTICE '✅ [update_user_address_on_approval] Profile does not exist, creating for user %', v_final_user_id;
        INSERT INTO public.users (
          id,
          email,
          full_name,
          role,
          phone,
          address,
          date_of_birth,
          verified,
          updated_at
        )
        VALUES (
          v_final_user_id,
          NEW.email,
          NEW.full_name,
          'poster',
          NEW.phone,
          NEW.address,
          NEW.date_of_birth,
          true,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          -- Always update these fields from the application
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          phone = COALESCE(EXCLUDED.phone, users.phone),
          address = COALESCE(EXCLUDED.address, users.address),
          date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
          verified = true,
          updated_at = NOW();
      END IF;
      
      -- Log for debugging
      RAISE NOTICE '✅ [update_user_address_on_approval] Updated user % with address: %, phone: %', v_final_user_id, NEW.address, NEW.phone;
    EXCEPTION
      WHEN OTHERS THEN
        -- If profile creation fails, log the error but don't block approval
        RAISE WARNING '❌ [update_user_address_on_approval] Failed to create/update profile for user %. Error: %', v_final_user_id, SQLERRM;
        RAISE WARNING 'Error details: Code: %, Message: %', SQLSTATE, SQLERRM;
    END;
    
    -- Send approval email via Edge Function
    BEGIN
      RAISE NOTICE '📧 [update_user_address_on_approval] Attempting to send email to: %', NEW.email;
      
      -- Get configuration from config table
      SELECT * INTO v_config FROM public.neighbor_approval_email_config WHERE id = 'default';
      
      -- If config is not found, log and return
      IF v_config IS NULL THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Neighbor approval email config not found. Email will not be sent.';
        RAISE WARNING 'Please insert a row into public.neighbor_approval_email_config with id=''default''';
        RETURN NEW;
      END IF;
      
      RAISE NOTICE '📧 [update_user_address_on_approval] Config found. URL: %, Key set: %', 
        v_config.supabase_url, 
        CASE WHEN v_config.service_role_key IS NOT NULL AND v_config.service_role_key != '' AND v_config.service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE' THEN 'YES' ELSE 'NO' END;
      
      -- Validate config values
      IF v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Supabase URL not configured in neighbor_approval_email_config. Email will not be sent.';
        RETURN NEW;
      END IF;
      
      IF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
        RAISE WARNING '❌ [update_user_address_on_approval] Service role key not configured in neighbor_approval_email_config. Email will not be sent.';
        RAISE WARNING 'Current key value: %', COALESCE(v_config.service_role_key, 'NULL');
        RETURN NEW;
      END IF;
      
      -- Construct Edge Function URL
      v_function_url := v_config.supabase_url || '/functions/v1/send-neighbor-approval-email';
      RAISE NOTICE '📧 [update_user_address_on_approval] Calling Edge Function: %', v_function_url;
      
      -- Call the Edge Function using pg_net (async, non-blocking)
      SELECT net.http_post(
        url := v_function_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_config.service_role_key,
          'apikey', v_config.service_role_key
        ),
        body := jsonb_build_object(
          'email', NEW.email,
          'fullName', NEW.full_name
        )
      ) INTO v_response_id;
      
      RAISE NOTICE '✅ [update_user_address_on_approval] Neighbor approval email queued for % (request ID: %)', NEW.email, v_response_id;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- If email sending fails, log error but don't block approval
        RAISE WARNING 'Failed to queue neighbor approval email for %. Error: %', NEW.email, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

