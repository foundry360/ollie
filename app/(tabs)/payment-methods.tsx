import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { Alert } from '@/components/ui/Alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { getPaymentMethods, setDefaultPaymentMethod, removePaymentMethod } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import { AddPaymentMethodModal } from '@/components/payments/AddPaymentMethodModal';
import { LinearGradient } from 'expo-linear-gradient';
import type { PaymentMethod } from '@/types';

export default function PaymentMethodsScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadPaymentMethods();
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

  const handlePaymentMethodAdded = async () => {
    // Small delay to ensure the backend has processed the new payment method
    await new Promise(resolve => setTimeout(resolve, 500));
    await loadPaymentMethods();
  };

  const getCardBrandImage = (brand?: string) => {
    const brandLower = brand?.toLowerCase();
    if (brandLower === 'visa') {
      return require('@/assets/visa.png');
    } else if (brandLower === 'mastercard') {
      return require('@/assets/mastercard.png');
    } else if (brandLower === 'amex' || brandLower === 'american_express') {
      return require('@/assets/amex.png');
    } else if (brandLower === 'discover') {
      return require('@/assets/discover.png');
    }
    return null;
  };

  const getDefaultCard = () => {
    if (!paymentMethods || paymentMethods.length === 0) return null;
    
    // Simply return the first payment method that has card_last4 (it's a card)
    return paymentMethods.find(m => m.card_last4) || null;
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
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
        <Loading />
      </SafeAreaView>
    );
  }

  // Get the card to display
  const defaultCard = useMemo(() => getDefaultCard(), [paymentMethods]);
  const cardBrandImage = defaultCard ? getCardBrandImage(defaultCard.card_brand) : null;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
      {/* TEST: Outside ScrollView */}
      <View style={{ height: 100, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>RED TEST OUTSIDE SCROLLVIEW</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* TEST: Inside ScrollView */}
        <View style={{ height: 100, backgroundColor: '#00FF00', marginBottom: 20, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: 'black', fontSize: 20, fontWeight: 'bold' }}>GREEN TEST INSIDE SCROLLVIEW</Text>
        </View>

        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
          </Pressable>
          <Text style={[styles.screenTitle, titleStyle]}>Payment Methods</Text>
        </View>

        {/* Card Visualization */}
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={isDark ? ['#1F2937', '#374151', '#4B5563'] : ['#6366F1', '#8B5CF6', '#A78BFA']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardContent}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  {paymentMethods[0] && getCardBrandImage(paymentMethods[0].card_brand) && (
                    <Image 
                      source={getCardBrandImage(paymentMethods[0].card_brand)!} 
                      style={styles.cardBrandLogoTop} 
                      resizeMode="contain" 
                    />
                  )}
                  <Text style={styles.cardLast4}>
                    {paymentMethods[0]?.card_last4 || '1414'}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottomRow}>
                {paymentMethods[0] && getCardBrandImage(paymentMethods[0].card_brand) && (
                  <Image 
                    source={getCardBrandImage(paymentMethods[0].card_brand)!} 
                    style={styles.cardBrandLogoBottom} 
                    resizeMode="contain" 
                  />
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {paymentMethods.length === 0 ? (
          <View style={[styles.section, cardStyle]}>
            <Ionicons name="card-outline" size={48} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, titleStyle]}>No Payment Methods</Text>
            <Text style={[styles.emptyText, textStyle]}>
              Add a payment method to pay for completed gigs. You can add a credit or debit card.
            </Text>
            <Pressable
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" style={styles.addButtonIcon} />
              <Text style={styles.addButtonText}>Add Payment Method</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Card Visualization - INSIDE the list section where we know it renders */}
            {paymentMethods.length > 0 && paymentMethods[0]?.card_last4 && (
              <View style={styles.cardContainer}>
                <LinearGradient
                  colors={isDark ? ['#1F2937', '#374151', '#4B5563'] : ['#6366F1', '#8B5CF6', '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardTopLeft}>
                        {getCardBrandImage(paymentMethods[0].card_brand) && (
                          <Image 
                            source={getCardBrandImage(paymentMethods[0].card_brand)!} 
                            style={styles.cardBrandLogoTop} 
                            resizeMode="contain" 
                          />
                        )}
                        <Text style={styles.cardLast4}>
                          {paymentMethods[0].card_last4}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardBottomRow}>
                      {getCardBrandImage(paymentMethods[0].card_brand) && (
                        <Image 
                          source={getCardBrandImage(paymentMethods[0].card_brand)!} 
                          style={styles.cardBrandLogoBottom} 
                          resizeMode="contain" 
                        />
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </View>
            )}
            
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
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add-circle-outline" size={24} color="#73af17" />
              <Text style={[styles.addText, labelStyle]}>Add Payment Method</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <AddPaymentMethodModal
        visible={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          // Refresh after modal closes to ensure new card appears
          setTimeout(() => {
            loadPaymentMethods();
          }, 300);
        }}
        onSuccess={handlePaymentMethodAdded}
      />
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 12,
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
  cardContainer: {
    marginBottom: 24,
    marginTop: 0,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    height: 200,
    backgroundColor: '#FF0000', // Temporary: to verify it renders
  },
  cardGradient: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    height: 200,
    justifyContent: 'space-between',
  },
  cardContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardBrandLogoTop: {
    width: 50,
    height: 30,
  },
  cardLast4: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: 20,
  },
  cardBrandLogoBottom: {
    width: 60,
    height: 40,
  },
});






