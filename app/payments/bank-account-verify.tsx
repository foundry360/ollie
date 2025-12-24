import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { verifyBankAccount, resendMicroDeposits } from '@/lib/api/payments';

const verificationSchema = z.object({
  amount1: z.string()
    .regex(/^\d+\.?\d{0,2}$/, 'Enter a valid amount (e.g., 0.32)')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num < 1;
    }, 'Amount must be between $0.01 and $0.99'),
  amount2: z.string()
    .regex(/^\d+\.?\d{0,2}$/, 'Enter a valid amount (e.g., 0.45)')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num < 1;
    }, 'Amount must be between $0.01 and $0.99'),
}).refine((data) => {
  const amount1 = parseFloat(data.amount1);
  const amount2 = parseFloat(data.amount2);
  return amount1 !== amount2;
}, {
  message: 'Amounts must be different',
  path: ['amount2'],
});

type VerificationFormData = z.infer<typeof verificationSchema>;

export default function BankAccountVerifyScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      amount1: '',
      amount2: '',
    },
  });

  const onSubmit = async (data: VerificationFormData) => {
    setIsSubmitting(true);
    try {
      const result = await verifyBankAccount(data.amount1, data.amount2);
      
              Alert.alert(
                'Account Verified!',
                'Your bank account has been verified successfully. You can now receive payments.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/(tabs)/payment-setup');
                    },
                  },
                ]
              );
              // Refresh the payment setup screen to show updated status
              // The useEffect in payment-setup.tsx will reload the data
    } catch (error: any) {
      Alert.alert('Verification Failed', error.message || 'The amounts you entered do not match. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendDeposits = async () => {
    Alert.alert(
      'Resend Verification Deposits',
      'This will remove your current bank account. You\'ll need to add it again with the same details to receive new verification deposits. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Continue',
          onPress: async () => {
            setIsResending(true);
            try {
              const result = await resendMicroDeposits();
              Alert.alert(
                'Account Removed',
                result.message,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Navigate back to bank account setup to add the account again
                      router.replace('/payments/bank-account-setup');
                    },
                  },
                ]
              );
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to resend deposits. Please try again.');
            } finally {
              setIsResending(false);
            }
          },
        },
      ]
    );
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
            </Pressable>
            <Text style={[styles.screenTitle, titleStyle]}>Verify Bank Account</Text>
          </View>

          <View style={[styles.section, cardStyle]}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle-outline" size={64} color="#73af17" />
            </View>
            
            <Text style={[styles.sectionTitle, titleStyle]}>Check Your Bank Account</Text>
            
            <Text style={[styles.description, textStyle]}>
              We've sent two small test deposits to your bank account. Check your bank statement or online banking for deposits from "Ollie" or "STRIPE".
            </Text>

            <View style={[styles.infoBox, isDark ? styles.infoBoxDark : styles.infoBoxLight]}>
              <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
              <Text style={[styles.infoText, textStyle]}>
                The deposits are usually between $0.01 and $0.99 and should arrive within 1-2 business days.
              </Text>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formTitle, titleStyle]}>Enter Deposit Amounts</Text>
              <Text style={[styles.formDescription, textStyle]}>
                Enter the exact amounts of the two deposits (without the dollar sign)
              </Text>

              {/* First Deposit Amount */}
              <View style={styles.amountInputContainer}>
                <Text style={[styles.label, textStyle]}>First Deposit Amount *</Text>
                <View style={[styles.amountInputWrapper, isDark ? styles.amountInputWrapperDark : styles.amountInputWrapperLight]}>
                  <Text style={[styles.dollarSign, textStyle]}>$</Text>
                  <Controller
                    control={control}
                    name="amount1"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label=""
                        value={value}
                        onChangeText={(text) => {
                          // Allow digits and one decimal point
                          const cleaned = text
                            .replace(/[^\d.]/g, '') // Remove non-digits and non-dots
                            .replace(/\.+/g, '.') // Replace multiple dots with one
                            .replace(/(\.\d{2})\d+/, '$1'); // Limit to 2 decimal places
                          onChange(cleaned);
                        }}
                        onBlur={onBlur}
                        error={errors.amount1?.message}
                        placeholder="0.32"
                        keyboardType="decimal-pad"
                        style={styles.amountInput}
                      />
                    )}
                  />
                </View>
                {errors.amount1 && (
                  <Text style={styles.errorText}>{errors.amount1.message}</Text>
                )}
              </View>

              {/* Second Deposit Amount */}
              <View style={styles.amountInputContainer}>
                <Text style={[styles.label, textStyle]}>Second Deposit Amount *</Text>
                <View style={[styles.amountInputWrapper, isDark ? styles.amountInputWrapperDark : styles.amountInputWrapperLight]}>
                  <Text style={[styles.dollarSign, textStyle]}>$</Text>
                  <Controller
                    control={control}
                    name="amount2"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input
                        label=""
                        value={value}
                        onChangeText={(text) => {
                          // Allow digits and one decimal point
                          const cleaned = text
                            .replace(/[^\d.]/g, '') // Remove non-digits and non-dots
                            .replace(/\.+/g, '.') // Replace multiple dots with one
                            .replace(/(\.\d{2})\d+/, '$1'); // Limit to 2 decimal places
                          onChange(cleaned);
                        }}
                        onBlur={onBlur}
                        error={errors.amount2?.message}
                        placeholder="0.45"
                        keyboardType="decimal-pad"
                        style={styles.amountInput}
                      />
                    )}
                  />
                </View>
                {errors.amount2 && (
                  <Text style={styles.errorText}>{errors.amount2.message}</Text>
                )}
              </View>

              <Button
                title="Verify Account"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                fullWidth
              />

              <Pressable 
                onPress={handleResendDeposits} 
                disabled={isResending}
                style={styles.resendButton}
              >
                <Text style={[styles.resendText, textStyle]}>
                  {isResending ? 'Resending...' : "Didn't receive deposits? Resend"}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  iconContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
    color: '#111827',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  infoBoxLight: {
    backgroundColor: '#FEF3C7',
  },
  infoBoxDark: {
    backgroundColor: '#374151',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
  formSection: {
    width: '100%',
    marginTop: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  formDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    color: '#6B7280',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  amountInputContainer: {
    marginBottom: 12,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    minHeight: 50,
  },
  amountInputWrapperLight: {
    borderColor: '#D1D5DB',
    backgroundColor: 'transparent',
  },
  amountInputWrapperDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  dollarSign: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
    color: '#111827',
  },
  amountInput: {
    flex: 1,
    borderWidth: 0,
    padding: 0,
    margin: 0,
    minHeight: 0,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#73af17',
    textDecorationLine: 'underline',
  },
});

