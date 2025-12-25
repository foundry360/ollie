import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { getPendingSignupByParentEmailAndBirthdate } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export default function CheckStatusScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const [parentEmail, setParentEmail] = useState('');
  const [birthdate, setBirthdate] = useState(['', '', '', '', '', '', '', '']); // MM/DD/YYYY
  const [storedBirthdate, setStoredBirthdate] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isLoadingBirthdate, setIsLoadingBirthdate] = useState(true);
  
  // Refs for birthdate inputs
  const birthdateRefs = useRef<(TextInput | null)[]>([]);

  // Load stored birthdate on mount
  useEffect(() => {
    const loadStoredBirthdate = async () => {
      try {
        const stored = await AsyncStorage.getItem('teen_birthdate');
        if (stored) {
          setStoredBirthdate(stored);
          // Parse and populate birthdate fields
          const date = new Date(stored);
          if (!isNaN(date.getTime())) {
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            const year = date.getFullYear().toString();
            setBirthdate([
              month[0], month[1],
              day[0], day[1],
              year[0], year[1], year[2], year[3]
            ]);
          }
        }
      } catch (error) {
        console.error('Error loading stored birthdate:', error);
      } finally {
        setIsLoadingBirthdate(false);
      }
    };
    loadStoredBirthdate();
  }, []);

  const handleBirthdateChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    
    const newBirthdate = [...birthdate];
    newBirthdate[index] = value;
    setBirthdate(newBirthdate);
    
    if (value && index < 7) {
      birthdateRefs.current[index + 1]?.focus();
    }
    
    if (value && index === 1) {
      birthdateRefs.current[2]?.focus();
    }
    if (value && index === 3) {
      birthdateRefs.current[4]?.focus();
    }
  };

  const handleBirthdateKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !birthdate[index] && index > 0) {
      birthdateRefs.current[index - 1]?.focus();
    }
  };

  const handleCheckStatus = async () => {
    if (!parentEmail || !parentEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid parent email address.');
      return;
    }

    // Use stored birthdate if available, otherwise validate input
    let birthdateString: string;
    
    if (storedBirthdate) {
      // Use stored birthdate
      const date = new Date(storedBirthdate);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      birthdateString = `${year}-${month}-${day}`;
    } else {
      // Validate birthdate input
      const month = birthdate[0] + birthdate[1];
      const day = birthdate[2] + birthdate[3];
      const year = birthdate[4] + birthdate[5] + birthdate[6] + birthdate[7];
      
      if (!month || !day || !year || month.length !== 2 || day.length !== 2 || year.length !== 4) {
        Alert.alert('Invalid Date', 'Please enter your complete birthdate (MM/DD/YYYY)');
        return;
      }
      
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const yearNum = parseInt(year, 10);
      
      if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
        Alert.alert('Invalid Date', 'Please enter a valid birthdate');
        return;
      }
      
      birthdateString = `${yearNum}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    }

    setIsChecking(true);

    try {
      // Check if user account exists (means it was approved)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Already logged in
        Alert.alert('Already Logged In', 'You are already logged in. Please log out to check a different account.');
        setIsChecking(false);
        return;
      }

      // Check pending signup status by parent email AND birthdate (any status)
      console.log('🔍 Checking status for parent email:', parentEmail, 'and birthdate:', birthdateString);
      const pendingSignup = await getPendingSignupByParentEmailAndBirthdate(parentEmail, birthdateString);
      
      console.log('📋 Status check result:', { 
        found: !!pendingSignup, 
        status: pendingSignup?.status,
        parentEmail: pendingSignup?.parent_email 
      });
      
      if (!pendingSignup) {
        console.warn('⚠️ No signup found for parent email:', parentEmail);
        Alert.alert(
          'No Request Found',
          'We couldn\'t find a pending approval request for this email. Please make sure you entered the correct parent email address.',
          [{ text: 'OK' }]
        );
        setIsChecking(false);
        return;
      }

      // Store parent email for persistence
      await AsyncStorage.setItem('pending_signup_parent_email', parentEmail);

      // Navigate based on status
      if (pendingSignup.status === 'pending') {
        router.replace(`/auth/pending-approval?parentEmail=${encodeURIComponent(parentEmail)}`);
      } else if (pendingSignup.status === 'approved') {
        // Approved, redirect to complete account screen
        await AsyncStorage.removeItem('pending_signup_parent_email');
        router.replace(`/auth/complete-account?parentEmail=${encodeURIComponent(parentEmail)}`);
      } else if (pendingSignup.status === 'rejected') {
        await AsyncStorage.removeItem('pending_signup_parent_email');
        Alert.alert(
          'Request Rejected',
          'Your parent has declined the account creation request. Please contact your parent if you have questions.',
          [{ text: 'OK', onPress: () => router.replace('/role-selection') }]
        );
      } else if (pendingSignup.status === 'expired') {
        await AsyncStorage.removeItem('pending_signup_parent_email');
        Alert.alert(
          'Request Expired',
          'The approval request has expired. Please start the signup process again.',
          [{ text: 'OK', onPress: () => router.replace('/role-selection') }]
        );
      }
    } catch (error: any) {
      console.error('Error checking status:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to check approval status. Please try again.'
      );
    } finally {
      setIsChecking(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            // Navigate back to role-selection as safe default
            router.replace('/role-selection');
          }}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
        </Pressable>

        <View style={styles.logoContainer}>
          <Image 
            source={require('@/assets/logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
          Check Approval Status
        </Text>
        
        <Text style={[styles.subtitle, subtitleStyle]}>
          {storedBirthdate 
            ? "Enter your parent's email address to check the status of your approval request."
            : "Enter your parent's email address and your birthdate to check the status of your approval request."
          }
        </Text>

        <Input
          label="Your Parent's Email"
          value={parentEmail}
          onChangeText={setParentEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="parent@example.com"
          style={styles.input}
        />

        {!storedBirthdate && (
          <>
            <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>
              Your Birthdate
            </Text>
            <View style={styles.birthdateContainer}>
              <View style={styles.birthdateInputs}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (birthdateRefs.current[index] = ref)}
                    style={[
                      styles.birthdateInput,
                      isDark && styles.birthdateInputDark,
                    ]}
                    value={birthdate[index]}
                    onChangeText={(value) => handleBirthdateChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleBirthdateKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>
              <View style={styles.birthdateLabels}>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>M</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>M</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>D</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>D</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>Y</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>Y</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>Y</Text>
                <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>Y</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.buttonContainer}>
          <Button
            title="Check Status"
            onPress={handleCheckStatus}
            loading={isChecking || isLoadingBirthdate}
            disabled={isChecking || isLoadingBirthdate || !parentEmail || (!storedBirthdate && birthdate.some(b => !b))}
            fullWidth
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    alignSelf: 'flex-start',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 0,
  },
  logo: {
    width: 150,
    height: 150,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  input: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  labelLight: {
    color: '#000000',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  birthdateContainer: {
    marginBottom: 24,
  },
  birthdateInputs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  birthdateInput: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    color: '#000000',
  },
  birthdateInputDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
  },
  birthdateLabels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 0,
  },
  birthdateLabel: {
    width: 40,
    textAlign: 'center',
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  birthdateLabelDark: {
    color: '#9CA3AF',
  },
  buttonContainer: {
    marginTop: 24,
  },
});

