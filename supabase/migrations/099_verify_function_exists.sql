-- Migration: Verify notify_gig_completed function exists and trigger is attached
-- This will help us identify if the function/trigger setup is the issue

-- Check if function exists
DO $$
DECLARE
  v_func_exists BOOLEAN;
  v_trigger_exists BOOLEAN;
  v_func_source TEXT;
BEGIN
  -- Check if function exists
  SELECT EXISTS(
    SELECT 1 FROM pg_proc 
    WHERE proname = 'notify_gig_completed'
  ) INTO v_func_exists;
  
  -- Check if trigger exists
  SELECT EXISTS(
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_gig_completed_notify'
  ) INTO v_trigger_exists;
  
  -- Get function source if it exists
  IF v_func_exists THEN
    SELECT pg_get_functiondef(oid) INTO v_func_source
    FROM pg_proc
    WHERE proname = 'notify_gig_completed'
    LIMIT 1;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FUNCTION VERIFICATION';
  RAISE NOTICE 'Function exists: %', v_func_exists;
  RAISE NOTICE 'Trigger exists: %', v_trigger_exists;
  
  IF v_func_exists THEN
    RAISE NOTICE 'Function source length: % characters', LENGTH(v_func_source);
    IF v_func_source LIKE '%v_neighbor_recipient_id%' THEN
      RAISE NOTICE 'Function has v_neighbor_recipient_id variable: YES';
    ELSE
      RAISE NOTICE 'Function has v_neighbor_recipient_id variable: NO';
    END IF;
    IF v_func_source LIKE '%v_teen_recipient_id%' THEN
      RAISE NOTICE 'Function has v_teen_recipient_id variable: YES';
    ELSE
      RAISE NOTICE 'Function has v_teen_recipient_id variable: NO';
    END IF;
  ELSE
    RAISE WARNING 'FUNCTION DOES NOT EXIST!';
  END IF;
  
  IF NOT v_trigger_exists THEN
    RAISE WARNING 'TRIGGER DOES NOT EXIST!';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;






