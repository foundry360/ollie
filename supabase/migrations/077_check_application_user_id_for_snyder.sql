-- Check the application's user_id for snyderlacrosse@gmail.com
-- This will help us see if the application has the wrong user_id

SELECT 
  pna.id as application_id,
  pna.user_id as application_user_id,
  pna.email as application_email,
  pna.status,
  au.id as auth_user_id,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NULL THEN 'No auth user found with this email'
    WHEN pna.user_id = au.id THEN 'MATCH - user_id is correct'
    ELSE 'MISMATCH - user_id is wrong'
  END as match_status,
  CASE 
    WHEN pna.user_id = au.id THEN 'OK'
    ELSE 'NEEDS FIX: Update application.user_id to ' || au.id::text
  END as action_needed
FROM public.pending_neighbor_applications pna
LEFT JOIN auth.users au ON pna.email = au.email
WHERE pna.email = 'snyderlacrosse@gmail.com';

-- Also check if there's a profile with the wrong ID
SELECT 
  pu.id as public_user_id,
  pu.email as public_user_email,
  au.id as auth_user_id,
  au.email as auth_email,
  CASE 
    WHEN pu.id = au.id THEN 'MATCH'
    ELSE 'MISMATCH'
  END as match_status
FROM public.users pu
LEFT JOIN auth.users au ON pu.email = au.email
WHERE pu.email = 'snyderlacrosse@gmail.com' OR au.email = 'snyderlacrosse@gmail.com';

