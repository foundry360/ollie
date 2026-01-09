# TestFlight Submission Fix - App Store Connect App ID

## Issue
Error: `Invalid Apple App Store Connect App ID ("ascAppId") was specified. It should consist only of digits.`

## Root Cause
I incorrectly specified `ascAppId` as the bundle ID (`com.foundry360.ollie`) instead of leaving it empty for auto-detection.

## Fix Applied
Removed the invalid `ascAppId` from `eas.json`. EAS will automatically find your app using:
- The bundle ID from `app.json`: `com.foundry360.ollie`
- It matches this to your existing "Ollie Jobs" app in App Store Connect

## Submit to TestFlight

Now run this command:

```bash
eas submit --platform ios --id 0ccb3041-1e87-4f1b-b692-a5feb2915217
```

EAS will:
1. Find your build by ID
2. Automatically match it to your App Store Connect app using the bundle ID
3. Submit it to TestFlight

## What Happens Next

1. **Build Upload** (5-10 minutes)
   - Build is uploaded to App Store Connect
   - Appears in the TestFlight tab

2. **Build Processing** (10-30 minutes)
   - App Store Connect processes the build
   - Status: "Processing" → "Ready to Test"

3. **Available for Testing**
   - Build shows as "Ready to Test"
   - You can add testers immediately

## Alternative: Find Your App ID Manually

If EAS still can't find your app automatically, you can find the numeric App ID:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Ollie Jobs**
3. Look at the URL - it will contain the App ID (e.g., `/apps/1234567890/`)
4. Or go to **App Information** → The numeric App ID is shown there

Then you can add it to `eas.json` if needed:
```json
"submit": {
  "preview": {
    "ios": {
      "ascAppId": "1234567890"  // Your numeric App ID
    }
  }
}
```

But it should work without it - EAS can auto-detect it.

## Try Again

Run the submit command again - it should work now:

```bash
eas submit --platform ios --id 0ccb3041-1e87-4f1b-b692-a5feb2915217
```

