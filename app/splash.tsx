import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/stores/themeStore';
import { getPendingSignupByParentEmail } from '@/lib/supabase';

export default function SplashScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkPendingSignup = async () => {
      try {
        // Check if there's a stored parent email from a previous signup request
        const storedParentEmail = await AsyncStorage.getItem('pending_signup_parent_email');
        
        if (storedParentEmail) {
          // Check if there's still a pending signup
          const pendingSignup = await getPendingSignupByParentEmail(storedParentEmail);
          
          if (pendingSignup && pendingSignup.status === 'pending') {
            // Still pending, redirect to pending approval screen
            setIsChecking(false);
            router.replace(`/auth/pending-approval?parentEmail=${encodeURIComponent(storedParentEmail)}`);
            return;
          } else if (pendingSignup && pendingSignup.status === 'approved') {
            // Approved, redirect to complete account screen
            setIsChecking(false);
            router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(storedParentEmail)}`);
            return;
          } else if (pendingSignup && (pendingSignup.status === 'rejected' || pendingSignup.status === 'expired')) {
            // Rejected or expired, clear storage and go to role selection
            await AsyncStorage.removeItem('pending_signup_parent_email');
            setIsChecking(false);
            router.replace('/role-selection');
            return;
          } else {
            // No pending signup found, clear storage
            await AsyncStorage.removeItem('pending_signup_parent_email');
          }
        }
      } catch (error) {
        console.error('Error checking pending signup:', error);
        // On error, just continue to role selection
      }
      
      // No pending signup or error, go to role selection
      setIsChecking(false);
      router.replace('/role-selection');
    };

    // Show splash for 2 seconds, then check for pending signup
    const timer = setTimeout(() => {
      checkPendingSignup();
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <LinearGradient
      colors={['#1e3a5f', '#2d4a6f', '#111827']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.tagline}>
              Connecting teens with neighbors
            </Text>
          </View>
          <ActivityIndicator 
            size="large" 
            color="#FFFFFF" 
            style={styles.loader}
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  loader: {
    marginTop: 32,
  },
});

