# Parent Account Email Setup Guide

This guide explains how the parent account welcome email system works using database webhooks.

## How It Works

1. **Parent Account Creation**: When a teen signup is approved, a parent account is created with a temporary password stored in user metadata.

2. **Database Trigger**: A database trigger automatically fires when a parent user is inserted into the `public.users` table.

3. **Email Sending**: The trigger calls the Edge Function server-side (bypassing CORS) to send the welcome email with the temporary password.

## Setup Instructions

### 1. Run the Database Migration

Apply the migration to create the trigger:

```bash
supabase migration up
```

Or apply it manually in Supabase Dashboard → SQL Editor:

```sql
-- Run the contents of supabase/migrations/007_send_parent_account_email_trigger.sql
```

### 2. Enable pg_net Extension

The migration will attempt to enable `pg_net`, but verify it's enabled:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### 3. Configure Database Settings

Set the following in Supabase Dashboard → Database → Settings → Custom Config, or run these SQL commands:

```sql
-- Set your Supabase project URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';

-- Set your service role key (get it from Settings → API → service_role key)
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key-here';

-- (Optional) Set your web app URL
ALTER DATABASE postgres SET app.settings.web_app_url = 'https://your-app-url.com';
```

**Important**: Replace `YOUR_PROJECT_REF` with your actual Supabase project reference (found in your project URL).

### 4. Deploy the Edge Function

Ensure the Edge Function is deployed:

```bash
supabase functions deploy send-parent-account-email
```

### 5. Configure Edge Function Secrets

In Supabase Dashboard → Edge Functions → send-parent-account-email → Settings → Secrets:

- Add `RESEND_API_KEY` with your Resend API key

## Testing

1. Approve a teen signup via the parent approval link
2. The parent account will be created automatically
3. The database trigger will fire and call the Edge Function
4. The parent should receive an email with their temporary password

## Troubleshooting

### Email Not Sending

1. **Check Database Logs**: 
   - Supabase Dashboard → Database → Logs
   - Look for notices/warnings from the trigger function

2. **Verify Settings**:
   ```sql
   SELECT current_setting('app.settings.supabase_url', true) as supabase_url;
   SELECT current_setting('app.settings.service_role_key', true) as service_role_key;
   ```

3. **Check Edge Function Logs**:
   - Supabase Dashboard → Edge Functions → send-parent-account-email → Logs
   - Verify the function is being called

4. **Verify pg_net Extension**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

### Common Issues

- **"pg_net extension not found"**: Enable it with `CREATE EXTENSION IF NOT EXISTS pg_net;`
- **"Supabase URL not configured"**: Set it using the ALTER DATABASE command above
- **"Service role key not configured"**: Set it using the ALTER DATABASE command above
- **"RESEND_API_KEY not configured"**: Add it in Edge Function secrets

## Security Notes

- The trigger uses `SECURITY DEFINER` to run with elevated privileges
- The service role key is stored in database settings (secure)
- The temporary password is stored in user metadata (encrypted at rest)
- The email is sent server-side, avoiding CORS and client-side security issues

## Benefits of This Approach

✅ **No CORS Issues**: Runs server-side, bypassing browser CORS restrictions  
✅ **More Reliable**: Automatic retries and error handling  
✅ **More Secure**: Service role key never exposed to client  
✅ **Better Architecture**: Event-driven, separation of concerns  
✅ **Scalable**: Handles high volume without client-side bottlenecks























