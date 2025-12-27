-- Simplify profile creation: when status changes to approved, find auth user by email and create/update public.users
-- This is the simplest possible approach

CREATE OR REPLACE FUNCTION update_user_address_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_user_id UUID;
  v_config RECORD;
  v_function_url TEXT;
  v_response_id BIGINT;
BEGIN
  -- When a neighbor application is approved, create/update the public.users profile
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Find the auth user by email (this is the source of truth)
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email = NEW.email
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_auth_user_id IS NULL THEN
      RAISE WARNING 'No auth user found for email: %. Cannot create profile.', NEW.email;
      RETURN NEW;
    END IF;
    
    -- Update the application's user_id to match the auth user
    IF NEW.user_id IS DISTINCT FROM v_auth_user_id THEN
      UPDATE public.pending_neighbor_applications
      SET user_id = v_auth_user_id
      WHERE id = NEW.id;
    END IF;
    
    -- Delete any existing profile with wrong ID (same email, different id)
    DELETE FROM public.users
    WHERE email = NEW.email AND id IS DISTINCT FROM v_auth_user_id;
    
    -- Create or update the profile with the correct auth user ID
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
      v_auth_user_id,  -- This MUST be the auth.users.id
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
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      phone = COALESCE(EXCLUDED.phone, users.phone),
      address = COALESCE(EXCLUDED.address, users.address),
      date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
      verified = true,
      updated_at = NOW();
    
    -- Send approval email via Edge Function
    BEGIN
      SELECT * INTO v_config FROM public.neighbor_approval_email_config WHERE id = 'default';
      
      IF v_config IS NULL OR v_config.supabase_url IS NULL OR v_config.supabase_url = '' THEN
        RAISE WARNING 'Email config not found or invalid. Email will not be sent.';
      ELSIF v_config.service_role_key IS NULL OR v_config.service_role_key = '' OR v_config.service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
        RAISE WARNING 'Service role key not configured. Email will not be sent.';
      ELSE
        v_function_url := v_config.supabase_url || '/functions/v1/send-neighbor-approval-email';
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
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send approval email: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

