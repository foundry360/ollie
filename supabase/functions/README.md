# Supabase Edge Functions - Parent Approval Email

## Setup Instructions

### 1. Configure SMTP in Supabase Dashboard

**This is the only step needed - no third-party services required!**

1. Go to **Supabase Dashboard** → **Settings** → **Auth** → **SMTP Settings**
2. Enable SMTP and configure:
   - **SMTP Host**: Your email provider's SMTP server (e.g., `smtp.gmail.com`)
   - **SMTP Port**: Usually `587` for TLS or `465` for SSL
   - **SMTP User**: Your email address
   - **SMTP Password**: Your email password or app-specific password
   - **Sender Email**: The email address to send from
   - **Sender Name**: "Ollie" (or your preferred name)

**Common SMTP Settings:**
- **Gmail**: `smtp.gmail.com:587` (requires app password)
- **Outlook**: `smtp-mail.outlook.com:587`
- **Custom SMTP**: Use your email provider's SMTP settings

### 2. Deploy the Edge Function

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```
   (Find your project ref in Supabase Dashboard → Settings → General)

4. **Deploy the function**:
   ```bash
   supabase functions deploy send-parent-approval-email
   ```

### 3. Set Environment Variables

Make sure these are set in your app's `.env` file:
- `EXPO_PUBLIC_WEB_APP_URL` - Your web app URL for the approval link (e.g., `http://localhost:8081` for local testing)

## How It Works

1. The Edge Function receives the email request
2. It uses Supabase's configured SMTP settings (from Dashboard)
3. Sends an HTML email to the parent
4. The email contains a link to approve/reject the teen's account

## Testing

### Before SMTP is Configured:
- The function will log email details to Supabase Edge Functions logs
- Check the logs in Supabase Dashboard → Edge Functions → Logs
- Copy the `approvalUrl` from the logs to test manually

### After SMTP is Configured:
- Emails will be sent automatically
- Check the parent's email inbox
- Click the approval link to test the flow

## HTML Email Template

The email uses a clean, responsive HTML template with:
- Ollie branding (green #73af17)
- Clear call-to-action button
- Fallback text link
- Mobile-friendly design
- Expiration notice

## Troubleshooting

- **Emails not sending?** Check SMTP settings in Supabase Dashboard
- **Function errors?** Check Edge Functions logs in Supabase Dashboard
- **Testing locally?** Use the approval URL from console logs

