import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.content}>
        <View style={[styles.logoContainer, isDark && styles.logoContainerDark]}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, isDark && styles.taglineDark]}>
            Connecting teens with neighbors
          </Text>
        </View>
        <ActivityIndicator 
          size="large" 
          color="#73af17" 
          style={styles.loader}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  containerDark: {
    backgroundColor: '#000000',
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
  logoContainerDark: {
    // Same for dark mode
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 18,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  taglineDark: {
    color: '#9CA3AF',
  },
  loader: {
    marginTop: 32,
  },
});

