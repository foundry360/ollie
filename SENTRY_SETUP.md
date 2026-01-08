# Sentry Integration Setup

Sentry has been integrated into the Ollie app. Follow these steps to complete the setup:

## 1. Get Your Sentry DSN

1. Log in to your Sentry account
2. Navigate to your project (or create a new one)
3. Go to **Settings** → **Projects** → Select your project
4. Go to **Client Keys (DSN)**
5. Copy your DSN (it looks like: `https://xxxxx@xxxxx.ingest.sentry.io/xxxxx`)

## 2. Add DSN to Environment Variables

Add your Sentry DSN to your `.env.local` file:

```bash
EXPO_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
```

## 3. Configure Sentry Plugin in app.json

Update `app.json` with your Sentry organization, project, and auth token:

1. **Get your Auth Token:**
   - Go to Sentry → **Settings** → **Account** → **Auth Tokens**
   - Create a new token with `project:read` and `project:releases` scopes
   - Copy the token

2. **Update app.json:**
   - Replace `"your-sentry-org"` with your Sentry organization slug
   - Replace `"your-sentry-project"` with your project slug
   - Replace `"your-sentry-auth-token"` with your auth token

   **Note:** For production builds, you can also use environment variables:
   ```json
   [
     "sentry-expo",
     {
       "organization": "${SENTRY_ORG}",
       "project": "${SENTRY_PROJECT}",
       "authToken": "${SENTRY_AUTH_TOKEN}"
     }
   ]
   ```

## 4. What's Been Integrated

✅ **Error Boundary Component** - Catches React component errors
✅ **Global Error Handler** - Catches unhandled JavaScript errors
✅ **User Context Tracking** - Automatically tracks user ID, email, name, and role
✅ **API Error Tracking** - Tracks errors in API calls (verification API)
✅ **Error Reporting** - All errors are automatically sent to Sentry (disabled in development)

## 5. Testing the Integration

To test that Sentry is working:

1. Add a test error button in a screen (temporarily):
   ```typescript
   import * as Sentry from 'sentry-expo';
   
   const testError = () => {
     try {
       throw new Error('Test error from Ollie app');
     } catch (error) {
       Sentry.Native.captureException(error);
     }
   };
   ```

2. Check your Sentry dashboard - you should see the error appear within a few seconds

## 6. Features Available

### Track Custom Events
```typescript
import { trackEvent } from '@/lib/sentry';

trackEvent('user_completed_profile', {
  userId: user.id,
  timestamp: new Date().toISOString(),
});
```

### Add Breadcrumbs
```typescript
import { addBreadcrumb } from '@/lib/sentry';

addBreadcrumb('User started verification', 'user_action', {
  hasFrontPhoto: true,
});
```

### Track API Errors
```typescript
import { trackApiError } from '@/lib/sentry';

try {
  // API call
} catch (error) {
  trackApiError('endpointName', error, { additionalContext: 'value' });
}
```

## 7. Production Builds

For production builds with EAS Build, make sure to:

1. Add environment variables to your EAS build configuration
2. Configure source maps upload (handled automatically by the Sentry plugin)
3. Set up release tracking in Sentry dashboard

## 8. Next Steps

- Set up alerts in Sentry dashboard for critical errors
- Configure release tracking
- Set up performance monitoring
- Add custom tags for better error filtering (user role, feature area, etc.)

## Notes

- Errors are **not** tracked in development mode (`__DEV__ === true`)
- User context is automatically updated when users log in/out
- All errors include relevant context (user info, stack traces, breadcrumbs)

