import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Pressable, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPendingSignupByParentEmail } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Animation values
  const translateX = useRef(new Animated.Value(-300)).current;
  const translateY = useRef(new Animated.Value(-300)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Spiral in animation - logo spirals in with rotation
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGetStarted = async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      // Check if there's a stored parent email from a previous signup request
      const storedParentEmail = await AsyncStorage.getItem('pending_signup_parent_email');
      
      if (storedParentEmail) {
        // Check if there's still a pending signup
        const pendingSignup = await getPendingSignupByParentEmail(storedParentEmail);
        
        if (pendingSignup && pendingSignup.status === 'pending') {
          // Still pending, redirect to pending approval screen
          router.replace(`/auth/pending-approval?parentEmail=${encodeURIComponent(storedParentEmail)}`);
          return;
        } else if (pendingSignup && pendingSignup.status === 'approved') {
          // Approved, redirect to complete account screen
          router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(storedParentEmail)}`);
          return;
        } else if (pendingSignup && (pendingSignup.status === 'rejected' || pendingSignup.status === 'expired')) {
          // Rejected or expired, clear storage and go to role selection
          await AsyncStorage.removeItem('pending_signup_parent_email');
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
    router.replace('/role-selection');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Half circle background */}
        <View style={styles.halfCircle} />
        
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Animated.View
              style={{
                transform: [
                  { translateX: translateX },
                  { translateY: translateY },
                  {
                    rotate: rotateAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '720deg'],
                    }),
                  },
                  { scale: scaleAnim },
                ],
                opacity: opacityAnim,
              }}
            >
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </Animated.View>
          </View>
        </View>
        
        <View style={styles.bottomSection}>
          <View style={styles.taglineContainer}>
            <Text style={styles.tagline}>
              Built for <Text style={styles.highlight}>Teens</Text>.
            </Text>
            <Text style={styles.tagline}>
              Trusted by <Text style={styles.highlight}>Parents</Text>.
            </Text>
            <Text style={styles.tagline}>
              Powered by <Text style={styles.highlight}>Community</Text>.
            </Text>
            <Text style={styles.subtitle}>
              The safe way for teens to earn and neighbors to get the help they need
            </Text>
          </View>
          <View style={styles.buttonContainer}>
            <Pressable
              style={styles.button}
              onPress={handleGetStarted}
              disabled={isNavigating}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 0,
  },
  halfCircle: {
    position: 'absolute',
    top: 0,
    left: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.3,
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: 'rgba(30, 58, 138, 0.25)',
    borderBottomLeftRadius: SCREEN_WIDTH,
    borderBottomRightRadius: SCREEN_WIDTH,
    zIndex: 0,
  },
  topSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
  },
  logoContainer: {
    alignItems: 'center',
  },
  bottomSection: {
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    paddingBottom: 20,
    marginTop: -100,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 16,
  },
  taglineContainer: {
    marginBottom: 48,
    marginTop: -80,
  },
  tagline: {
    fontSize: 28,
    color: '#FFFFFF',
    textAlign: 'left',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'left',
    marginTop: 16,
    opacity: 0.8,
  },
  highlight: {
    color: '#73af17',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});


