import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase, getUserProfile, createUserProfile } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { UserRole } from '@/types';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the session from the OAuth callback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          router.replace('/auth/login');
          return;
        }

        if (!session?.user) {
          console.error('No user in session');
          router.replace('/auth/login');
          return;
        }

        const user = session.user;

        // Check if user profile exists
        let profile;
        try {
          profile = await getUserProfile(user.id);
        } catch (error) {
          // Profile doesn't exist, create it for OAuth users
          console.log('Profile not found, creating new profile for OAuth user');
          
          // Extract user info from OAuth metadata
          const userMetadata = user.user_metadata || {};
          const fullName = userMetadata.full_name || 
                          userMetadata.name || 
                          `${userMetadata.first_name || ''} ${userMetadata.last_name || ''}`.trim() ||
                          user.email?.split('@')[0] ||
                          'User';
          
          const email = user.email || userMetadata.email;
          
          if (!email) {
            throw new Error('Email is required');
          }

          // Determine role - default to 'poster' for OAuth signups (neighbors)
          // If they came from teen signup flow, it would be handled differently
          const role = UserRole.POSTER;

          // Create user profile
          await createUserProfile(user.id, {
            email,
            full_name: fullName,
            role,
          });

          // Fetch the newly created profile
          profile = await getUserProfile(user.id);
        }

        // Set user in auth store
        setUser(profile);
        setLoading(false);

        // Redirect to main app
        router.replace('/(tabs)/home');
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setLoading(false);
        router.replace('/auth/login');
      }
    };

    handleAuthCallback();
  }, [router, setUser, setLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#73af17" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

