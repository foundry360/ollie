# How to Find Your App Store Connect App ID

## Issue
EAS is having trouble finding your app automatically. We need to provide the numeric App Store Connect App ID.

## What is the App ID?

The **App Store Connect App ID** is a **numeric ID** (like `1234567890`), NOT the bundle ID (`com.foundry360.ollie`).

## How to Find It

### Method 1: From App Store Connect URL

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Ollie Jobs**
3. Look at the URL in your browser - it will look like:
   ```
   https://appstoreconnect.apple.com/apps/1234567890/appstore
   ```
4. The number after `/apps/` is your App ID (e.g., `1234567890`)

### Method 2: From App Information Page

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Ollie Jobs**
3. Click **"App Information"** in the left sidebar
4. Look for **"Apple ID"** - this is your numeric App ID

### Method 3: From App Store Connect API

If you have App Store Connect API access, you can also find it there, but the above methods are easier.

## Once You Have the App ID

After you find your numeric App ID, I'll help you add it to `eas.json`:

```json
"submit": {
  "preview": {
    "ios": {
      "ascAppId": "YOUR_NUMERIC_APP_ID_HERE"
    }
  }
}
```

Then submit again:
```bash
eas submit --platform ios --id 0ccb3041-1e87-4f1b-b692-a5feb2915217
```

## Alternative: Skip EAS Submit and Upload Manually

If finding the App ID is difficult, you can:

1. Download the `.ipa` file from EAS dashboard
2. Go to App Store Connect → TestFlight
3. Upload the `.ipa` file manually

But using the App ID with EAS is the easier approach long-term.

