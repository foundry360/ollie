import * as Sentry from 'sentry-expo';
import Constants from 'expo-constants';

// Initialize Sentry
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  Sentry.init({
    dsn,
    enableInExpoDevelopment: true, // Temporarily enabled for testing
    debug: __DEV__, // Enable debug mode in development
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 1.0, // 100% of transactions for performance monitoring
    enableAutoSessionTracking: true,
    sessionTrackingIntervalMillis: 30000,
    integrations: [
      new Sentry.Native.ReactNativeTracing({
        enableNativeFramesTracking: !__DEV__,
        enableStallTracking: true,
      }),
    ],
  });

  // Set release information
  Sentry.Native.setRelease(
    `${Constants.expoConfig?.slug}@${Constants.expoConfig?.version}+${Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode}`
  );
}

// Set user context when user logs in
export function setSentryUser(user: { id: string; email?: string; full_name?: string; role?: string }) {
  Sentry.Native.setUser({
    id: user.id,
    email: user.email,
    username: user.full_name,
    role: user.role,
  });
}

// Clear user context on logout
export function clearSentryUser() {
  Sentry.Native.setUser(null);
}

// Track API errors
export function trackApiError(
  endpoint: string,
  error: Error,
  context?: Record<string, any>
) {
  Sentry.Native.captureException(error, {
    tags: {
      error_type: 'api_error',
      endpoint,
    },
    extra: {
      ...context,
      timestamp: new Date().toISOString(),
    },
    level: 'error',
  });
}

// Track custom events
export function trackEvent(
  eventName: string,
  data?: Record<string, any>
) {
  Sentry.Native.captureMessage(eventName, {
    level: 'info',
    extra: data,
  });
}

// Add breadcrumb for user actions
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  Sentry.Native.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

