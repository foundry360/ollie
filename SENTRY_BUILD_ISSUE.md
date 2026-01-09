# Sentry Build Issue - Temporary Fix

## Issue
Build fails with error:
```
[!] Unable to find a specification for `RCT-Folly` depended upon by `RNSentry`
```

## Root Cause
The Sentry React Native pod (`RNSentry`) is looking for `RCT-Folly` from CocoaPods trunk repo, but React Native 0.81.5 with New Architecture provides it differently. The podspec dependency resolution is incompatible.

## Temporary Solution
**Sentry has been temporarily disabled in the build configuration** to allow TestFlight builds to succeed.

**Important:** Sentry code in your app (`lib/sentry.ts`, error tracking calls) will still work at runtime, but source maps and build-time Sentry features will be disabled until we fix this.

## What's Changed
1. **Removed Sentry plugin from `app.config.js`** - Disabled during build
2. **Removed Sentry plugin from `app.json`** - To avoid conflicts

## Try Building Again

```bash
eas build --platform ios --profile preview
```

This should now succeed without the Sentry dependency issue.

## Re-enabling Sentry Later

Once the build is working and you've tested TestFlight, we can:

1. **Option 1: Update Sentry package** - Check if newer version fixes the issue
2. **Option 2: Fix Podspec** - Create a custom patch for Sentry's podspec
3. **Option 3: Use different error tracking** - Consider alternatives during build issues

To re-enable, uncomment the Sentry plugin in `app.config.js` and update it.

## Notes
- Your app will still run Sentry error tracking at runtime (if DSN is set)
- Build-time Sentry features (source maps upload) are disabled
- This is a temporary workaround to get TestFlight working
- We can fix the Sentry integration properly after TestFlight is set up

