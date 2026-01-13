-- Check the actual function code to see what it contains

-- Get the full function definition
SELECT 
  pg_get_functiondef(oid) as function_code
FROM pg_proc 
WHERE proname = 'notify_gig_completed'
LIMIT 1;

-- Check for key variables and patterns
SELECT 
  'Variable Check' as check_type,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%v_neighbor_recipient_id%' THEN 'Has v_neighbor_recipient_id ✓'
    ELSE 'Missing v_neighbor_recipient_id ✗'
  END as neighbor_var,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%v_teen_recipient_id%' THEN 'Has v_teen_recipient_id ✓'
    ELSE 'Missing v_teen_recipient_id ✗'
  END as teen_var,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%Payment pending%' THEN 'Has Payment pending text ✓'
    ELSE 'Missing Payment pending text ✗'
  END as has_payment_text,
  CASE 
    WHEN pg_get_functiondef(oid) LIKE '%You completed%' THEN 'Has You completed text ✓'
    ELSE 'Missing You completed text ✗'
  END as has_you_completed_text
FROM pg_proc 
WHERE proname = 'notify_gig_completed';




















