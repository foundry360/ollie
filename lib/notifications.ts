// OneSignal SDK implementation (only works in development builds, not Expo Go)
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// OneSignal App ID
const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID || '70f9c61e-4309-4ec5-b904-2cd2982fb953';

// Conditionally import OneSignal (only available in development builds)
let OneSignal: any = null;
let OneSignalAvailable = false;

try {
  // Import OneSignal module
  const OneSignalModule = require('react-native-onesignal');
  // OneSignal is a property on the module, not the default export
  OneSignal = OneSignalModule.OneSignal || OneSignalModule.default || OneSignalModule;
  OneSignalAvailable = true;
  console.log('[OneSignal] SDK loaded successfully');
  console.log('[OneSignal] Module type:', typeof OneSignal);
  console.log('[OneSignal] Module keys:', Object.keys(OneSignalModule || {}));
  console.log('[OneSignal] OneSignal object keys:', Object.keys(OneSignal || {}));
  
  // Initialize OneSignal - try different methods
  if (OneSignal && typeof OneSignal.initialize === 'function') {
    OneSignal.initialize(ONESIGNAL_APP_ID);
    console.log('[OneSignal] Initialized with initialize():', ONESIGNAL_APP_ID);
  } else if (OneSignal && typeof OneSignal.setAppId === 'function') {
    OneSignal.setAppId(ONESIGNAL_APP_ID);
    console.log('[OneSignal] App ID set with setAppId():', ONESIGNAL_APP_ID);
  } else {
    // Try accessing as a class/constructor
    if (OneSignalModule.OneSignal && typeof OneSignalModule.OneSignal.initialize === 'function') {
      OneSignal = OneSignalModule.OneSignal;
      OneSignal.initialize(ONESIGNAL_APP_ID);
      console.log('[OneSignal] Initialized via OneSignalModule.OneSignal.initialize():', ONESIGNAL_APP_ID);
    } else {
      console.warn('[OneSignal] No initialization method found.');
      console.warn('[OneSignal] Module keys:', Object.keys(OneSignalModule || {}));
      console.warn('[OneSignal] OneSignal object:', OneSignal);
      OneSignalAvailable = false;
    }
  }

  // Configure OneSignal notification handlers (only if initialization succeeded)
  if (OneSignalAvailable && OneSignal) {
    try {
      // v5 API uses OneSignal.Notifications.setNotificationWillShowInForegroundHandler
      if (OneSignal.Notifications && typeof OneSignal.Notifications.setNotificationWillShowInForegroundHandler === 'function') {
        OneSignal.Notifications.setNotificationWillShowInForegroundHandler((event: any) => {
          const notification = event.getNotification();
          event.complete(notification);
          console.log('[OneSignal] Notification received in foreground (v5):', notification.title);
        });
      } else if (typeof OneSignal.setNotificationWillShowInForegroundHandler === 'function') {
        // Fallback to old API
        OneSignal.setNotificationWillShowInForegroundHandler((notificationReceivedEvent: any) => {
          const notification = notificationReceivedEvent.getNotification();
          notificationReceivedEvent.complete(notification);
          console.log('[OneSignal] Notification received in foreground (old API):', notification.title);
        });
      }

      // v5 API uses OneSignal.Notifications.setNotificationOpenedHandler
      if (OneSignal.Notifications && typeof OneSignal.Notifications.setNotificationOpenedHandler === 'function') {
        OneSignal.Notifications.setNotificationOpenedHandler((result: any) => {
          const notification = result.notification;
          const data = notification.additionalData || {};
          console.log('[OneSignal] Notification opened (v5):', notification.title, data);
          // Navigation will be handled in app/_layout.tsx
        });
      } else if (typeof OneSignal.setNotificationOpenedHandler === 'function') {
        // Fallback to old API
        OneSignal.setNotificationOpenedHandler((result: any) => {
          const notification = result.notification;
          const data = notification.additionalData || {};
          console.log('[OneSignal] Notification opened (old API):', notification.title, data);
          // Navigation will be handled in app/_layout.tsx
        });
      }
    } catch (error) {
      console.warn('[OneSignal] Error setting up handlers:', error);
    }
  }
} catch (error) {
  console.warn('[OneSignal] Not available (running in Expo Go?):', error);
  OneSignalAvailable = false;
  // OneSignal is null - app is running in Expo Go, not development build
}

// Register for push notifications with OneSignal
export async function registerForPushNotifications(): Promise<string | null> {
  console.log('[OneSignal] Registration function called');
  console.log('[OneSignal] Device.isDevice:', Device.isDevice);
  console.log('[OneSignal] OneSignalAvailable:', OneSignalAvailable);
  console.log('[OneSignal] OneSignal object:', OneSignal ? 'exists' : 'null');

  if (!Device.isDevice) {
    console.warn('[OneSignal] Must use physical device for Push Notifications');
    return null;
  }

  // Check if OneSignal is available (development build required)
  if (!OneSignal || !OneSignalAvailable) {
    console.warn('[OneSignal] Not available - requires development build (not Expo Go)');
    return null;
  }

  try {
    console.log('[OneSignal] Requesting push notification permission...');
    console.log('[OneSignal] OneSignal object structure:', Object.keys(OneSignal || {}));
    
    // Request permission - v5 API uses OneSignal.Notifications.requestPermission()
    let permission = false;
    if (OneSignal.Notifications && typeof OneSignal.Notifications.requestPermission === 'function') {
      permission = await OneSignal.Notifications.requestPermission(false);
      console.log('[OneSignal] Permission result (v5 API):', permission);
    } else if (typeof OneSignal.promptForPushNotificationsWithUserResponse === 'function') {
      // Fallback to old API
      permission = await OneSignal.promptForPushNotificationsWithUserResponse();
      console.log('[OneSignal] Permission result (old API):', permission);
    } else {
      console.warn('[OneSignal] No permission request method found');
      console.warn('[OneSignal] Available methods:', Object.keys(OneSignal || {}));
      return null;
    }
    
    if (!permission) {
      console.warn('[OneSignal] Push notification permission denied');
      return null;
    }

    // Opt-in to push notifications - required in v5 API
    console.log('[OneSignal] Opting in to push notifications...');
    if (OneSignal.User && OneSignal.User.pushSubscription && typeof OneSignal.User.pushSubscription.optIn === 'function') {
      await OneSignal.User.pushSubscription.optIn();
      console.log('[OneSignal] Opted in to push notifications');
    }

    // Get the push subscription ID - this is what we need for sending notifications
    console.log('[OneSignal] Getting push subscription ID...');
    let playerId: string | null = null;
    
    if (OneSignal.User && OneSignal.User.pushSubscription && typeof OneSignal.User.pushSubscription.getIdAsync === 'function') {
      // v5 API - Get push subscription ID (this is the Player ID for sending notifications)
      playerId = await OneSignal.User.pushSubscription.getIdAsync();
      console.log('[OneSignal] Push Subscription ID (Player ID):', playerId);
    } else if (OneSignal.User && typeof OneSignal.User.getOnesignalId === 'function') {
      // Fallback: Get OneSignal user ID
      playerId = await OneSignal.User.getOnesignalId();
      console.log('[OneSignal] OneSignal User ID:', playerId);
    } else if (typeof OneSignal.getDeviceState === 'function') {
      // Old API fallback
      const deviceState = await OneSignal.getDeviceState();
      console.log('[OneSignal] Device state (old API):', deviceState);
      playerId = deviceState?.userId || null;
    } else {
      console.warn('[OneSignal] No method to get user ID found');
      console.warn('[OneSignal] User methods:', OneSignal.User ? Object.keys(OneSignal.User) : 'User not found');
      return null;
    }

    if (!playerId) {
      console.warn('[OneSignal] Failed to get OneSignal player ID');
      return null;
    }

    console.log('[OneSignal] Player ID obtained:', playerId);

    // Save to user profile
    console.log('[OneSignal] Getting current user...');
    const { data: { user } } = await supabase.auth.getUser();
    console.log('[OneSignal] Current user:', user ? user.id : 'null');
    if (user) {
      // Get user location and role for tags
      const { data: userProfile } = await supabase
        .from('users')
        .select('location, role')
        .eq('id', user.id)
        .single();

      // Set user tags for location-based targeting
      const tags: Record<string, string> = {
        user_id: user.id,
        role: userProfile?.role || 'unknown',
      };

      // Add location tags if available
      if (userProfile?.location?.latitude && userProfile?.location?.longitude) {
        tags.location_lat = userProfile.location.latitude.toString();
        tags.location_lon = userProfile.location.longitude.toString();
      }

      // Set external ID for easier targeting
      if (OneSignal.User && typeof OneSignal.User.addAlias === 'function') {
        OneSignal.User.addAlias('external_id', user.id);
        console.log('[OneSignal] External ID set:', user.id);
      }

      // Set tags in OneSignal - v5 API uses OneSignal.User.addTags()
      if (OneSignal.User && typeof OneSignal.User.addTags === 'function') {
        OneSignal.User.addTags(tags);
        console.log('[OneSignal] Tags added (v5 API):', tags);
      } else if (typeof OneSignal.sendTags === 'function') {
        // Fallback to old API
        OneSignal.sendTags(tags);
        console.log('[OneSignal] Tags sent (old API):', tags);
      } else {
        console.warn('[OneSignal] No method to set tags found');
      }

      // Save OneSignal player ID to database
      console.log('[OneSignal] Saving player ID to database...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ onesignal_user_id: playerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('[OneSignal] Error saving to database:', updateError);
      } else {
        console.log('[OneSignal] Successfully registered with player ID:', playerId);
      }
    } else {
      console.warn('[OneSignal] No user logged in, cannot save player ID');
    }

    return playerId;
  } catch (error) {
    console.error('[OneSignal] Error registering for push notifications:', error);
    return null;
  }
}

// Setup notification listeners
export function setupNotificationListeners(
  onNotificationReceived?: (notification: any) => void,
  onNotificationTapped?: (response: any) => void
) {
  // OneSignal handles listeners automatically via the handlers above
  // But we can add custom handlers if needed
  
  if (onNotificationReceived) {
    // Custom handler for foreground notifications
    // OneSignal.setNotificationWillShowInForegroundHandler already handles this
  }

  if (onNotificationTapped) {
    // Custom handler for notification taps
    // OneSignal.setNotificationOpenedHandler already handles this
  }

  // Return cleanup function (OneSignal doesn't require cleanup)
  return () => {
    // No cleanup needed for OneSignal SDK
  };
}

// Send local notification (for testing)
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  // OneSignal SDK doesn't have a direct local notification method
  // Use in-app notifications or test via OneSignal dashboard
  console.log('[OneSignal] Local notification not supported, use OneSignal dashboard for testing');
}

