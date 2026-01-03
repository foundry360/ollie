-- Add OneSignal support
-- This migration adds a column to store OneSignal user IDs

-- Add OneSignal user ID column (or we can reuse expo_push_token)
-- For now, we'll add a separate column to track OneSignal registration
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS onesignal_user_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_onesignal_user_id ON public.users(onesignal_user_id)
WHERE onesignal_user_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.users.onesignal_user_id IS 'OneSignal user ID (player ID) for push notifications';

