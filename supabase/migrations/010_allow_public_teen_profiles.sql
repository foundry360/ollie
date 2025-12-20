-- Allow public access to teen profiles for profile sharing/QR codes
-- This policy allows anyone (including unauthenticated users) to read teen profiles
CREATE POLICY "Anyone can read teen profiles" ON public.users
  FOR SELECT USING (role = 'teen');









