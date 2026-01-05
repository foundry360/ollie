import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for push notification!');
    return null;
  }

  try {
    // Get project ID from environment, Constants, or let Expo infer it
    const projectId = 
      process.env.EXPO_PUBLIC_PROJECT_ID || 
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.expoConfig?.extra?.projectId ||
      undefined;
    
    // For push notifications, projectId is required in some cases
    // If not available, we'll skip getting the token (won't break the app)
    if (!projectId) {
      console.warn('Expo project ID not found. Push notifications may not work. Set EXPO_PUBLIC_PROJECT_ID in your .env file or add it to app.json extra.eas.projectId');
      return null;
    }
    
    // Retry logic for transient Expo API errors
    let token: string | null = null;
    const maxRetries = 3;
    let lastError: any = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await Notifications.getExpoPushTokenAsync({
          projectId: projectId,
        });
        token = result.data;
        break; // Success, exit retry loop
      } catch (error: any) {
        lastError = error;
        
        // Check if it's a transient error (503, connection timeout, etc.)
        const isTransientError = 
          error?.message?.includes('SERVICE_UNAVAILABLE') ||
          error?.message?.includes('temporarily unavailable') ||
          error?.message?.includes('connection timeout') ||
          error?.message?.includes('no healthy upstream') ||
          error?.message?.includes('upstream connect error');
        
        if (isTransientError && attempt < maxRetries) {
          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Expo push token service temporarily unavailable, retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Retry
        } else {
          // Not a transient error or max retries reached, throw/rethrow
          throw error;
        }
      }
    }

    if (!token) {
      // All retries failed
      if (lastError?.message?.includes('SERVICE_UNAVAILABLE') || 
          lastError?.message?.includes('temporarily unavailable')) {
        console.warn('Expo push notification service is temporarily unavailable. Push notifications will be retried automatically on next app launch.');
      } else {
        console.error('Error getting push token after retries:', lastError);
      }
      return null;
    }

    // Save token to user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('users')
        .update({ expo_push_token: token })
        .eq('id', user.id);
    }

    return token;
  } catch (error: any) {
    // Handle non-transient errors
    const isTransientError = 
      error?.message?.includes('SERVICE_UNAVAILABLE') ||
      error?.message?.includes('temporarily unavailable') ||
      error?.message?.includes('connection timeout') ||
      error?.message?.includes('no healthy upstream');
    
    if (isTransientError) {
      console.warn('Expo push notification service is temporarily unavailable. Push notifications will be retried automatically on next app launch.');
    } else {
      console.error('Error getting push token:', error);
    }
    return null;
  }
}

// Setup notification listeners
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listener for notifications received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  // Listener for when user taps on a notification
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationTapped) {
      onNotificationTapped(response);
    }
  });

  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}

// Send local notification (for testing)
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
    },
    trigger: null, // Send immediately
  });
}

