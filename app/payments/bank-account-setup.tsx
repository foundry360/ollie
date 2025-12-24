import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { createBankAccount, getBankAccountApprovalStatus, type BankAccountApprovalStatus } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';

const bankAccountSchema = z.object({
  account_type: z.enum(['checking', 'savings']),
  routing_number: z.string()
    .min(9, 'Routing number must be 9 digits')
    .max(9, 'Routing number must be 9 digits')
    .regex(/^\d+$/, 'Routing number must contain only numbers'),
  account_number: z.string()
    .min(4, 'Account number must be at least 4 digits')
    .max(17, 'Account number must be less than 18 digits')
    .regex(/^\d+$/, 'Account number must contain only numbers'),
  confirm_account_number: z.string(),
  account_holder_name: z.string()
    .min(2, 'Account holder name must be at least 2 characters')
    .max(100, 'Account holder name is too long'),
}).refine((data) => data.account_number === data.confirm_account_number, {
  message: 'Account numbers do not match',
  path: ['confirm_account_number'],
});

type BankAccountFormData = z.infer<typeof bankAccountSchema>;

export default function BankAccountSetupScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState<BankAccountApprovalStatus | null>(null);

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: {
      account_type: 'checking',
      routing_number: '',
      account_number: '',
      confirm_account_number: '',
      account_holder_name: user?.full_name || '',
    },
  });

  const accountType = watch('account_type');

  // Check parent approval on mount
  useEffect(() => {
    const checkApproval = async () => {
      if (user?.role === 'teen' && user?.parent_id) {
        try {
          const status = await getBankAccountApprovalStatus();
          setApprovalStatus(status);
        } catch (error: any) {
          console.error('Error checking approval status:', error);
          setApprovalStatus({ status: 'none' });
        }
      }
      setCheckingApproval(false);
    };
    checkApproval();
  }, [user]);

  // Block access if parent approval is required but not completed
  const needsParentApproval = user?.parent_id != null;
  const hasApproval = !needsParentApproval || approvalStatus?.status === 'approved';

  const onSubmit = async (data: BankAccountFormData) => {
    // Double-check parent approval before submission
    if (needsParentApproval && !hasApproval) {
      Alert.alert(
        'Parent Approval Required',
        'You need your parent\'s approval before you can add a bank account. Please go back to Payment Setup to request approval.',
        [
          {
            text: 'Go Back',
            onPress: () => router.back(),
          },
        ]
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await createBankAccount({
        routing_number: data.routing_number,
        account_number: data.account_number,
        account_type: data.account_type,
        account_holder_name: data.account_holder_name,
      });

      if (result.bank_account.requires_verification) {
        Alert.alert(
          'Success',
          'Bank account added successfully. Please verify it with the micro-deposits we\'ll send to your account.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/payments/bank-account-verify');
              },
            },
          ]
        );
      } else {
        // Account was verified immediately (unlikely but possible)
        Alert.alert(
          'Success',
          'Bank account added and verified successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                router.back();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to add bank account';
      console.error('Error creating bank account:', error);
      
      // If error is about parent approval, show helpful message
      if (errorMessage.toLowerCase().includes('parent approval')) {
        Alert.alert(
          'Parent Approval Required',
          'You need your parent\'s approval before you can add a bank account. Please go back to Payment Setup to request approval.',
          [
            {
              text: 'Go Back',
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading while checking approval
  if (checkingApproval) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  // Show message if parent approval is needed but not completed
  if (needsParentApproval && !hasApproval) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.centered}>
            <Ionicons name="lock-closed" size={64} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
              Parent Approval Required
            </Text>
            <Text style={[styles.description, isDark ? styles.textDark : styles.textLight]}>
              You need your parent's approval before you can add a bank account. Please go back to Payment Setup to request approval.
            </Text>
            <View style={{ marginTop: 24, width: '100%' }}>
              <Button
                title="Go Back to Payment Setup"
                onPress={() => router.back()}
                fullWidth
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

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
            <Text style={[styles.screenTitle, titleStyle]}>Add Bank Account</Text>
          </View>

          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Account Information</Text>
            <Text style={[styles.sectionDescription, textStyle]}>
              Your bank account information is encrypted and secure. We use Stripe to process payments.
            </Text>

            {/* Account Type Selector */}
            <View style={styles.accountTypeContainer}>
              <Text style={[styles.label, textStyle]}>Account Type *</Text>
              <View style={styles.accountTypeButtons}>
                <Pressable
                  style={[
                    styles.accountTypeButton,
                    cardStyle,
                    accountType === 'checking' && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setValue('account_type', 'checking', { shouldValidate: true })}
                >
                  <Ionicons
                    name={accountType === 'checking' ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={accountType === 'checking' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                  />
                  <Text style={[styles.accountTypeText, textStyle, accountType === 'checking' && styles.accountTypeTextActive]}>Checking</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.accountTypeButton,
                    cardStyle,
                    accountType === 'savings' && styles.accountTypeButtonActive,
                  ]}
                  onPress={() => setValue('account_type', 'savings', { shouldValidate: true })}
                >
                  <Ionicons
                    name={accountType === 'savings' ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={accountType === 'savings' ? '#FFFFFF' : (isDark ? '#9CA3AF' : '#6B7280')}
                  />
                  <Text style={[styles.accountTypeText, textStyle, accountType === 'savings' && styles.accountTypeTextActive]}>Savings</Text>
                </Pressable>
              </View>
              {errors.account_type && (
                <Text style={styles.errorText}>{errors.account_type.message}</Text>
              )}
            </View>

            {/* Routing Number */}
            <Controller
              control={control}
              name="routing_number"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Routing Number"
                  value={value}
                  onChangeText={(text) => {
                    // Only allow digits, max 9
                    const cleaned = text.replace(/\D/g, '').slice(0, 9);
                    onChange(cleaned);
                  }}
                  onBlur={onBlur}
                  error={errors.routing_number?.message}
                  required
                  placeholder="123456789"
                  keyboardType="number-pad"
                  maxLength={9}
                />
              )}
            />

            {/* Account Number */}
            <Controller
              control={control}
              name="account_number"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Account Number"
                  value={value}
                  onChangeText={(text) => {
                    // Only allow digits, max 17
                    const cleaned = text.replace(/\D/g, '').slice(0, 17);
                    onChange(cleaned);
                  }}
                  onBlur={onBlur}
                  error={errors.account_number?.message}
                  required
                  placeholder="Enter your account number"
                  keyboardType="number-pad"
                  secureTextEntry={true}
                  maxLength={17}
                />
              )}
            />

            {/* Confirm Account Number */}
            <Controller
              control={control}
              name="confirm_account_number"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm Account Number"
                  value={value}
                  onChangeText={(text) => {
                    // Only allow digits, max 17
                    const cleaned = text.replace(/\D/g, '').slice(0, 17);
                    onChange(cleaned);
                  }}
                  onBlur={onBlur}
                  error={errors.confirm_account_number?.message}
                  required
                  placeholder="Re-enter your account number"
                  keyboardType="number-pad"
                  secureTextEntry={true}
                  maxLength={17}
                />
              )}
            />

            {/* Account Holder Name */}
            <Controller
              control={control}
              name="account_holder_name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Account Holder Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.account_holder_name?.message}
                  required
                  placeholder="John Doe"
                  autoCapitalize="words"
                />
              )}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color="#F59E0B" />
              <Text style={[styles.infoText, textStyle]}>
                After submitting, we'll send two small test deposits to verify your account. This usually takes 1-2 business days.
              </Text>
            </View>

            <Button
              title="Add Bank Account"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              disabled={isSubmitting}
              fullWidth
            />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
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
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  subtitleLight: {
    color: '#6B7280',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  accountTypeContainer: {
    marginBottom: 12,
  },
  accountTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  accountTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  accountTypeButtonActive: {
    borderColor: '#73af17',
    backgroundColor: '#73af17',
  },
  accountTypeText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  accountTypeTextActive: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 8,
    flex: 1,
  },
});

