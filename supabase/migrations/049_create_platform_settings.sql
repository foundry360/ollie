-- Create platform_settings table for storing platform configuration
-- This table stores settings like platform fee percentage, feature flags, etc.

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_key ON public.platform_settings(key);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default platform settings
INSERT INTO public.platform_settings (key, value, description)
VALUES
  ('platform_fee_percentage', '0.10', 'Platform fee percentage as decimal (0.10 = 10%)'),
  ('stripe_connect_enabled', 'true', 'Whether Stripe Connect is enabled for the platform')
ON CONFLICT (key) DO NOTHING;




