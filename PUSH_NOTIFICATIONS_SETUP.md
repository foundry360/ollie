# Push Notifications Setup Guide

This guide explains how to set up and deploy push notifications for the Ollie app.

## Overview

Push notifications are sent using **Expo Push Notifications (EPS)** via Supabase Edge Functions. When important events occur (gig status changes, messages, payments, etc.), database triggers automatically call an Edge Function that sends push notifications to users.

## Architecture

1. **Client-side**: Users register for push notifications and receive Expo push tokens
2. **Database**: Triggers detect events and call Edge Function via `pg_net`
3. **Edge Function**: Sends notifications via Expo Push API
4. **Expo Push Service**: Delivers notifications to iOS/Android devices

## Deployment Steps

### 1. Deploy the Edge Function

```bash
supabase functions deploy send-push-notification
```

### 2. Set Database Configuration

You need to update the configuration table with your Supabase URL and service role key:

```sql
UPDATE public.push_notification_config
SET 
  supabase_url = 'https://your-project.supabase.co',
  service_role_key = 'your-service-role-key-here',
  updated_at = NOW()
WHERE id = 'default';
```

**Important**: 
- Replace `your-project.supabase.co` with your actual Supabase project URL (from Dashboard → Settings → API → Project URL)
- Replace `your-service-role-key-here` with your service role key (from Dashboard → Settings → API → service_role key)
- Keep your service role key secret! Never commit it to git.

### 3. Run the Migration

```bash
supabase migration up
```

Or if you're applying a specific migration:

```bash
supabase db push
```

### 4. Verify Setup

Check that triggers are created:

```sql
-- List all notification triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%notify%' OR trigger_name LIKE '%push%'
ORDER BY event_object_table, trigger_name;
```

## Notification Types

The following events trigger push notifications:

### For Teenlancers (teens)

1. **Gig Accepted** - Confirmation when they accept a gig
2. **Parent Approval Needed** - Reminder when parent approval is pending
3. **Parent Approved** - Notification when parent approves
4. **Parent Rejected** - Notification when parent rejects with reason
5. **Gig Started** - Confirmation when they start a gig
6. **Gig Completed** - Confirmation when they complete a gig
7. **Gig Cancelled** - Notification when neighbor cancels
8. **New Message** - When they receive a message
9. **Payment Received** - When earnings status changes to 'paid'

### For Neighbors (posters)

1. **Gig Accepted** - When a teenlancer accepts their gig
2. **Gig Started** - When teenlancer starts working
3. **Gig Completed** - When teenlancer completes the gig
4. **Gig Cancelled** - When gig is cancelled
5. **New Message** - When they receive a message
6. **Payment Due** - (Future: reminder when payment needs to be processed)

## Testing

### Test Push Notification Manually

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

### Test via Database Trigger

You can manually trigger a notification by updating a record:

```sql
-- Test gig accepted notification
UPDATE public.gigs
SET status = 'accepted', teen_id = 'teen-user-id'
WHERE id = 'gig-id' AND status = 'open';

-- Test message notification
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES ('gig-id', 'sender-id', 'recipient-id', 'Test message');

-- Test payment notification
UPDATE public.earnings
SET status = 'paid', paid_at = NOW()
WHERE id = 'earning-id' AND status = 'pending';
```

## Troubleshooting

### Notifications Not Sending

1. **Check user has push token**:
   ```sql
   SELECT id, full_name, expo_push_token
   FROM public.users
   WHERE id = 'user-id';
   ```

2. **Check Edge Function logs**:
   - Go to Supabase Dashboard → Edge Functions → send-push-notification → Logs

3. **Check database configuration**:
   ```sql
   SELECT 
     supabase_url,
     CASE 
       WHEN service_role_key IS NOT NULL AND service_role_key != 'YOUR_SERVICE_ROLE_KEY_HERE'
       THEN '✓ Configured'
       ELSE '✗ Not configured - run UPDATE command above'
     END as key_status
   FROM public.push_notification_config
   WHERE id = 'default';
   ```

4. **Check trigger is firing**:
   ```sql
   -- Enable logging to see trigger execution
   SET log_statement = 'all';
   -- Then perform an action that should trigger notification
   ```

### Common Issues

- **"Supabase URL not configured"**: Run the `ALTER DATABASE` commands from step 2
- **"User has no push token"**: User needs to grant notification permissions in the app
- **"Expo push error"**: Check that the push token is valid (user may have uninstalled/reinstalled app)

## Client-Side Deep Linking

When users tap notifications, they're automatically navigated to the relevant screen:

- **New Message** → Opens chat screen
- **Gig events** → Opens gig detail screen
- **Parent approvals** → Opens parent approvals screen
- **Payment received** → Opens earnings screen

Deep linking is handled in `app/_layout.tsx` in the notification tap handler.

## Future Enhancements

- [ ] Notification preferences (allow users to opt in/out of specific types)
- [ ] Quiet hours support
- [ ] Batch notifications for multiple events
- [ ] Notification history/center
- [ ] Badge count management
- [ ] Rich notifications with images

## Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Expo Push API Reference](https://docs.expo.dev/push-notifications/sending-notifications/)

