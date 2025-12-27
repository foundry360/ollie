-- Manual fix for user_id mismatches
-- This will correct the application's user_id and create the profile if it doesn't exist

-- Step 1: Update all applications where user_id doesn't match the auth user's ID
UPDATE public.pending_neighbor_applications pna
SET user_id = au.id
FROM auth.users au
WHERE pna.email = au.email
  AND pna.user_id != au.id
  AND pna.status = 'approved';

-- Step 2: Delete profiles with wrong IDs (where email matches but id doesn't match auth user)
DELETE FROM public.users pu
WHERE EXISTS (
  SELECT 1 
  FROM auth.users au 
  WHERE au.email = pu.email 
    AND au.id != pu.id
)
AND EXISTS (
  SELECT 1 
  FROM public.pending_neighbor_applications pna 
  WHERE pna.email = pu.email 
    AND pna.status = 'approved'
);

-- Step 3: Create profiles for approved applications that don't have one
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
SELECT 
  pna.user_id,
  pna.email,
  pna.full_name,
  'poster',
  pna.phone,
  pna.address,
  pna.date_of_birth,
  true,
  NOW()
FROM public.pending_neighbor_applications pna
WHERE pna.status = 'approved'
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = pna.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = pna.user_id)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  phone = COALESCE(EXCLUDED.phone, users.phone),
  address = COALESCE(EXCLUDED.address, users.address),
  date_of_birth = COALESCE(EXCLUDED.date_of_birth, users.date_of_birth),
  verified = true,
  updated_at = NOW();

-- Step 4: Verify the fix
SELECT 
  pna.id as application_id,
  pna.user_id as application_user_id,
  pna.email,
  au.id as auth_user_id,
  pu.id as public_user_id,
  CASE 
    WHEN pna.user_id = au.id AND au.id = pu.id THEN '✅ ALL MATCH'
    WHEN pna.user_id != au.id THEN '❌ Application user_id mismatch'
    WHEN au.id != pu.id THEN '❌ Profile user_id mismatch'
    WHEN pu.id IS NULL THEN '❌ Profile missing'
    ELSE '❌ Unknown issue'
  END as status
FROM public.pending_neighbor_applications pna
LEFT JOIN auth.users au ON pna.email = au.email
LEFT JOIN public.users pu ON pna.user_id = pu.id
WHERE pna.status = 'approved'
ORDER BY pna.created_at DESC
LIMIT 20;

