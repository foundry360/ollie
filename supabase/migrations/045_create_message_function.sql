-- Create database function to create messages (bypasses RLS)
-- This function uses SECURITY DEFINER to bypass RLS policies

CREATE OR REPLACE FUNCTION create_message(
  p_gig_id UUID,
  p_sender_id UUID,
  p_recipient_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id UUID;
  v_message JSONB;
BEGIN
  -- Insert message (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.messages (
    gig_id,
    sender_id,
    recipient_id,
    content,
    read
  )
  VALUES (
    p_gig_id,
    p_sender_id,
    p_recipient_id,
    p_content,
    false
  )
  RETURNING messages.id INTO v_message_id;

  -- Return the created message as JSONB
  SELECT to_jsonb(m.*) INTO v_message
  FROM public.messages m
  WHERE m.id = v_message_id;

  RETURN v_message;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_message(UUID, UUID, UUID, TEXT) TO authenticated;

