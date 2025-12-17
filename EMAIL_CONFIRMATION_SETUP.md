# Email Confirmation Setup Guide (6-Digit Code)

## Overview
Ollie uses a 6-digit code verification system for email confirmation. After signing up, users receive an email with a 6-digit code that they enter in the app to verify their email address.

## How It Works

1. User signs up with email and password
2. Supabase creates the user account (unconfirmed)
3. App automatically sends a 6-digit OTP code to the user's email
4. User is redirected to the code entry screen
5. User enters the 6-digit code from their email
6. Code is verified → User profile is created → User is logged in

## Supabase Configuration

### Step 1: Configure Email Template

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates**
2. Select **"Confirm signup"** template
3. Update the template to display the 6-digit code prominently

**Example Email Template:**
```html
<h2>Confirm your signup</h2>
<p>Your verification code is:</p>
<h1 style="font-size: 32px; letter-spacing: 8px; color: #73af17;">{{ .Token }}</h1>
<p>Enter this code in the Ollie app to verify your email address.</p>
<p>This code will expire in 1 hour.</p>
```

**Note:** The `{{ .Token }}` variable contains the 6-digit code that Supabase generates.

### Step 2: Configure OTP Settings

1. Go to **Supabase Dashboard** → **Authentication** → **Settings**
2. Under **"Email Auth"**, ensure:
   - **"Enable email confirmations"** is enabled
   - **"Secure email change"** is enabled (optional)
3. Under **"OTP Settings"** (if available):
   - Code length: 6 digits (default)
   - Expiry time: 3600 seconds (1 hour) - adjust as needed

### Step 3: Configure Redirect URLs (Optional)

Since we're using OTP codes instead of links, redirect URLs are not strictly necessary. However, you may want to configure them for other flows:

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Set the **Site URL**:
   - For local development: `http://localhost:8081`
   - For production: Your deployed web app URL
3. Add **Redirect URLs** if needed for other authentication flows

## App Flow

### Signup Process

1. User fills out signup form (email, password, full name)
2. App calls `signUp()` to create account
3. If email confirmation is required (no session returned):
   - App automatically calls `sendVerificationCode(email)`
   - User is redirected to `/auth/confirm-email` screen
4. User enters 6-digit code
5. App calls `verifyEmailCode(email, code)`
6. On success:
   - User profile is created
   - User is logged in
   - User is redirected to main app

### Code Entry Screen Features

- **6 Individual Input Boxes**: One for each digit
- **Auto-Advance**: Automatically moves to next input when digit is entered
- **Auto-Submit**: Automatically submits when all 6 digits are entered
- **Backspace Handling**: Moves to previous input when backspace is pressed on empty input
- **Resend Code**: Button to request a new code if needed
- **Error Handling**: Clears code and shows error message on invalid code

## Testing

### Local Development

1. Start your Expo app: `npx expo start`
2. Sign up with a test email address
3. Check your email for the 6-digit code
4. Enter the code in the app
5. You should be logged in and redirected to the main app

### Production

1. Ensure email templates are configured correctly
2. Test the signup flow with a real email address
3. Verify that codes are received promptly
4. Test the resend code functionality

## Troubleshooting

### Code Not Received

- **Check spam folder**: Codes may be filtered as spam
- **Verify email address**: Ensure the email address is correct
- **Check Supabase logs**: Go to Dashboard → Logs → Auth Logs
- **Resend code**: Use the "Resend Code" button in the app

### Invalid Code Error

- **Code expired**: Codes expire after 1 hour (configurable)
- **Wrong code**: Ensure all 6 digits are entered correctly
- **Code already used**: Each code can only be used once
- **Request new code**: Use the "Resend Code" button

### User Not Logged In After Verification

- **Check Supabase logs**: Look for profile creation errors
- **Verify RLS policies**: Ensure user can create their own profile
- **Check network**: Ensure app can connect to Supabase

### Code Entry Not Working

- **Check input focus**: Ensure inputs are receiving focus
- **Verify keyboard**: Ensure number pad is showing
- **Check for errors**: Look for console errors in development

## Code Implementation

### Key Functions

**`lib/supabase.ts`:**
- `sendVerificationCode(email)` - Sends OTP code to email
- `verifyEmailCode(email, token)` - Verifies the 6-digit code
- `resendVerificationCode(email)` - Resends a new code

**`app/auth/confirm-email.tsx`:**
- Code input UI with 6 individual inputs
- Auto-advance and auto-submit functionality
- Error handling and resend functionality

**`app/auth/signup-adult.tsx`:**
- Automatically sends OTP code after signup
- Redirects to code entry screen

## Notes

- Codes are 6 digits by default (configurable in Supabase)
- Codes expire after 1 hour (configurable in Supabase)
- Each code can only be used once
- Users can request a new code if needed
- The code entry screen automatically submits when all 6 digits are entered
- The app handles all verification in-app - no web browser required
