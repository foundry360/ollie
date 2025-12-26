import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { updateNeighborApplication } from '@/lib/api/neighborApplications';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const applicationSchema = z.object({
  address: z.string().min(3, 'Please enter a valid street address'),
  city: z.string().min(2, 'Please enter a valid city'),
  state: z.string().length(2, 'Please enter a 2-letter state code (e.g., CA, NY)'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Please enter a valid ZIP code (5 digits or 5+4 format)'),
  date_of_birth: z.string().refine((val) => {
    // Validate MM/DD/YYYY format
    const parts = val.split('/');
    if (parts.length !== 3) return false;
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > new Date().getFullYear()) {
      return false;
    }
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;
    return actualAge >= 18;
  }, 'You must be at least 18 years old to sign up as a neighbor'),
});

type ApplicationFormData = z.infer<typeof applicationSchema>;

export default function NeighborApplicationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ applicationId?: string }>();
  const { 
    applicationId: storeApplicationId,
    address: storeAddress,
    date_of_birth: storeDOB,
    setApplicationData,
    setCurrentStep 
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [birthdate, setBirthdate] = useState(['', '', '', '', '', '', '', '']); // MM/DD/YYYY
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const applicationId = params.applicationId || storeApplicationId;

  // Parse stored address if it exists (format: "address, city, state zip")
  const parseStoredAddress = () => {
    if (!storeAddress) return { address: '', city: '', state: '', zipCode: '' };
    
    // Try to parse "address, city, state zip" format
    const parts = storeAddress.split(',').map(s => s.trim());
    if (parts.length >= 3) {
      const address = parts[0];
      const city = parts[1];
      const stateZip = parts[2].split(' ');
      const state = stateZip[0] || '';
      const zipCode = stateZip.slice(1).join('') || '';
      return { address, city, state, zipCode };
    }
    return { address: storeAddress, city: '', state: '', zipCode: '' };
  };

  // Parse stored DOB if it exists
  const parseStoredDOB = () => {
    if (!storeDOB) return '';
    try {
      const date = new Date(storeDOB);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = String(date.getFullYear());
      return `${month}/${day}/${year}`;
    } catch {
      return '';
    }
  };

  const storedAddress = parseStoredAddress();
  const storedDOBString = parseStoredDOB();

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<ApplicationFormData>({
    resolver: zodResolver(applicationSchema),
    defaultValues: {
      address: storedAddress.address,
      city: storedAddress.city,
      state: storedAddress.state,
      zipCode: storedAddress.zipCode,
      date_of_birth: storedDOBString,
    },
  });

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
      // After month (MM), focus to day
      inputRefs.current[2]?.focus();
    }
    if (value && index === 3) {
      // After day (DD), focus to year
      inputRefs.current[4]?.focus();
    }

    // Update form value
    const month = newBirthdate[0] + newBirthdate[1];
    const day = newBirthdate[2] + newBirthdate[3];
    const year = newBirthdate[4] + newBirthdate[5] + newBirthdate[6] + newBirthdate[7];
    
    if (month.length === 2 && day.length === 2 && year.length === 4) {
      setValue('date_of_birth', `${month}/${day}/${year}`, { shouldValidate: true });
    } else {
      setValue('date_of_birth', '', { shouldValidate: false });
    }
  };

  const handleBirthdateKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !birthdate[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Initialize birthdate from stored value
  useEffect(() => {
    if (storedDOBString) {
      const parts = storedDOBString.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0').split('');
        const day = parts[1].padStart(2, '0').split('');
        const year = parts[2].split('');
        setBirthdate([...month, ...day, ...year].slice(0, 8));
      }
    }
  }, [storedDOBString]);

  const onSubmit = async (data: ApplicationFormData) => {
    if (!applicationId) {
      Alert.alert('Error', 'Application ID is missing. Please start over.');
      router.replace('/auth/signup-adult');
      return;
    }

    // Validate date of birth format
    const dobParts = data.date_of_birth.split('/');
    if (dobParts.length !== 3) {
      Alert.alert('Invalid Date', 'Please enter a complete birthdate (MM/DD/YYYY)');
      return;
    }

    const monthNum = parseInt(dobParts[0], 10);
    const dayNum = parseInt(dobParts[1], 10);
    const yearNum = parseInt(dobParts[2], 10);

    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      Alert.alert('Invalid Date', 'Please enter a valid birthdate');
      return;
    }

    const birthDate = new Date(yearNum, monthNum - 1, dayNum);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();
    const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

    if (actualAge < 18) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to sign up as a neighbor.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Format date as YYYY-MM-DD
      const dobString = birthDate.toISOString().split('T')[0];

      // Combine address fields into a single string: "address, city, state zip"
      const fullAddress = `${data.address}, ${data.city}, ${data.state} ${data.zipCode}`;

      // Update application with address and DOB
      await updateNeighborApplication(applicationId, {
        address: fullAddress,
        date_of_birth: dobString,
      });

      // Store in signup store
      setApplicationData({
        address: fullAddress,
        date_of_birth: dobString,
      });
      setCurrentStep('id-verification');

      // Redirect to ID verification screen
      router.replace({
        pathname: '/auth/verify-id',
        params: { applicationId }
      });
    } catch (error: any) {
      console.error('Error submitting application:', error);
      Alert.alert(
        'Submission Failed',
        error.message || 'Failed to submit application. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
          </Pressable>

          <View style={styles.logoContainer}>
            <Image 
              source={isDark ? require('@/assets/logo.png') : require('@/assets/logo-dark.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.stepTracker}>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, isDark && styles.stepNumberDark]}>
                <Text style={[styles.stepNumberText, isDark && styles.stepNumberTextDark]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Account Info</Text>
            </View>
            
            <View style={[styles.stepConnector, isDark && styles.stepConnectorDark]} />
            
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberActive]}>
                <Text style={styles.stepNumberTextActive}>2</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Address Info</Text>
            </View>
            
            <View style={[styles.stepConnector, isDark && styles.stepConnectorDark]} />
            
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, isDark && styles.stepNumberDark]}>
                <Text style={[styles.stepNumberText, isDark && styles.stepNumberTextDark]}>3</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Verify ID</Text>
            </View>
          </View>

          <Text style={[styles.title, titleStyle]}>Address & Age Verification</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>
            Please provide your address and date of birth to proceed with your neighbor application.
          </Text>

          <Controller
            control={control}
            name="address"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Street Address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.address?.message}
                required
                autoCapitalize="words"
                placeholder="123 Main St"
                style={{ letterSpacing: 0 }}
              />
            )}
          />

          <View style={styles.addressRow}>
            <View style={styles.addressRowItem}>
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="City"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.city?.message}
                    required
                    autoCapitalize="words"
                    placeholder="City"
                  />
                )}
              />
            </View>
            <View style={[styles.addressRowItem, styles.stateItem]}>
              <Controller
                control={control}
                name="state"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="State"
                    value={value.toUpperCase()}
                    onChangeText={(text) => onChange(text.toUpperCase().slice(0, 2))}
                    onBlur={onBlur}
                    error={errors.state?.message}
                    required
                    autoCapitalize="characters"
                    placeholder="CA"
                    maxLength={2}
                  />
                )}
              />
            </View>
            <View style={[styles.addressRowItem, styles.zipItem]}>
              <Controller
                control={control}
                name="zipCode"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="ZIP Code"
                    value={value}
                    onChangeText={(text) => onChange(text.replace(/[^\d-]/g, '').slice(0, 10))}
                    onBlur={onBlur}
                    error={errors.zipCode?.message}
                    required
                    keyboardType="number-pad"
                    placeholder="12345"
                    maxLength={10}
                  />
                )}
              />
            </View>
          </View>

          <View style={styles.dateContainer}>
            <Text style={[styles.label, isDark && styles.labelDark]}>
              Date of Birth <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.birthdateContainer}>
              <View style={styles.birthdateInputs}>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (inputRefs.current[index] = ref)}
                    style={[
                      styles.birthdateInput,
                      isDark && styles.birthdateInputDark,
                      errors.date_of_birth && styles.birthdateInputError
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
            {errors.date_of_birth && (
              <Text style={styles.errorText}>{errors.date_of_birth.message}</Text>
            )}
          </View>

          <Button
            title="Continue"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardAvoidingView: {
    flex: 1,
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
    marginBottom: 16,
    marginTop: 0,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
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
    textAlign: 'left',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  addressRowItem: {
    flex: 1,
  },
  stateItem: {
    flex: 0.6,
  },
  zipItem: {
    flex: 0.8,
  },
  dateContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  labelDark: {
    color: '#D1D5DB',
  },
  required: {
    color: '#DC2626',
  },
  birthdateContainer: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  birthdateInputs: {
    flexDirection: 'row',
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
    backgroundColor: 'transparent',
    color: '#111827',
  },
  birthdateInputDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
  },
  birthdateInputError: {
    borderColor: '#DC2626',
  },
  birthdateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  birthdateLabelDark: {
    color: '#9CA3AF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 20,
  },
  stepTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNumberActive: {
    backgroundColor: '#73af17',
  },
  stepNumberDark: {
    backgroundColor: '#4B5563',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepNumberTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepNumberTextDark: {
    color: '#9CA3AF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 60,
  },
  stepLabelDark: {
    color: '#9CA3AF',
  },
  stepConnector: {
    width: 24,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
    marginBottom: 24,
  },
  stepConnectorDark: {
    backgroundColor: '#4B5563',
  },
});
