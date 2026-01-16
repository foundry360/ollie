-- Update platform fee percentage from 10% to 12%

UPDATE public.platform_settings
SET 
  value = '0.12',
  description = 'Platform fee percentage as decimal (0.12 = 12%)',
  updated_at = NOW()
WHERE key = 'platform_fee_percentage';

-- If the setting doesn't exist, create it
INSERT INTO public.platform_settings (key, value, description)
VALUES ('platform_fee_percentage', '0.12', 'Platform fee percentage as decimal (0.12 = 12%)')
ON CONFLICT (key) DO UPDATE
SET 
  value = '0.12',
  description = 'Platform fee percentage as decimal (0.12 = 12%)',
  updated_at = NOW();















