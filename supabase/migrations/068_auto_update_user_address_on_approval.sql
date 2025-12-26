-- Trigger to automatically update user profile address and phone when neighbor application is approved
-- This ensures the address and phone from the application are automatically copied to the user profile

CREATE OR REPLACE FUNCTION update_user_address_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- When a neighbor application is approved, automatically update the user's address and phone
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- First, ensure the user profile exists (it might have been created during signup with only name/email)
    -- If it doesn't exist, create it. If it exists, update it with address and phone.
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
      NEW.user_id,
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
    
    -- Log for debugging (can be removed in production)
    RAISE NOTICE 'Updated user % with address: %, phone: %', NEW.user_id, NEW.address, NEW.phone;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on pending_neighbor_applications table
DROP TRIGGER IF EXISTS on_neighbor_approval_update_address ON public.pending_neighbor_applications;

CREATE TRIGGER on_neighbor_approval_update_address
  AFTER UPDATE OF status ON public.pending_neighbor_applications
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND OLD.status != 'approved')
  EXECUTE FUNCTION update_user_address_on_approval();

-- Also update address and phone when they are added/updated on an approved application
CREATE OR REPLACE FUNCTION update_user_address_on_address_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If application is already approved and address/phone is being updated, sync to user profile
  IF NEW.status = 'approved' THEN
    UPDATE public.users
    SET 
      address = COALESCE(NEW.address, address),
      phone = COALESCE(NEW.phone, phone),
      updated_at = NOW()
    WHERE id = NEW.user_id
      AND (
        (NEW.address IS NOT NULL AND NEW.address != COALESCE(OLD.address, '')) OR
        (NEW.phone IS NOT NULL AND NEW.phone != COALESCE(OLD.phone, ''))
      );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update address/phone when they change on approved applications
DROP TRIGGER IF EXISTS on_neighbor_address_change_update_user ON public.pending_neighbor_applications;

CREATE TRIGGER on_neighbor_address_change_update_user
  AFTER UPDATE OF address, phone ON public.pending_neighbor_applications
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND (
    (NEW.address IS NOT NULL AND NEW.address != COALESCE(OLD.address, '')) OR
    (NEW.phone IS NOT NULL AND NEW.phone != COALESCE(OLD.phone, ''))
  ))
  EXECUTE FUNCTION update_user_address_on_address_change();

