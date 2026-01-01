import { useState, useRef } from 'react';
import { View, Text, StyleSheet, Alert, Platform, Image } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createSetupIntent, addPaymentMethod, getPaymentMethods } from '@/lib/api/payments';

// Conditionally import Stripe components - only on native platforms
let CardField: any;
let useStripe: any;

if (Platform.OS !== 'web') {
  try {
    const stripeModule = require('@stripe/stripe-react-native');
    CardField = stripeModule.CardField;
    useStripe = stripeModule.useStripe;
  } catch (e) {
    // Native module not available
    CardField = null;
    useStripe = () => ({
      createPaymentMethod: () => Promise.resolve({ error: { code: 'NativeModuleNotAvailable' } }),
      confirmSetupIntent: () => Promise.resolve({ error: { code: 'NativeModuleNotAvailable' } }),
    });
  }
} else {
  CardField = null;
  useStripe = () => ({
    createPaymentMethod: () => Promise.resolve({ error: { code: 'WebNotSupported' } }),
    confirmSetupIntent: () => Promise.resolve({ error: { code: 'WebNotSupported' } }),
  });
}

interface AddPaymentMethodModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPaymentMethodModal({ visible, onClose, onSuccess }: AddPaymentMethodModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardDetails, setCardDetails] = useState<{
    complete: boolean;
    brand?: string;
    last4?: string;
    expiryMonth?: number;
    expiryYear?: number;
  } | null>(null);
  const [billingName, setBillingName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingZip, setBillingZip] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const stripe = useStripe();
  const cardFieldRef = useRef<any>(null);

  const handleSubmit = async () => {
    if (!cardDetails?.complete) {
      Alert.alert('Invalid Card', 'Please enter a valid card number');
      return;
    }

    if (!billingName.trim()) {
      Alert.alert('Required Field', 'Please enter the cardholder name');
      return;
    }


    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Payment methods are not supported on web');
      return;
    }

    if (!stripe?.createPaymentMethod || !stripe?.confirmSetupIntent) {
      Alert.alert(
        'Native Module Required',
        'Please rebuild the app with a dev client to add payment methods. The native Stripe module is not available in Expo Go.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      // Ensure card details are complete
      if (!cardDetails?.complete) {
        throw new Error('Card details are not complete');
      }

      // Create setup intent first
      const { client_secret } = await createSetupIntent();

      if (!client_secret) {
        throw new Error('Failed to create setup intent');
      }

      // Use CardField directly with confirmSetupIntent
      // The SDK requires paymentMethodType and paymentMethodData with billingDetails
      const { setupIntent, error: confirmError } = await stripe.confirmSetupIntent(
        client_secret,
        {
        paymentMethodType: 'Card',
        paymentMethodData: {
          billingDetails: {
            name: billingName.trim(),
            email: undefined, // Not collecting email
            phone: billingPhone.trim() || undefined,
            address: {
              line1: billingAddress.trim() || undefined,
              city: billingCity.trim() || undefined,
              state: billingState.trim() || undefined,
              postal_code: billingZip.trim() || undefined,
              country: 'US', // Default to US, can be made configurable
            },
          },
        },
        }
      );

      if (confirmError) {
        if (confirmError.code === 'Canceled') {
          // User canceled - just return
          return;
        }
        throw new Error(confirmError.message || 'Failed to confirm payment method');
      }

      if (!setupIntent?.paymentMethodId) {
        throw new Error('Failed to confirm setup intent');
      }

      // Save payment method to database
      // Set as default if it's the first payment method
      const existingMethods = await getPaymentMethods();
      const isFirstMethod = existingMethods.length === 0;
      await addPaymentMethod(setupIntent.paymentMethodId, isFirstMethod);

      Alert.alert('Success', 'Payment method added successfully', [
        {
          text: 'OK',
          onPress: () => {
            onSuccess();
            onClose();
            // Reset form
            setCardDetails(null);
            setBillingName('');
            setBillingAddress('');
            setBillingCity('');
            setBillingState('');
            setBillingZip('');
            setBillingPhone('');
            if (cardFieldRef.current) {
              cardFieldRef.current.clear();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      Alert.alert('Error', error.message || 'Failed to add payment method');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cardFieldStyle = {
    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
    borderColor: isDark ? '#374151' : '#E5E7EB',
    borderWidth: 1,
    borderRadius: 8,
    textColor: isDark ? '#FFFFFF' : '#111827',
    placeholderColor: isDark ? '#6B7280' : '#9CA3AF',
    fontSize: 16,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
    }),
  };

  const cardContainerStyle = {
    height: 50,
    marginVertical: 0,
    marginBottom: 4,
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add Payment Method">
      <View style={styles.container}>
        {Platform.OS === 'web' ? (
          <View style={[styles.webNotSupported, isDark && styles.webNotSupportedDark]}>
            <Text style={[styles.webNotSupportedText, isDark && styles.webNotSupportedTextDark]}>
              Payment methods are not supported on web. Please use the mobile app.
            </Text>
          </View>
        ) : !CardField ? (
          <View style={[styles.webNotSupported, isDark && styles.webNotSupportedDark]}>
            <Text style={[styles.webNotSupportedText, isDark && styles.webNotSupportedTextDark]}>
              Please rebuild the app with a dev client to add payment methods. The native Stripe module is not available in Expo Go.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.formGroup}>
              <View style={styles.cardNumberHeader}>
                <Text style={[styles.label, isDark && styles.labelDark]}>
                  Card Number <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.cardTypesRow}>
                  <Image
                    source={require('@/assets/visa.png')}
                    style={styles.cardTypeImage}
                    resizeMode="contain"
                  />
                  <Image
                    source={require('@/assets/mastercard.png')}
                    style={styles.cardTypeImage}
                    resizeMode="contain"
                  />
                  <Image
                    source={require('@/assets/amex.png')}
                    style={styles.cardTypeImage}
                    resizeMode="contain"
                  />
                  <Image
                    source={require('@/assets/discover.png')}
                    style={styles.cardTypeImage}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <CardField
                ref={cardFieldRef}
                postalCodeEnabled={false}
                placeholders={{
                  number: '4242 4242 4242 4242',
                }}
                cardStyle={cardFieldStyle}
                style={cardContainerStyle}
                onCardChange={(details: any) => {
                  setCardDetails(details);
                }}
              />
              {cardDetails && !cardDetails.complete && cardDetails.last4 && (
                <Text style={styles.errorText}>Please enter a valid card number</Text>
              )}
            </View>

            <View style={styles.formGroup}>
              <Input
                label="Cardholder Name"
                value={billingName}
                onChangeText={setBillingName}
                placeholder="John Doe"
                required
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formGroup}>
              <Input
                label="Street Address"
                value={billingAddress}
                onChangeText={setBillingAddress}
                placeholder="123 Main St"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupCity]}>
                <Input
                  label="City"
                  value={billingCity}
                  onChangeText={setBillingCity}
                  placeholder="New York"
                  autoCapitalize="words"
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupState]}>
                <Input
                  label="State"
                  value={billingState}
                  onChangeText={setBillingState}
                  placeholder="NY"
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Input
                  label="ZIP Code"
                  value={billingZip}
                  onChangeText={setBillingZip}
                  placeholder="10001"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
              <View style={[styles.formGroup, styles.formGroupHalf]}>
                <Input
                  label="Phone Number"
                  value={billingPhone}
                  onChangeText={setBillingPhone}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <Button
                title={isSubmitting ? 'Adding...' : 'Add Payment Method'}
                onPress={handleSubmit}
                loading={isSubmitting}
                disabled={!cardDetails?.complete || !billingName.trim() || isSubmitting}
                fullWidth
              />
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  formGroup: {
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formGroupHalf: {
    flex: 1,
    marginBottom: 12,
  },
  formGroupCity: {
    flex: 2,
    marginBottom: 12,
  },
  formGroupState: {
    flex: 1,
    marginBottom: 12,
    maxWidth: 100,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  labelDark: {
    color: '#F9FAFB',
  },
  required: {
    color: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoBoxDark: {
    backgroundColor: '#1E3A8A',
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
    flex: 1,
  },
  infoTextDark: {
    color: '#93C5FD',
  },
  buttonContainer: {
    marginTop: 0,
    marginBottom: 8,
  },
  webNotSupported: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  webNotSupportedDark: {
    backgroundColor: '#78350F',
  },
  webNotSupportedText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  webNotSupportedTextDark: {
    color: '#FCD34D',
  },
  cardNumberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTypesRow: {
    flexDirection: 'row',
    gap: 0,
    alignItems: 'center',
  },
  cardTypeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTypeBadgeDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  cardTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  cardTypeTextDark: {
    color: '#D1D5DB',
  },
  cardTypeImage: {
    height: 20,
    width: 50,
    resizeMode: 'contain',
    marginHorizontal: -8,
  },
});

