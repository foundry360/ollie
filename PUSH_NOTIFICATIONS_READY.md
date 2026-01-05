# ✅ Push Notifications Setup Complete!

Your push notifications are now configured and ready to use!

## ✅ What's Set Up

1. **Edge Function**: `send-push-notification` deployed
2. **Database Configuration**: Supabase URL and service role key configured
3. **Database Triggers**: 9 triggers created for all notification events
4. **Client-Side**: Deep linking configured in `app/_layout.tsx`

## 🧪 Testing Your Notifications

### Test 1: Check Users Have Push Tokens

Users need to grant notification permissions in the app. Check who has tokens:

```sql
SELECT id, full_name, role, expo_push_token IS NOT NULL as has_token
FROM public.users
WHERE expo_push_token IS NOT NULL;
```

### Test 2: Test a Message Notification

Send a test message to trigger a notification:

```sql
-- Replace with actual IDs from your database
INSERT INTO public.messages (gig_id, sender_id, recipient_id, content)
VALUES (
  'your-gig-id',
  'sender-user-id',
  'recipient-user-id',  -- Must have expo_push_token
  'Test notification!'
);
```

Then check:
- Edge Function logs: Dashboard → Edge Functions → send-push-notification → Logs
- The recipient should receive a push notification

### Test 3: Test a Gig Status Change

```sql
-- Test gig accepted notification
UPDATE public.gigs
SET status = 'accepted', teen_id = 'teen-user-id'
WHERE id = 'gig-id' AND status = 'open';
```

This should notify:
- The neighbor (poster) that their gig was accepted
- The teen (confirmation)

### Test 4: Test Parent Approval

```sql
-- Test parent approval notification
UPDATE public.parent_approvals
SET status = 'approved'
WHERE id = 'approval-id' AND status = 'pending';
```

This should notify the teen that their parent approved the gig.

## 📱 What Happens When Users Tap Notifications

- **New Message** → Opens chat screen
- **Gig Accepted/Started/Completed** → Opens gig detail screen
- **Parent Approval Needed/Approved/Rejected** → Opens parent approvals screen
- **Payment Received** → Opens earnings screen

## 🔍 Monitoring

### Check Edge Function Logs
- Supabase Dashboard → Edge Functions → `send-push-notification` → Logs
- Look for errors or successful sends

### Check Database Logs
If notifications aren't sending, check for trigger execution:
- The triggers use `RAISE NOTICE` for logging
- Check Supabase logs for any warnings

## 🐛 Troubleshooting

### No Notifications Received?

1. **User doesn't have push token**:
   - User needs to grant notification permissions in the app
   - Check: `SELECT expo_push_token FROM public.users WHERE id = 'user-id';`

2. **Check Edge Function logs**:
   - Dashboard → Edge Functions → send-push-notification → Logs
   - Look for errors

3. **Verify configuration**:
   ```sql
   SELECT * FROM public.push_notification_config WHERE id = 'default';
   ```

4. **Test Edge Function directly**:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/send-push-notification \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "recipient_id": "user-uuid",
       "title": "Test",
       "body": "Test notification",
       "data": {"type": "test"}
     }'
   ```

## 🎉 You're All Set!

Notifications will automatically fire when:
- ✅ Gigs are accepted, started, completed, or cancelled
- ✅ Messages are sent
- ✅ Parent approvals are needed, approved, or rejected
- ✅ Payments are received

Just make sure users have granted notification permissions in the app!

