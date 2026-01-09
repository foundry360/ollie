# TestFlight Crash Debugging

## Issue
App still crashing in TestFlight after Sentry fixes.

## Potential Causes

### 1. Missing Environment Variables ⚠️ CRITICAL
The app requires these environment variables:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SENTRY_DSN` (optional)

**Current Status**: Only `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` is set in EAS.

**Fix**: Add missing environment variables to EAS:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "your-supabase-url"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-supabase-anon-key"
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-sentry-dsn"
```

### 2. Supabase Client Initialization
The app creates a Supabase client at module load time. If environment variables are missing, it uses placeholder values which could cause crashes.

**Location**: `lib/supabase.ts:7-8`

### 3. Auth State Check on Startup
The app checks auth state immediately on startup. If Supabase is not configured, this could fail.

**Location**: `app/_layout.tsx:214`

## Debugging Steps

1. **Check Environment Variables**
   ```bash
   eas env:list
   ```

2. **Add Missing Variables**
   ```bash
   # Get values from .env file
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "$(grep EXPO_PUBLIC_SUPABASE_URL .env | cut -d '=' -f2)"
   eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "$(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env | cut -d '=' -f2)"
   ```

3. **Rebuild with Environment Variables**
   ```bash
   eas build --platform ios --profile preview
   ```

4. **Check Crash Logs**
   - App Store Connect → TestFlight → Crashes
   - Look for specific error messages

## Code Locations to Check

1. `lib/supabase.ts:7-8` - Supabase client creation
2. `app/_layout.tsx:207-212` - Supabase URL check
3. `app/_layout.tsx:214` - Auth session check
4. `lib/sentry.ts:18` - Sentry DSN check

## Next Steps

1. ✅ Add environment variables to EAS
2. ✅ Rebuild with environment variables
3. ✅ Test in TestFlight
4. ✅ Check crash logs if still failing

