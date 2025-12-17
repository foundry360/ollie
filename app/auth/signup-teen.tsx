import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useSignupStore } from '@/stores/signupStore';
import { createPendingTeenSignup, sendParentApprovalEmail, signInWithGoogle, signInWithApple } from '@/lib/supabase';
import { UserRole } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const signupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  date_of_birth: z.date({
    required_error: 'Date of birth is required',
  }),
  parent_email: z.string().email('Please enter a valid parent email address'),
});

type SignupFormData = z.infer<typeof signupSchema>;

type OnboardingStep = 'age' | 'details';

export default function SignupTeenScreen() {
  const router = useRouter();
  const { setUser, setLoading } = useAuthStore();
  const { currentStep, setCurrentStep } = useSignupStore();
  const { colorScheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [birthdate, setBirthdate] = useState(['', '', '', '', '', '', '', '']); // MM/DD/YYYY
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Reset step when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Only reset if navigating away from the screen entirely
      // Don't reset on re-renders within the same screen
    };
  }, []);

  // Debug: Log step changes and component mounts
  useEffect(() => {
    console.log('SignupTeenScreen mounted/updated, current step:', currentStep);
    return () => {
      console.log('SignupTeenScreen unmounting, current step was:', currentStep);
    };
  }, [currentStep]);
  
  useEffect(() => {
    console.log('SignupTeenScreen component mounted, initial step:', currentStep);
    return () => {
      console.log('SignupTeenScreen component unmounting');
    };
  }, []);

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      full_name: '',
      date_of_birth: new Date(2005, 0, 1),
      parent_email: '',
    },
  });


  const calculateAgeLocal = (birthdate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
    return age;
  };

  const handleBirthdateChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;
    
    const newBirthdate = [...birthdate];
    newBirthdate[index] = value;
    setBirthdate(newBirthdate);
    
    // Auto-advance to next input
    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-format with slashes
    if (value && index === 1) {
      // After month (MM), add slash
      inputRefs.current[2]?.focus();
    }
    if (value && index === 3) {
      // After day (DD), add slash
      inputRefs.current[4]?.focus();
    }
  };

  const handleBirthdateKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !birthdate[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleAgeContinue = () => {
    console.log('handleAgeContinue called, current step:', currentStep);
    
    // Parse birthdate from input boxes
    const month = birthdate[0] + birthdate[1];
    const day = birthdate[2] + birthdate[3];
    const year = birthdate[4] + birthdate[5] + birthdate[6] + birthdate[7];
    
    if (!month || !day || !year || month.length !== 2 || day.length !== 2 || year.length !== 4) {
      Alert.alert('Invalid Date', 'Please enter a complete birthdate (MM/DD/YYYY)');
      return;
    }
    
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      Alert.alert('Invalid Date', 'Please enter a valid birthdate');
      return;
    }
    
    const birthDate = new Date(yearNum, monthNum - 1, dayNum);
    const age = calculateAgeLocal(birthDate);
    
    console.log('Age calculated:', age, 'Birthdate:', birthDate);
    
    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to use Ollie.');
      return;
    }
    if (age >= 18) {
      Alert.alert('Age Limit', 'Teens must be under 18. Please use the adult signup.');
      router.replace('/role-selection');
      return;
    }
    
      // Set the date in the form first
      setValue('date_of_birth', birthDate, { shouldValidate: false });
      console.log('Setting date_of_birth in form');
      
      // Update step to show request approval form using store (persists across remounts)
      console.log('Setting currentStep to details, current step:', currentStep);
      setCurrentStep('details');
      console.log('setCurrentStep called with "details"');
  };

  const onSubmit = async (data: SignupFormData) => {
    const age = calculateAgeLocal(data.date_of_birth);
    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to use Ollie.');
      return;
    }
    if (age >= 18) {
      Alert.alert('Age Limit', 'Teens must be under 18. Please use the adult signup.');
      router.replace('/role-selection');
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // Create pending signup (doesn't create account yet)
      const pendingSignup = await createPendingTeenSignup({
        email: data.email,
        full_name: data.full_name,
        password: data.password,
        date_of_birth: data.date_of_birth.toISOString().split('T')[0],
        parent_email: data.parent_email,
      });

      // Send approval email to parent
      await sendParentApprovalEmail(
        data.parent_email,
        pendingSignup.approval_token,
        {
          teenName: data.full_name,
          teenAge: age,
          teenEmail: data.email,
        }
      );

      // Redirect to pending approval screen
      router.replace(`/auth/pending-approval?email=${encodeURIComponent(data.email)}&parentEmail=${encodeURIComponent(data.parent_email)}`);
    } catch (error: any) {
      console.error('Signup error:', error);
      Alert.alert(
        'Signup Failed',
        error.message || 'Failed to submit signup request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  const linkTextStyle = isDark ? styles.linkTextDark : styles.linkTextLight;

  // Age Gate Step
  if (currentStep === 'age') {
    console.log('Rendering age gate step');
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']} key="age-gate">
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
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
          <Text style={[styles.subtitle, subtitleStyle]}>
            To get started, we need to verify your age for safety.
          </Text>
          <Text style={[styles.label, labelStyle]}>What's your birthdate?</Text>
          
          <View style={styles.birthdateContainer}>
            <View style={styles.birthdateInputs}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                <TextInput
                  key={index}
                  ref={(ref) => (inputRefs.current[index] = ref)}
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
            <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>
              MM/DD/YYYY
            </Text>
          </View>
          
          <Button
            title="Continue"
            onPress={handleAgeContinue}
            fullWidth
          />
          
          <Text style={[styles.footer, subtitleStyle]}>
            By continuing, you agree to our Terms and Privacy Policy.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Signup Details Step
  console.log('Rendering details step');
  return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']} key="details-form">
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => setCurrentStep('age')}
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
        <Text style={[styles.subtitle, subtitleStyle]}>
          Signup with Ollie for free
        </Text>

        <Controller
          control={control}
          name="full_name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Full Name"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.full_name?.message}
              required
              autoCapitalize="words"
            />
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              required
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
            />
          )}
        />

        <Controller
          control={control}
          name="parent_email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Parent Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.parent_email?.message}
              required
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="parent@example.com"
            />
          )}
        />

        <Button
          title="Create Account"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />

        <View style={styles.loginLink}>
          <Text
            style={[styles.loginLinkText, linkTextStyle]}
            onPress={() => router.push('/auth/login')}
          >
            Already have an account? Login
          </Text>
        </View>

        <View style={[styles.divider, isDark && styles.dividerDark]}>
          <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
          <Text style={[styles.dividerText, isDark && styles.dividerTextDark]}>OR</Text>
          <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
        </View>

        <View style={styles.socialButtons}>
          <Pressable
            style={[styles.socialButton, isDark && styles.socialButtonDark]}
            onPress={async () => {
              try {
                await signInWithGoogle();
                // OAuth will redirect, so we don't need to handle the response here
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to sign in with Google');
              }
            }}
          >
            <Ionicons name="logo-google" size={20} color={isDark ? '#9CA3AF' : '#666666'} />
            <Text style={[styles.socialButtonText, isDark && styles.socialButtonTextDark]}>
              Google
            </Text>
          </Pressable>

          <Pressable
            style={[styles.socialButton, isDark && styles.socialButtonDark]}
            onPress={async () => {
              try {
                await signInWithApple();
                // OAuth will redirect, so we don't need to handle the response here
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Failed to sign in with Apple');
              }
            }}
          >
            <Ionicons name="logo-apple" size={20} color={isDark ? '#9CA3AF' : '#666666'} />
            <Text style={[styles.socialButtonText, isDark && styles.socialButtonTextDark]}>
              Apple
            </Text>
          </Pressable>
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
    backgroundColor: '#000000',
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    paddingTop: 0,
  },
  logo: {
    width: 180,
    height: 180,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#73af17',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: '#73af17',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
  title: {
    fontSize: 28,
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
    marginBottom: 12,
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  labelLight: {
    color: '#000000',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  required: {
    color: '#DC2626',
  },
  birthdateContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  birthdateInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 4,
  },
  birthdateInput: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    backgroundColor: 'transparent',
    color: '#111827',
  },
  birthdateInputDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
  },
  birthdateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  birthdateLabelDark: {
    color: '#9CA3AF',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
    minHeight: 54,
    gap: 8,
  },
  socialButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  socialButtonTextDark: {
    color: '#9CA3AF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  dividerDark: {
    // Same styling for dark mode
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerLineDark: {
    backgroundColor: '#4B5563',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  dividerTextDark: {
    color: '#9CA3AF',
  },
  loginLink: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  loginLinkText: {
    fontSize: 14,
  },
  linkTextLight: {
    color: '#73af17',
  },
  linkTextDark: {
    color: '#73af17',
  },
});
