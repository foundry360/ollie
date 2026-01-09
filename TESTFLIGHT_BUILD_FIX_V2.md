# TestFlight Build Fix - Sentry Auto-Linking Issue (v2)

## Issue
Build still fails even after removing Sentry plugin because:
- `sentry-expo` is still installed in `package.json`
- React Native auto-linking picks up Sentry's native module
- Sentry's podspec still tries to resolve `RCT-Folly` dependency

## Root Cause
React Native's auto-linking automatically links any native module it finds in `node_modules`, regardless of whether the plugin is configured. Even though we removed the Sentry plugin, the package is still there and gets auto-linked.

## Solution Applied

Created `react-native.config.js` to **exclude Sentry from auto-linking on iOS**:

```javascript
module.exports = {
  dependencies: {
    'sentry-expo': {
      platforms: {
        ios: null, // disable iOS platform, auto-link will skip this
      },
    },
  },
};
```

This tells React Native's auto-linker to skip Sentry on iOS, preventing the CocoaPods dependency issue.

## What This Means

✅ **Sentry JavaScript code will still work** - Your error tracking calls in `lib/sentry.ts` will function at runtime

❌ **Native Sentry features disabled** - No native crash reporting, source maps upload during build

✅ **Build should succeed** - No more `RCT-Folly` dependency errors

## Try Building Again

```bash
eas build --platform ios --profile preview
```

This should now succeed without Sentry being auto-linked.

## After Build Succeeds

Once TestFlight is working, we can:
1. Investigate updating Sentry to a version that works with React Native 0.81.5
2. Create a proper fix for the `RCT-Folly` dependency issue
3. Re-enable Sentry properly after fixing the dependency

## Files Changed

1. ✅ `react-native.config.js` - Created to exclude Sentry from iOS auto-linking
2. ✅ `app.config.js` - Sentry plugin already disabled
3. ✅ `app.json` - Sentry plugin already removed

