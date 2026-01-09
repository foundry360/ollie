// Conditionally import Sentry - may not be available during build
let Sentry: any = null;
try {
  Sentry = require('sentry-expo');
} catch (e) {
  console.warn('Sentry not available - error tracking disabled during build');
}

import Constants from 'expo-constants';

// Initialize Sentry
export function initSentry() {
  if (!Sentry) {
    console.warn('Sentry not available - error tracking disabled.');
    return;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    console.warn('Sentry DSN not found. Error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      enableInExpoDevelopment: false, // Disable in development
      debug: false, // Disable debug mode
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: 1.0, // 100% of transactions for performance monitoring
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      integrations: Sentry.Native?.ReactNativeTracing ? [
        new Sentry.Native.ReactNativeTracing({
          enableNativeFramesTracking: !__DEV__,
          enableStallTracking: true,
        }),
      ] : [],
    });

    // Set release information (safely)
    if (Sentry.Native?.setRelease && Constants.expoConfig) {
      try {
        Sentry.Native.setRelease(
          `${Constants.expoConfig?.slug || 'ollie'}@${Constants.expoConfig?.version || '1.0.0'}+${Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1'}`
        );
      } catch (releaseError) {
        console.warn('Failed to set Sentry release:', releaseError);
      }
    }
  } catch (initError) {
    console.warn('Failed to initialize Sentry:', initError);
  }
}

// Set user context when user logs in
export function setSentryUser(user: { id: string; email?: string; full_name?: string; role?: string }) {
  if (!Sentry || !Sentry.Native) return;
  try {
    Sentry.Native.setUser({
      id: user.id,
      email: user.email,
      username: user.full_name,
      role: user.role,
    });
  } catch (error) {
    console.warn('Failed to set Sentry user:', error);
  }
}

// Clear user context on logout
export function clearSentryUser() {
  if (!Sentry || !Sentry.Native) return;
  try {
    Sentry.Native.setUser(null);
  } catch (error) {
    console.warn('Failed to clear Sentry user:', error);
  }
}

// Track API errors
export function trackApiError(
  endpoint: string,
  error: Error,
  context?: Record<string, any>
) {
  if (!Sentry || !Sentry.Native) return;
  try {
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
  } catch (trackError) {
    console.warn('Failed to track API error in Sentry:', trackError);
  }
}

// Track custom events
export function trackEvent(
  eventName: string,
  data?: Record<string, any>
) {
  if (!Sentry || !Sentry.Native) return;
  try {
    Sentry.Native.captureMessage(eventName, {
      level: 'info',
      extra: data,
    });
  } catch (trackError) {
    console.warn('Failed to track event in Sentry:', trackError);
  }
}

// Add breadcrumb for user actions
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, any>
) {
  if (!Sentry || !Sentry.Native) return;
  try {
    Sentry.Native.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch (breadcrumbError) {
    console.warn('Failed to add breadcrumb in Sentry:', breadcrumbError);
  }
}

