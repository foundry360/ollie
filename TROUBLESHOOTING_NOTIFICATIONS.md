# Troubleshooting Push Notifications

If notifications aren't working, follow these steps:

## Step 1: Verify Configuration

Run this query:

```sql
SELECT 
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL 
      AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
      AND LENGTH(service_role_key) > 20
    THEN '✓ Configured'
    ELSE '✗ Not configured'
  END as key_status
FROM public.push_notification_config
WHERE id = 'default';
```

**If not configured**: Update it:
```sql
UPDATE public.push_notification_config
SET 
  supabase_url = 'https://your-project.supabase.co',
  service_role_key = 'your-actual-service-role-key',
  updated_at = NOW()
WHERE id = 'default';
```

## Step 2: Test the Function Directly

Test if the function can call the Edge Function:

```sql
-- Replace with a user ID that has a push token
DO $$
BEGIN
  PERFORM send_push_notification(
    p_recipient_id := 'user-id-with-push-token',
    p_title := 'Direct Test',
    p_body := 'Testing function',
    p_data := '{"type": "test"}'::JSONB
  );
  RAISE NOTICE 'Function called - check Edge Function logs now';
END $$;
```

Then immediately check:
- **Edge Function Logs**: Dashboard → Edge Functions → send-push-notification → Logs
- Look for the request in the logs

## Step 3: Check if Triggers Are Firing

### Enable Verbose Logging

```sql
SET client_min_messages TO NOTICE;
```

### Test a Trigger

Create a test message:

```sql
-- Get IDs first
SELECT 
  u1.id as sender_id,
  u1.full_name as sender_name,
  u2.id as recipient_id,
  u2.full_name as recipient_name,
  u2.expo_push_token IS NOT NULL as recipient_has_token,
  g.id as gig_id
FROM public.users u1
CROSS JOIN public.users u2
CROSS JOIN public.gigs g
WHERE u1.id != u2.id
  AND u2.expo_push_token IS NOT NULL
  AND g.status IN ('open', 'accepted')
LIMIT 1;

-- Then insert a message (replace with IDs from above)
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES (
  'gig-id-from-query-above',
  'sender-id-from-query-above',
  'recipient-id-from-query-above',
  'Test notification'
);
```

**Watch for**:
- NOTICE messages in the SQL output
- Any errors or warnings
- Check Edge Function logs immediately after

## Step 4: Verify Edge Function is Deployed

1. Go to: Supabase Dashboard → Edge Functions
2. Verify `send-push-notification` is listed
3. If not, deploy it:
   ```bash
   supabase functions deploy send-push-notification
   ```

## Step 5: Test Edge Function Directly

Test the Edge Function with curl:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "user-uuid-with-push-token",
    "title": "Direct Test",
    "body": "Testing Edge Function directly",
    "data": {"type": "test"}
  }'
```

**Check**:
- Response status (should be 200)
- Response body (should show success)
- User should receive notification

## Step 6: Check Common Issues

### Issue: pg_net extension not enabled

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_net';
```

If not found:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Issue: Function security

The function should be `SECURITY DEFINER`. Check:

```sql
SELECT 
  routine_name,
  security_type
FROM information_schema.routines
WHERE routine_name = 'send_push_notification';
```

Should show: `security_type = 'DEFINER'`

### Issue: RLS blocking config read

Check the policy:

```sql
SELECT * FROM pg_policies 
WHERE tablename = 'push_notification_config';
```

Should have a policy allowing SELECT for functions.

### Issue: Edge Function environment variables

The Edge Function needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

Check in: Dashboard → Edge Functions → send-push-notification → Settings → Secrets

These should be automatically set by Supabase, but verify they exist.

## Step 7: Check Database Logs

1. Go to: Supabase Dashboard → Logs → Postgres Logs
2. Look for:
   - NOTICE messages from triggers
   - WARNING messages about push notifications
   - Any errors

## Step 8: Verify User Has Push Token

```sql
SELECT 
  id,
  full_name,
  expo_push_token,
  LENGTH(expo_push_token) as token_length
FROM public.users
WHERE id = 'user-id-to-test';
```

**Requirements**:
- `expo_push_token` must NOT be NULL
- Token should be a long string (Expo push tokens are typically 100+ characters)
- User must have granted notification permissions in the app

## Step 9: Manual Trigger Test

If triggers aren't firing, test the trigger function directly:

```sql
-- Test the notify_new_message function directly
DO $$
DECLARE
  v_test_message RECORD;
BEGIN
  -- Get a recent message
  SELECT * INTO v_test_message
  FROM public.messages
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_test_message.id IS NOT NULL THEN
    -- Manually call the trigger function
    PERFORM notify_new_message();
    RAISE NOTICE 'Trigger function called';
  END IF;
END $$;
```

## Step 10: Check Network/URL Issues

Verify the Edge Function URL is correct:

```sql
DO $$
DECLARE
  v_config RECORD;
  v_url TEXT;
BEGIN
  SELECT supabase_url INTO v_config
  FROM public.push_notification_config
  WHERE id = 'default';
  
  v_url := v_config.supabase_url || '/functions/v1/send-push-notification';
  RAISE NOTICE 'Expected Edge Function URL: %', v_url;
END $$;
```

Make sure:
- URL starts with `https://`
- URL matches your Supabase project URL exactly
- No trailing slashes

## Still Not Working?

1. **Check Edge Function code**: Make sure it's deployed and up to date
2. **Check function logs**: Look for any errors or exceptions
3. **Test with a simple curl**: Bypass the database and test Edge Function directly
4. **Verify Expo push token format**: Should start with `ExponentPushToken[` or similar
5. **Check Expo Push API status**: Make sure Expo's service is operational

## Quick Diagnostic Query

Run this to get a full status:

```sql
SELECT 
  'Configuration' as check_type,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.push_notification_config WHERE id = 'default' AND supabase_url != 'https://your-project.supabase.co' AND LENGTH(service_role_key) > 20) > 0
    THEN '✓ Configured'
    ELSE '✗ Not configured'
  END as status
UNION ALL
SELECT 
  'Triggers',
  CASE 
    WHEN (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE '%notify%') = 9
    THEN '✓ All 9 triggers exist'
    ELSE '✗ Missing triggers'
  END
UNION ALL
SELECT 
  'Function',
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'send_push_notification')
    THEN '✓ Function exists'
    ELSE '✗ Function missing'
  END
UNION ALL
SELECT 
  'pg_net Extension',
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
    THEN '✓ Enabled'
    ELSE '✗ Not enabled'
  END
UNION ALL
SELECT 
  'Users with Tokens',
  COUNT(*)::TEXT || ' users'
FROM public.users
WHERE expo_push_token IS NOT NULL;
```

