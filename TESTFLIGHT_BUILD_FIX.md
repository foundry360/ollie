# TestFlight Build Fix - RCT-Folly Issue

## Issue
Build failed with error:
```
[!] Unable to find a specification for `RCT-Folly` depended upon by `RNSentry`
```

## Root Cause
The Sentry React Native pod (`RNSentry`) is looking for `RCT-Folly`, which should be provided by React Native, but CocoaPods can't find it in the repository.

## Solution Applied

1. **Added Sentry plugin to `app.config.js`** - Since `app.config.js` takes precedence over `app.json`, we need Sentry configured there too.

2. **Made Sentry plugin conditional** - Only includes Sentry if `SENTRY_AUTH_TOKEN` is available, which can help avoid build issues during testing.

3. **Updated `eas.json`** - Added CocoaPods version specification and build configuration.

## Next Steps

### Option 1: Build Without Sentry (Temporary)
If you want to get the build working immediately, you can temporarily remove Sentry:

```bash
# Comment out Sentry in app.config.js temporarily
# Then build
eas build --platform ios --profile preview
```

### Option 2: Set Environment Variable
Ensure `SENTRY_AUTH_TOKEN` is set in EAS environment variables:
- Go to: https://expo.dev/accounts/foundry360/projects/ollie/settings/environment-variables
- Add `SENTRY_AUTH_TOKEN` if not already present
- Rebuild

### Option 3: Fix CocoaPods Dependency (Recommended)
The proper fix is to ensure CocoaPods can resolve `RCT-Folly`. This might require:
- Updating `sentry-expo` to latest version
- Or using a Podfile patch plugin
- Or updating React Native/Sentry compatibility

## Try Building Again

After these changes, try building again:

```bash
eas build --platform ios --profile preview
```

If it still fails, we may need to:
1. Check Sentry version compatibility
2. Create a custom Podfile
3. Or temporarily disable Sentry for TestFlight builds

