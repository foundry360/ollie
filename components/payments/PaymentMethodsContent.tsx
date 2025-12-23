import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, AppState } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { getPaymentMethods, setDefaultPaymentMethod, removePaymentMethod, createSetupIntent, addPaymentMethod } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import type { PaymentMethod } from '@/types';

// Conditionally import Stripe - will be available after native rebuild
let useStripe: any;
try {
  const stripeModule = require('@stripe/stripe-react-native');
  useStripe = stripeModule.useStripe;
} catch (e) {
  // Native module not available (Expo Go) - will work after rebuild
  useStripe = () => ({
    initPaymentSheet: () => Promise.resolve({ error: null }),
    presentPaymentSheet: () => Promise.resolve({ error: { code: 'NativeModuleNotAvailable', message: 'Please rebuild app with dev client' } }),
    retrieveSetupIntent: () => Promise.resolve({ error: { code: 'NativeModuleNotAvailable' } }),
  });
}

export function PaymentMethodsContent() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();

  useEffect(() => {
    loadPaymentMethods();
    
    // Listen for app state changes to refresh payment methods when returning from browser
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh payment methods when app becomes active (user returned from browser)
        loadPaymentMethods();
      }
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const methods = await getPaymentMethods();
      setPaymentMethods(methods);
    } catch (error: any) {
      console.error('Error loading payment methods:', error);
      Alert.alert('Error', error.message || 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await setDefaultPaymentMethod(paymentMethodId);
      await loadPaymentMethods();
      Alert.alert('Success', 'Default payment method updated');
    } catch (error: any) {
      console.error('Error setting default:', error);
      Alert.alert('Error', error.message || 'Failed to set default payment method');
    }
  };

  const handleAddPaymentMethod = async () => {
    try {
      setIsAddingPayment(true);
      
      // Create setup intent
      const { client_secret } = await createSetupIntent();
      
      if (!client_secret) {
        throw new Error('Failed to create setup intent');
      }
      
      // Initialize payment sheet with setup intent
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'Ollie',
        setupIntentClientSecret: client_secret,
        defaultBillingDetails: {
          name: 'Customer',
        },
      });
      
      if (initError) {
        throw new Error(initError.message);
      }
      
      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();
      
      if (presentError) {
        if (presentError.code === 'NativeModuleNotAvailable') {
          Alert.alert(
            'Native Module Required',
            'Please rebuild the app with a dev client to add payment methods. The native Stripe module is not available in Expo Go.',
            [{ text: 'OK' }]
          );
          return;
        }
        if (presentError.code !== 'Canceled') {
          throw new Error(presentError.message);
        }
        // User canceled - just return
        return;
      }
      
      // Payment sheet completed - retrieve setup intent to get payment method ID
      const { setupIntent: retrievedIntent, error: retrieveError } = await retrieveSetupIntent(client_secret);
      
      if (retrieveError || !retrievedIntent?.paymentMethodId) {
        throw new Error('Failed to retrieve payment method');
      }
      
      // Save to database
      await addPaymentMethod(retrievedIntent.paymentMethodId, false);
      await loadPaymentMethods();
      Alert.alert('Success', 'Payment method added successfully');
    } catch (error: any) {
      console.error('Error adding payment method:', error);
      Alert.alert('Error', error.message || 'Failed to add payment method');
    } finally {
      setIsAddingPayment(false);
    }
  };


  const handleRemove = async (paymentMethod: PaymentMethod) => {
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove ${paymentMethod.type === 'card' ? `your ${paymentMethod.card_brand} card ending in ${paymentMethod.card_last4}` : 'this payment method'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removePaymentMethod(paymentMethod.stripe_payment_method_id);
              await loadPaymentMethods();
              Alert.alert('Success', 'Payment method removed');
            } catch (error: any) {
              console.error('Error removing payment method:', error);
              Alert.alert('Error', error.message || 'Failed to remove payment method');
            }
          },
        },
      ]
    );
  };

  const getCardIcon = (brand?: string) => {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'card-outline';
      case 'mastercard':
        return 'card-outline';
      case 'amex':
        return 'card-outline';
      case 'discover':
        return 'card-outline';
      default:
        return 'card-outline';
    }
  };

  const formatCardNumber = (last4?: string) => {
    if (!last4) return '••••';
    return `•••• •••• •••• ${last4}`;
  };

  const formatExpiry = (month?: number, year?: number) => {
    if (!month || !year) return '';
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  if (loading) {
    return <Loading />;
  }

  return (
    <View>
      {paymentMethods.length === 0 ? (
        <View style={[styles.section, cardStyle]}>
          <Ionicons name="card-outline" size={48} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.emptyIcon} />
          <Text style={[styles.emptyTitle, titleStyle]}>No Payment Methods</Text>
          <Text style={[styles.emptyText, textStyle]}>
            Add a payment method to pay for completed gigs. You can add a credit or debit card.
          </Text>
          <Pressable
            style={styles.addButton}
            onPress={handleAddPaymentMethod}
            disabled={isAddingPayment}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" style={styles.addButtonIcon} />
            <Text style={styles.addButtonText}>
              {isAddingPayment ? 'Loading...' : 'Add Payment Method'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          {paymentMethods.map((method) => (
            <View key={method.id} style={[styles.section, cardStyle]}>
              <View style={styles.methodHeader}>
                <View style={styles.methodInfo}>
                  <Ionicons 
                    name={getCardIcon(method.card_brand)} 
                    size={24} 
                    color="#73af17" 
                  />
                  <View style={styles.methodDetails}>
                    {method.type === 'card' ? (
                      <>
                        <Text style={[styles.methodTitle, titleStyle]}>
                          {method.card_brand ? method.card_brand.charAt(0).toUpperCase() + method.card_brand.slice(1) : 'Card'} 
                          {method.is_default && (
                            <Text style={styles.defaultBadge}> • Default</Text>
                          )}
                        </Text>
                        <Text style={[styles.methodNumber, textStyle]}>
                          {formatCardNumber(method.card_last4)}
                        </Text>
                        {method.card_exp_month && method.card_exp_year && (
                          <Text style={[styles.methodExpiry, textStyle]}>
                            Expires {formatExpiry(method.card_exp_month, method.card_exp_year)}
                          </Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={[styles.methodTitle, titleStyle]}>
                          Bank Account
                          {method.is_default && (
                            <Text style={styles.defaultBadge}> • Default</Text>
                          )}
                        </Text>
                        {method.bank_last4 && (
                          <Text style={[styles.methodNumber, textStyle]}>
                            •••• {method.bank_last4}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.methodActions}>
                {!method.is_default && (
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleSetDefault(method.stripe_payment_method_id)}
                  >
                    <Text style={[styles.actionButtonText, labelStyle]}>Set as Default</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.actionButton, styles.removeButton]}
                  onPress={() => handleRemove(method)}
                >
                  <Text style={[styles.actionButtonText, styles.removeButtonText]}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            style={[styles.section, cardStyle, styles.addSection]}
            onPress={handleAddPaymentMethod}
            disabled={isAddingPayment}
          >
            <Ionicons name="add-circle-outline" size={24} color="#73af17" />
            <Text style={[styles.addText, labelStyle]}>
              {isAddingPayment ? 'Loading...' : 'Add Payment Method'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  methodHeader: {
    marginBottom: 16,
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodDetails: {
    marginLeft: 12,
    flex: 1,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#111827',
  },
  defaultBadge: {
    fontSize: 14,
    fontWeight: '400',
    color: '#73af17',
  },
  methodNumber: {
    fontSize: 16,
    marginBottom: 4,
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  methodExpiry: {
    fontSize: 14,
  },
  methodActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  removeButton: {
    borderColor: '#EF4444',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  labelLight: {
    color: '#6B7280',
  },
  removeButtonText: {
    color: '#EF4444',
  },
  emptyIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: '#73af17',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    marginRight: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  addSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  addText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

