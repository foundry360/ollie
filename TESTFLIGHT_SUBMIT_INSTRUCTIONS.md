# How to Submit Build to TestFlight

## Build Status
✅ **Build Completed Successfully**
- Build ID: `0ccb3041-1e87-4f1b-b692-a5feb2915217`
- Status: Finished
- Platform: iOS
- Profile: preview
- Distribution: internal

## Why You Don't See It in TestFlight

The build has completed, but it **hasn't been submitted to TestFlight yet**. EAS builds don't automatically submit to TestFlight - you need to submit them manually.

## Submit to TestFlight

### Option 1: Submit via EAS CLI (Recommended)

Run this command in your terminal:

```bash
eas submit --platform ios --latest
```

This will:
- Find your latest iOS build
- Submit it to App Store Connect
- Upload it to TestFlight

You'll be prompted to:
1. Sign in with your Apple ID (if not already authenticated)
2. Confirm the app and build to submit

### Option 2: Submit via EAS Dashboard

1. Go to your [EAS Dashboard](https://expo.dev/accounts/foundry360/projects/ollie/builds)
2. Find your successful build
3. Click the **"Submit"** button
4. Follow the prompts

### Option 3: Manual Submission via App Store Connect

If automated submission doesn't work:

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Ollie Jobs**
3. Click **TestFlight** tab
4. Click **"+ Build"** button (if available)
5. Select your build

**Note:** Manual submission via App Store Connect requires downloading the `.ipa` file from EAS and uploading it manually.

## After Submission

Once submitted:

1. **Build Processing** (10-30 minutes)
   - App Store Connect processes the build
   - Status: "Processing" → "Ready to Test"

2. **View in TestFlight**
   - Go to App Store Connect → Ollie Jobs → TestFlight
   - You'll see the build appear in the "iOS Builds" section
   - Once processed, it will show "Ready to Test"

3. **Add Testers**
   - Click **"Internal Testing"** or **"External Testing"**
   - Add testers to your test groups

## Troubleshooting

### Build Not Appearing in TestFlight

**Check:**
1. Has the build been submitted? (Run `eas submit`)
2. Is it still processing? (Check App Store Connect)
3. Is the build expired? (Builds expire after 90 days)
4. Are you looking at the right app? (Verify bundle ID)

### Submission Fails

**Common Issues:**
- **Missing credentials:** Run `eas credentials` to set up
- **Apple ID not authenticated:** Sign in when prompted
- **App not found:** Verify bundle ID matches (`com.foundry360.ollie`)

### Build Processing Takes Too Long

- Usually takes 10-30 minutes
- If stuck > 1 hour, check App Store Connect status page
- Sometimes builds need to be re-submitted

## Quick Commands

```bash
# Submit latest build
eas submit --platform ios --latest

# Submit specific build
eas submit --platform ios --id 0ccb3041-1e87-4f1b-b692-a5feb2915217

# Check build status
eas build:list --platform ios --limit 1

# View build details
eas build:view 0ccb3041-1e87-4f1b-b692-a5feb2915217
```

## Next Steps After Submission

1. ✅ Build completed
2. ⏳ **Submit to TestFlight** ← You are here
3. ⏳ Wait for processing (10-30 min)
4. ⏳ Build appears in TestFlight
5. ⏳ Add internal testers
6. ⏳ Distribute to testers

---

**Action Required:** Run `eas submit --platform ios --latest` to submit your build to TestFlight.

