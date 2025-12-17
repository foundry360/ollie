# Disable Email Confirmation in Supabase

## Steps to Disable Email Confirmation

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Authentication Providers** (NOT Email Templates)
   - Click **Authentication** in the left sidebar
   - Click **Providers** (NOT "Templates" or "Email Templates")
   - The URL should be: `https://supabase.com/dashboard/project/[your-project]/auth/providers`

3. **Disable Email Confirmation**
   - Find the **"Email"** provider section
   - Look for **"Confirm email"** toggle/switch
   - **Turn it OFF** (toggle should be gray/unchecked)
   - This is the setting that controls whether users need to verify their email

4. **Save Changes**
   - Click **Save** button (usually at the bottom of the page)

5. **Save Changes**
   - Click **Save** if there's a save button
   - Some changes save automatically

## What This Does

- Users can sign up and immediately use the app without email verification
- No confirmation emails will be sent
- Users are automatically signed in after signup
- `email_confirmed_at` will be `null`, but the app won't check it

## Important Notes

- This affects **all** email/password signups in your project
- OAuth providers (Google, Apple) are not affected
- You can re-enable this later if needed

## Verification

After disabling:
1. Try signing up a new user
2. They should be able to proceed immediately without email confirmation
3. No redirect to confirm-email screen should occur
