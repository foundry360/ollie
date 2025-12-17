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
    
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: projectId,
    })).data;

    // Save token to user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('users')
        .update({ expo_push_token: token })
        .eq('id', user.id);
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
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

