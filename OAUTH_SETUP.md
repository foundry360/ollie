# OAuth Setup Guide for Google and Apple

This guide will help you configure Google and Apple OAuth authentication for your Ollie app.

## Prerequisites

- Supabase project set up
- Google Cloud Console account
- Apple Developer account (for Apple Sign In)

## Step 1: Configure Google OAuth

### 1.1 Create OAuth 2.0 Credentials in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in app name: `Ollie`
   - Add your email as support email
   - Add your email as developer contact
   - Save and continue through the scopes (default is fine)
   - Add test users if needed
   - Save

6. Create OAuth Client ID:
   - **Application type**: Web application
   - **Name**: Ollie Web Client
   - **Authorized redirect URIs**: 
     ```
     https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
     ```
     Replace `[YOUR_SUPABASE_PROJECT_REF]` with your actual Supabase project reference (found in your Supabase project URL)
   - Click **Create**
   - **Copy the Client ID and Client Secret** (you'll need these for Supabase)

### 1.2 Add Google OAuth to Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** > **Providers**
3. Find **Google** and click to enable it
4. Enter:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)
5. Click **Save**

## Step 2: Configure Apple Sign In

### 2.1 Enable Sign in with Apple in Apple Developer

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Go to **Identifiers** > **App IDs**
4. Select your app identifier (or create one)
5. Enable **Sign in with Apple** capability
6. Save the changes

### 2.2 Create Services ID for Web (Required for Supabase)

1. In Apple Developer Portal, go to **Identifiers** > **Services IDs**
2. Click **+** to create a new Services ID
3. Fill in:
   - **Description**: Ollie Web Authentication
   - **Identifier**: `com.ollie.auth` (or your preferred identifier)
4. Enable **Sign in with Apple**
5. Click **Configure** next to Sign in with Apple
6. Add **Primary App ID**: (select your app identifier)
7. Add **Website URLs**:
   - **Domains and Subdomains**: `[YOUR_SUPABASE_PROJECT_REF].supabase.co`
   - **Return URLs**: `https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback`
8. Save and continue

### 2.3 Create a Key for Sign in with Apple

1. Go to **Keys** in Apple Developer Portal
2. Click **+** to create a new key
3. Fill in:
   - **Key Name**: Ollie Sign in with Apple Key
   - Enable **Sign in with Apple**
4. Click **Configure** and select your Primary App ID
5. Click **Save** and **Continue**
6. **Download the key file** (.p8) - you can only download it once!
7. **Copy the Key ID** - you'll need this for Supabase

### 2.4 Find Your Team ID

1. In Apple Developer Portal, go to **Membership**
2. Your **Team ID** is displayed at the top (format: `ABC123DEF4`)
3. Copy this - you'll need it for Supabase

### 2.5 Add Apple OAuth to Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** > **Providers**
3. Find **Apple** and click to enable it
4. Enter:
   - **Services ID**: (the Services ID you created, e.g., `com.ollie.auth`)
   - **Secret Key**: (the contents of the .p8 key file you downloaded - paste the entire file contents)
   - **Key ID**: (the Key ID from Apple Developer Portal)
   - **Team ID**: (your Team ID from Apple Developer Portal)
5. Click **Save**

## Step 3: Configure Redirect URLs

The app uses deep linking for mobile (`ollie://auth/callback`), which is already configured in `app.json`.

For web support, Supabase will automatically handle the redirect to:
```
https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback
```

## Step 4: Test OAuth

1. Run your app: `npx expo start`
2. Navigate to the neighbor signup screen
3. Click "Continue with Google" or "Continue with Apple"
4. Complete the OAuth flow
5. You should be redirected back to the app and logged in

**Note**: Apple Sign In requires iOS 13+ and works best on physical iOS devices. It may not work in the iOS Simulator.

## Troubleshooting

### Common Issues

1. **"Redirect URI mismatch"**
   - Make sure the redirect URI in Google/Apple matches exactly: `https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/auth/v1/callback`
   - Check your Supabase project reference in your project URL

2. **"Invalid client" (Apple)**
   - Verify your Services ID, Key ID, Team ID, and Secret Key are correct in Supabase
   - Make sure the Services ID is configured with the correct return URL
   - Ensure Sign in with Apple is enabled for your App ID
   - Double-check that you pasted the entire .p8 key file contents (including the header and footer)

3. **"OAuth consent screen not configured" (Google)**
   - Complete the OAuth consent screen setup in Google Cloud Console
   - Add your email as a test user if needed

4. **Apple Sign In not showing on iOS**
   - Requires iOS 13+
   - Must test on a physical device (may not work in Simulator)
   - Ensure your app has the Sign in with Apple capability enabled in Xcode

5. **"Services ID not found" (Apple)**
   - Make sure you created a Services ID (not just an App ID)
   - Verify the Services ID identifier matches what you entered in Supabase
   - Ensure the Services ID has Sign in with Apple enabled

## Notes

- The redirect URL format for Supabase is always: `https://[PROJECT_REF].supabase.co/auth/v1/callback`
- Your Supabase project reference can be found in your Supabase project URL
- Apple Sign In requires an active Apple Developer Program membership ($99/year)
- For production, you'll need to verify your OAuth apps with Google/Apple
- Apple Sign In works on iOS, macOS, and web (via Services ID)
- The .p8 key file can only be downloaded once - keep it secure!
