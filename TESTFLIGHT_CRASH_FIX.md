# TestFlight Crash Fix

## Issue
App crashes immediately on launch in TestFlight.

## Potential Causes Fixed

### 1. Sentry Initialization
- **Problem**: Sentry code was trying to access `Sentry.Native` without checking if it exists
- **Fix**: Added null checks and try-catch blocks around all Sentry calls
- **Files Modified**:
  - `lib/sentry.ts` - All functions now check `Sentry.Native` exists before calling
  - `app/_layout.tsx` - Global error handler wrapped in try-catch
  - `components/ErrorBoundary.tsx` - Added null check for `Sentry.Native`

### 2. Environment Variables
- **Problem**: Missing environment variables in production build
- **Status**: Supabase has fallback values, but we should verify EAS build has env vars
- **Action Needed**: Check if environment variables are set in EAS build

## Next Steps

1. **Check Environment Variables in EAS**
   ```bash
   # Check current env vars
   eas secret:list
   
   # Add missing env vars if needed
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-url"
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-key"
   eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-dsn"
   ```

2. **Rebuild and Test**
   ```bash
   eas build --platform ios --profile preview
   eas submit --platform ios --latest
   ```

3. **Check Crash Logs**
   - Go to App Store Connect → TestFlight → Crashes
   - Check device logs if available
   - Look for specific error messages

## Common TestFlight Crash Causes

1. **Missing Native Modules**: Check if all native dependencies are properly linked
2. **Missing Permissions**: Check Info.plist for required permissions
3. **Environment Variables**: Ensure all `EXPO_PUBLIC_*` vars are set in EAS
4. **Initialization Errors**: Check startup code for unhandled errors
5. **Network Timeouts**: First launch network requests failing

## Debugging Steps

1. **Check Build Logs**
   - Look for warnings about missing modules
   - Check for environment variable warnings

2. **Test Locally First**
   ```bash
   # Build locally to catch issues
   eas build --platform ios --profile preview --local
   ```

3. **Add More Logging**
   - Add console.log statements at app startup
   - Check if app reaches certain points before crashing

4. **Check Device Logs**
   - Connect device to Xcode
   - View console logs during crash

## Files Modified

- `lib/sentry.ts` - Added null checks and try-catch
- `app/_layout.tsx` - Added error handling for global error handler
- `components/ErrorBoundary.tsx` - Added null check for Sentry.Native

