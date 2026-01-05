# Next Steps: Push Notifications Setup

You've created the Edge Function and database migration. Here's what to do next:

## ✅ Step 1: Configure Database Settings

The triggers need your Supabase project URL and service role key to call the Edge Function. These are stored in a configuration table.

### Using Supabase SQL Editor (Recommended)

1. Go to your Supabase Dashboard → SQL Editor
2. Open the file `setup-push-notifications.sql` (or copy the commands below)
3. Replace the placeholders with your actual values:
   - `your-project.supabase.co` → Your actual Supabase project URL
   - `your-service-role-key` → Your service role key (from Settings → API)

4. Run this command:

```sql
UPDATE public.push_notification_config
SET 
  supabase_url = 'https://your-project.supabase.co',
  service_role_key = 'your-service-role-key',
  updated_at = NOW()
WHERE id = 'default';
```

**Where to find these values:**
- **Supabase URL**: Dashboard → Settings → API → Project URL
- **Service Role Key**: Dashboard → Settings → API → `service_role` key (secret)

⚠️ **Important**: Keep your service role key secret! Never commit it to git.

## ✅ Step 2: Verify Configuration

Run this query in the SQL Editor to verify settings:

```sql
SELECT 
  supabase_url,
  CASE 
    WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
    THEN '✓ Configured'
    ELSE '✗ Not configured - please update the values'
  END as service_role_key_status,
  updated_at
FROM public.push_notification_config
WHERE id = 'default';
```

## ✅ Step 3: Verify Triggers Are Created

Check that all notification triggers exist:

```sql
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%' OR trigger_name LIKE '%push%'
ORDER BY event_object_table, trigger_name;
```

You should see 9 triggers:
- `on_gig_accepted_notify`
- `on_gig_started_notify`
- `on_gig_completed_notify`
- `on_gig_cancelled_notify`
- `on_parent_approval_needed_notify`
- `on_parent_approved_notify`
- `on_parent_rejected_notify`
- `on_new_message_notify`
- `on_payment_received_notify`

## ✅ Step 4: Test the Setup

### Test 1: Check Edge Function is Deployed

Go to Supabase Dashboard → Edge Functions → `send-push-notification`

You should see it listed there. If not, deploy it:

```bash
supabase functions deploy send-push-notification
```

### Test 2: Verify Users Have Push Tokens

```sql
SELECT 
  id,
  full_name,
  role,
  CASE 
    WHEN expo_push_token IS NOT NULL THEN '✓ Has token'
    ELSE '✗ No token'
  END as push_token_status
FROM public.users
WHERE expo_push_token IS NOT NULL;
```

**Note**: Users need to grant notification permissions in the app for `expo_push_token` to be set. The app automatically registers for push notifications when users log in.

### Test 3: Test a Notification Manually

You can test the Edge Function directly:

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_id": "user-uuid-here",
    "title": "Test Notification",
    "body": "This is a test notification",
    "data": {"type": "test"},
    "priority": "high"
  }'
```

### Test 4: Test via Database Trigger

Create a test message to trigger a notification:

```sql
-- Replace with actual IDs from your database
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES (
  'gig-id-here',
  'sender-user-id-here',
  'recipient-user-id-here',
  'Test notification message'
);
```

Then check the Edge Function logs in Supabase Dashboard → Edge Functions → `send-push-notification` → Logs

## 🐛 Troubleshooting

### Notifications Not Sending?

1. **Check database settings**:
   ```sql
   SELECT 
     supabase_url,
     CASE 
       WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
       THEN '✓ Configured'
       ELSE '✗ Not configured'
     END as key_status
   FROM public.push_notification_config
   WHERE id = 'default';
   ```

2. **Check Edge Function logs**:
   - Supabase Dashboard → Edge Functions → `send-push-notification` → Logs
   - Look for errors or warnings

3. **Check user has push token**:
   ```sql
   SELECT id, full_name, expo_push_token 
   FROM public.users 
   WHERE id = 'user-id-here';
   ```

4. **Check trigger is firing**:
   - Enable query logging temporarily
   - Perform an action that should trigger a notification
   - Check if the trigger function is being called

### Common Issues

- **"Supabase URL not configured"**: Run the `ALTER DATABASE` command for `supabase_url`
- **"User has no push token"**: User needs to grant notification permissions in the app
- **"Edge Function not found"**: Deploy the function: `supabase functions deploy send-push-notification`
- **"Permission denied"**: Make sure you're using the service role key, not the anon key

## 📱 Testing in the App

1. **Make sure users have push tokens**:
   - Users must grant notification permissions
   - The app automatically registers on login (see `app/_layout.tsx`)

2. **Test real scenarios**:
   - Accept a gig → Should notify neighbor
   - Send a message → Should notify recipient
   - Complete a gig → Should notify both parties
   - Approve/reject parent approval → Should notify teen

3. **Check notification deep linking**:
   - Tap a notification → Should navigate to the correct screen
   - Message notifications → Should open chat
   - Gig notifications → Should open gig detail

## 🎉 You're Done!

Once you've:
- ✅ Set the database configuration
- ✅ Verified triggers exist
- ✅ Verified Edge Function is deployed
- ✅ Tested with a real notification

Your push notifications are ready to go! They'll automatically fire when events occur in your app.

