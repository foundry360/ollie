import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import { supabase, getUserProfile, createUserProfile } from '@/lib/supabase';
import { getNeighborApplicationByUserId } from '@/lib/api/neighborApplications';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Loading } from '@/components/ui/Loading';
import { registerForPushNotifications, setupNotificationListeners } from '@/lib/notifications';

// Conditionally import StripeProvider - only on native platforms (not web)
let StripeProvider: any;
if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    StripeProvider = stripeModule.StripeProvider;
  } catch (e) {
    // Native module not available (Expo Go) - use passthrough component
    StripeProvider = ({ children, ...props }: any) => children;
  }
} else {
  // Web platform - Stripe not supported, use passthrough
  StripeProvider = ({ children, ...props }: any) => children;
}

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      staleTime: 30000, // 30 seconds default
      retry: 2,
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Only refetch on reconnect
      refetchInterval: false, // EXPLICITLY disable polling globally
    } 
  }
});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { user, setUser, loading, setLoading } = useAuthStore();
  const { colorScheme, initializeTheme } = useThemeStore();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Initialize theme
    const cleanup = initializeTheme();
    return cleanup;
  }, [initializeTheme]);

  useEffect(() => {
    // Register for push notifications
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);

  useEffect(() => {
    // Setup notification listeners
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification tapped:', response);
        const data = response.notification.request.content.data;
        // Handle navigation based on notification data
        if (data?.taskId) {
          router.push(`/tasks/${data.taskId}`);
        } else if (data?.chatTaskId) {
          router.push(`/chat/${data.chatTaskId}`);
        }
      }
    );
    return cleanup;
  }, [router]);

  useEffect(() => {
    // Check if Supabase is configured
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      setLoading(false);
      setUser(null);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Email confirmation is disabled - proceed with user session
        try {
          const profile = await getUserProfile(session.user.id);
          setUser(profile);
          setLoading(false);
        } catch (error: any) {
          // Profile doesn't exist - check for pending neighbor application
          if (error.code === 'PGRST116') {
            // Check if this is a pending neighbor signup
            try {
              const application = await getNeighborApplicationByUserId(session.user.id);
              if (application) {
                console.log('User has pending application with status:', application.status);
                // Don't set user - they'll be redirected by navigation guard
                // The pending application screen will handle them
              }
            } catch (appError) {
              console.log('No pending application found');
            }
            // User is in signup flow, profile will be created after approval
          } else {
            // Only log non-PGRST116 errors
            console.log('Profile not found on app launch:', error.message);
          }
          setUser(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip updating auth store if we're suppressing navigation (e.g., during OTP verification)
      const { suppressingNavigation } = useAuthStore.getState();
      if (suppressingNavigation) {
        console.log('Skipping auth state change update due to navigation suppression');
        return;
      }
      
      if (session?.user) {
        try {
          let profile;
          try {
            profile = await getUserProfile(session.user.id);
          } catch (error: any) {
            // Profile doesn't exist - this is normal for:
            // 1. New signups (neighbor signup flow creates pending application, not profile)
            // 2. Users who haven't completed their signup flow
            // Only create profile for OAuth users (not email/password)
            
            // Check if this is an OAuth sign-in by looking at the auth provider
            const isOAuthUser = session.user.app_metadata?.provider !== 'email' && 
                               session.user.app_metadata?.provider !== undefined;
            
            // Only create profile for OAuth users on SIGNED_IN event
            // Email/password users go through neighbor signup flow (pending application)
            if (isOAuthUser && event === 'SIGNED_IN') {
              console.log('Profile not found for OAuth user, creating new profile');
              
              const user = session.user;
              const userMetadata = user.user_metadata || {};
              const fullName = userMetadata.full_name || 
                              userMetadata.name || 
                              `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                              user.email?.split('@')[0] ||
                              'User';
              
              const email = user.email || userMetadata.email;
              
              if (!email) {
                console.warn('OAuth user missing email, skipping profile creation');
                setUser(null);
                return;
              }

              // Determine role - default to 'poster' for OAuth signups (neighbors)
              const role = 'poster';

              // Create user profile (with retry logic built in)
              try {
                await createUserProfile(user.id, {
                  email,
                  full_name: fullName,
                  role,
                });

                // Fetch the newly created profile
                profile = await getUserProfile(user.id);
              } catch (profileError: any) {
                // If profile creation fails, log but don't crash
                console.warn('Failed to create user profile for OAuth user:', profileError.message);
                setUser(null);
                return;
              }
            } else {
              // For email/password users or other events:
              // - During neighbor signup, profile doesn't exist yet (pending application instead)
              // - This is expected and not an error
              // - User will complete signup flow and profile will be created after approval
              if (error.code === 'PGRST116') {
                // Profile doesn't exist - this is expected for new signups
                // Silently set user to null, let the signup flow handle it
                setUser(null);
                return;
              }
              // For other errors, still set user to null
              setUser(null);
              return;
            }
          }
          setUser(profile);
        } catch (error: any) {
          // Only log unexpected errors (not PGRST116 which is expected)
          if (error.code !== 'PGRST116' && !error.message?.includes('User does not exist') && !error.code?.includes('23503')) {
            console.error('Error handling auth state change:', error);
          }
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Don't run navigation guard while loading - this prevents redirects during navigation
    if (loading) {
      return;
    }
    
    // Wait for router and segments to be ready
    if (!router || !segments || segments.length === 0) {
      return;
    }
    
    try {
      const currentSegment = segments[0];
      const inTabs = currentSegment === '(tabs)';
      const inAuthGroup = currentSegment === 'auth';
      const inSplash = currentSegment === 'splash';
      const inRoleSelection = currentSegment === 'role-selection';
      const inParentApprove = currentSegment === 'parent-approve';
      
      // RELAXED navigation guard:
      // 1. Allow ALL auth routes, splash, role-selection, and parent-approve to work freely (NO REDIRECTS)
      // 2. Only protect main app (tabs) - redirect to splash if not logged in
      // 3. Only redirect logged-in users away from splash/role-selection to tabs (but allow them to stay if they want)
      
      // Always allow auth routes, splash, role-selection, and parent-approve to work freely
      // NO REDIRECTS for these routes - let them handle their own navigation
      // This is the most important check - auth routes should NEVER be redirected
      if (inAuthGroup || inSplash || inRoleSelection || inParentApprove) {
        // NEVER redirect from auth routes - they handle their own navigation
        if (inAuthGroup) {
          return; // Exit immediately for auth routes
        }
        
        // Only redirect logged-in users away from splash/role-selection to tabs
        // But check for pending applications first
        if (user && (inSplash || inRoleSelection)) {
          // Check if they have a pending application first
          getNeighborApplicationByUserId(user.id)
            .then((application) => {
              if (application) {
                if (application.status === 'pending') {
                  setTimeout(() => {
                    router.replace({
                      pathname: '/auth/pending-neighbor-approval',
                      params: { applicationId: application.id }
                    });
                  }, 100);
                } else if (application.status === 'rejected') {
                  setTimeout(() => {
                    router.replace({
                      pathname: '/auth/neighbor-rejected',
                      params: { 
                        applicationId: application.id,
                        reason: application.rejection_reason || 'No reason provided'
                      }
                    });
                  }, 100);
                } else {
                  // Approved - go to home
                  setTimeout(() => {
                    router.replace('/(tabs)/home');
                  }, 100);
                }
              } else {
                // No application - normal user, go to home
                setTimeout(() => {
                  router.replace('/(tabs)/home');
                }, 100);
              }
            })
            .catch(() => {
              // Error checking application - just go to home
              setTimeout(() => {
                router.replace('/(tabs)/home');
              }, 100);
            });
        }
        // Otherwise, allow free navigation (no redirects)
        return;
      }
      
      // Protect main app (tabs) - only allow if user is logged in
      // BUT: Check for active session first - if session exists but no profile, check for pending application
      // Skip navigation if we're suppressing navigation (e.g., during OTP verification)
      const { suppressingNavigation } = useAuthStore.getState();
      if (inTabs) {
        if (!user && !isNavigating && !suppressingNavigation) {
          setIsNavigating(true);
          // Check if there's an active session but no profile (neighbor signup in progress)
          supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
              // User has session but no profile - check for pending application
              try {
                const application = await getNeighborApplicationByUserId(session.user.id);
                if (application) {
                  if (application.status === 'pending') {
                    router.replace({
                      pathname: '/auth/pending-neighbor-approval',
                      params: { applicationId: application.id }
                    });
                    setIsNavigating(false);
                    return;
                  } else if (application.status === 'rejected') {
                    router.replace({
                      pathname: '/auth/neighbor-rejected',
                      params: { 
                        applicationId: application.id,
                        reason: application.rejection_reason || 'No reason provided'
                      }
                    });
                    setIsNavigating(false);
                    return;
                  }
                }
                // No application or approved - redirect to splash to complete signup
                router.replace('/splash');
                setIsNavigating(false);
              } catch (appError) {
                // No application found or error - redirect to splash
                router.replace('/splash');
                setIsNavigating(false);
              }
            } else {
              // No session - redirect to splash
              router.replace('/splash');
              setIsNavigating(false);
            }
          });
        }
        // User is logged in and in tabs - allow access
        if (user) {
          setIsNavigating(false);
        }
        return;
      }
      
      // Reset navigating flag when not in tabs
      if (!inTabs && isNavigating) {
        setIsNavigating(false);
      }
      
      // For any other route, allow it (no restrictions)
      // This ensures auth flows can navigate freely
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [user, segments, loading, router]);

  // Don't show loading screen if we're navigating to an auth route or parent-approve
  // This prevents the white screen flash during navigation
  const isNavigatingToAuth = segments && segments.length > 0 && segments[0] === 'auth';
  const isNavigatingToParentApprove = segments && segments.length > 0 && segments[0] === 'parent-approve';
  
  if (loading && !isNavigatingToAuth && !isNavigatingToParentApprove) {
    return (
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          <Loading />
        </SafeAreaProvider>
      </QueryClientProvider>
    );
  }

  const stripePublishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  
  return (
    <StripeProvider 
      publishableKey={stripePublishableKey}
      urlScheme="ollie" // Required for 3D Secure redirects
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
          <View style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#111827' : '#ffffff' }}>
            <Slot />
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    </StripeProvider>
  );
}

