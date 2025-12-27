-- Diagnostic query to check user_id mismatches
-- Run this query to see the current state of user IDs

-- Check for mismatches between auth.users, pending_neighbor_applications, and public.users
-- Query 1: Check applications and their corresponding auth users
SELECT 
  pna.id as application_id,
  pna.user_id as application_user_id,
  pna.email as application_email,
  pna.status as application_status,
  au.id as auth_user_id,
  au.email as auth_email,
  CASE 
    WHEN au.id IS NULL THEN 'MISSING: No auth user found'
    WHEN pna.user_id = au.id THEN 'MATCH'
    ELSE 'MISMATCH: application.user_id != auth.id'
  END as auth_match_status
FROM public.pending_neighbor_applications pna
LEFT JOIN auth.users au ON pna.email = au.email
WHERE pna.status = 'approved'
ORDER BY pna.created_at DESC
LIMIT 20;

-- Query 2: Check applications and their corresponding public.users profiles
SELECT 
  pna.id as application_id,
  pna.user_id as application_user_id,
  pna.email as application_email,
  pna.status as application_status,
  pu.id as public_user_id,
  pu.email as public_user_email,
  CASE 
    WHEN pu.id IS NULL THEN 'MISSING: No public.users profile found'
    WHEN pna.user_id = pu.id THEN 'MATCH'
    ELSE 'MISMATCH: application.user_id != public.users.id'
  END as profile_match_status
FROM public.pending_neighbor_applications pna
LEFT JOIN public.users pu ON pna.user_id = pu.id
WHERE pna.status = 'approved'
ORDER BY pna.created_at DESC
LIMIT 20;

-- Query 3: Check auth.users and their corresponding public.users profiles
SELECT 
  au.id as auth_user_id,
  au.email as auth_email,
  pu.id as public_user_id,
  pu.email as public_user_email,
  CASE 
    WHEN pu.id IS NULL THEN 'MISSING: No public.users profile found'
    WHEN au.id = pu.id THEN 'MATCH'
    ELSE 'MISMATCH: auth.id != public.users.id'
  END as profile_match_status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL OR au.id != pu.id
ORDER BY au.created_at DESC
LIMIT 20;

-- Also check for applications where user_id doesn't exist in auth.users
SELECT 
  pna.id as application_id,
  pna.user_id as application_user_id,
  pna.email as application_email,
  pna.status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = pna.user_id) THEN 'EXISTS'
    ELSE 'MISSING'
  END as auth_user_exists,
  (SELECT id FROM auth.users WHERE email = pna.email ORDER BY created_at DESC LIMIT 1) as correct_auth_user_id
FROM public.pending_neighbor_applications pna
WHERE pna.status = 'approved'
  AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = pna.user_id)
ORDER BY pna.created_at DESC;

