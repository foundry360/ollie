import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, AppState, Image } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { getPaymentMethods, setDefaultPaymentMethod, removePaymentMethod } from '@/lib/api/payments';
import { Loading } from '@/components/ui/Loading';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { LinearGradient } from 'expo-linear-gradient';
import type { PaymentMethod } from '@/types';

export function PaymentMethodsContent() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'list' | 'details'>('list');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

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

  const handleAddPaymentMethod = () => {
    setShowAddModal(true);
  };

  const handlePaymentMethodAdded = () => {
    loadPaymentMethods();
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

  const renderCardBrandIcon = (brand?: string) => {
    const brandLower = brand?.toLowerCase();
    
    // Use image assets for card brands
    if (brandLower === 'visa') {
      return (
        <Image
          source={require('@/assets/visa.png')}
          style={styles.cardBrandImage}
          resizeMode="contain"
        />
      );
    } else if (brandLower === 'mastercard') {
      return (
        <Image
          source={require('@/assets/mastercard.png')}
          style={styles.cardBrandImage}
          resizeMode="contain"
        />
      );
    } else if (brandLower === 'amex' || brandLower === 'american_express') {
      return (
        <Image
          source={require('@/assets/amex.png')}
          style={styles.cardBrandImage}
          resizeMode="contain"
        />
      );
    } else if (brandLower === 'discover') {
      return (
        <Image
          source={require('@/assets/discover.png')}
          style={styles.cardBrandImage}
          resizeMode="contain"
        />
      );
    }
    
    // For other card types, use icons with brand colors
    let iconName = 'card-outline';
    let iconColor = '#73af17';
    
    switch (brandLower) {
      case 'diners':
        iconName = 'card';
        iconColor = '#0079BE';
        break;
      case 'jcb':
        iconName = 'card';
        iconColor = '#0066B2';
        break;
      case 'unionpay':
        iconName = 'card';
        iconColor = '#E21836';
        break;
      default:
        iconName = 'card-outline';
        iconColor = '#73af17';
    }
    
    return (
      <View style={[
        styles.cardBrandIconContainer, 
        { borderColor: iconColor },
        isDark && { backgroundColor: `${iconColor}20` }
      ]}>
        <Ionicons name={iconName as any} size={14} color={iconColor} />
      </View>
    );
  };

  const formatCardNumber = (last4?: string) => {
    if (!last4) return '••••';
    return `•••• •••• •••• ${last4}`;
  };

  const formatExpiry = (month?: number, year?: number) => {
    if (!month || !year) return '';
    return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`;
  };

  // Get all cards (filter for card type) and sort them - MUST be before early return
  const sortedCards = useMemo(() => {
    const cards = paymentMethods.filter(m => m.type === 'card' && m.card_last4);
    return [...cards].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [paymentMethods]);

  // Get default card for cardholder details - MUST be before early return
  const defaultCard = useMemo(() => {
    return sortedCards.find(m => m.is_default) || sortedCards[0] || null;
  }, [sortedCards]);
  
  // Get selected card for details modal
  const selectedCard = useMemo(() => {
    return selectedCardId ? sortedCards.find(c => c.id === selectedCardId) || null : null;
  }, [selectedCardId, sortedCards]);

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  if (loading) {
    return <Loading />;
  }

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

  const getCardGradientColors = (brand?: string): [string, string, string] => {
    const brandLower = brand?.toLowerCase();
    if (brandLower === 'visa') {
      return isDark ? ['#1E3A8A', '#2563EB', '#3B82F6'] : ['#1E40AF', '#2563EB', '#3B82F6'];
    } else if (brandLower === 'mastercard') {
      return isDark ? ['#991B1B', '#DC2626', '#EF4444'] : ['#B91C1C', '#DC2626', '#EF4444'];
    } else if (brandLower === 'discover') {
      return isDark ? ['#C2410C', '#EA580C', '#F97316'] : ['#D97706', '#EA580C', '#F97316'];
    } else if (brandLower === 'amex' || brandLower === 'american_express') {
      return isDark ? ['#4B5563', '#6B7280', '#9CA3AF'] : ['#6B7280', '#9CA3AF', '#D1D5DB'];
    }
    // Default gradient
    return isDark ? ['#1F2937', '#374151', '#4B5563'] : ['#6366F1', '#8B5CF6', '#A78BFA'];
  };

  const renderCard = (card: PaymentMethod, index: number) => {
    const cardBrandImage = getCardBrandImage(card.card_brand);
    const cardGradientColors: [string, string, string] = getCardGradientColors(card.card_brand) || 
      (isDark ? ['#1F2937', '#374151', '#4B5563'] : ['#6366F1', '#8B5CF6', '#A78BFA']);
    // Lower z-index for cards at the top (furthest back), higher for cards at bottom (on top)
    const zIndex = index + 1;
    // Card height is 240px, show more of each card below (about 100px visible)
    const cardHeight = 240;
    const visibleHeight = 100; // Show more of each card
    const overlapAmount = cardHeight - visibleHeight; // 140px overlap
    
    const marginTop = index === 0 ? 0 : -(overlapAmount * index);
    
    return (
      <View
        key={card.id}
        style={[
          styles.accordionCardWrapper,
          { 
            zIndex, 
            marginTop,
          }
        ]}
      >
        <Pressable
          onPress={() => {
            setSelectedCardId(card.id);
            setCurrentScreen('details');
          }}
          style={styles.cardPressable}
        >
          <View style={styles.cardContainer}>
            <LinearGradient
              colors={cardGradientColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
          {/* Background Design Elements */}
          <View style={styles.cardBackgroundDesign}>
            <View style={[styles.designCircle, styles.designCircle1]} />
            <View style={[styles.designCircle, styles.designCircle2]} />
            <View style={[styles.designCircle, styles.designCircle3]} />
            <View style={styles.dotsPattern}>
              {[...Array(8)].map((_, i) => (
                <View key={i} style={[styles.dot, { 
                  left: `${(i % 4) * 30}%`, 
                  top: `${Math.floor(i / 4) * 40}%`,
                  opacity: 0.1 + (i % 2) * 0.05
                }]} />
              ))}
            </View>
            <View style={[styles.designLine, styles.designLine1]} />
            <View style={[styles.designLine, styles.designLine2]} />
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <View style={styles.cardTopLeft}>
                {cardBrandImage && (
                  <Image
                    source={cardBrandImage}
                    style={styles.cardBrandLogoTop}
                    resizeMode="contain"
                  />
                )}
                <Text style={styles.cardLast4}>•••• {card.card_last4 || '••••'}</Text>
                {card.is_default && (
                  <View style={styles.defaultBadgeCard}>
                    <Text style={styles.defaultBadgeCardText}>Default</Text>
                  </View>
                )}
              </View>
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color="#FFFFFF" 
                style={styles.expandIcon}
              />
            </View>
            <View style={styles.cardBottomRow}>
              <View style={styles.cardBottomLeft}>
                {card.card_exp_month && card.card_exp_year && (
                  <Text style={styles.cardExpiry}>
                    Expires {formatExpiry(card.card_exp_month, card.card_exp_year)}
                  </Text>
                )}
              </View>
              <View style={styles.cardBottomRight}>
                {cardBrandImage && (
                  <Image
                    source={cardBrandImage}
                    style={styles.cardBrandLogoBottom}
                    resizeMode="contain"
                  />
                )}
              </View>
            </View>
          </View>
            </LinearGradient>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderCardDetailsScreen = () => {
    if (!selectedCard) return null;

    return (
      <View style={styles.screenContainer}>
        <View style={styles.screenHeader}>
          <Pressable
            onPress={() => {
              setCurrentScreen('list');
              setSelectedCardId(null);
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
          <Text style={[styles.screenTitle, titleStyle]}>Card Details</Text>
          <View style={styles.backButton} />
        </View>

          {/* Card Visualization */}
          <View style={styles.screenCardContainer}>
            {(() => {
              const cardBrandImage = getCardBrandImage(selectedCard.card_brand);
              const cardGradientColors: [string, string, string] = getCardGradientColors(selectedCard.card_brand) || 
                (isDark ? ['#1F2937', '#374151', '#4B5563'] : ['#6366F1', '#8B5CF6', '#A78BFA']);
              
              return (
                <View style={styles.cardContainer}>
                  <LinearGradient
                    colors={cardGradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardGradient}
                  >
                    <View style={styles.cardBackgroundDesign}>
                      <View style={[styles.designCircle, styles.designCircle1]} />
                      <View style={[styles.designCircle, styles.designCircle2]} />
                      <View style={[styles.designCircle, styles.designCircle3]} />
                      <View style={styles.dotsPattern}>
                        {[...Array(8)].map((_, i) => (
                          <View key={i} style={[styles.dot, { 
                            left: `${(i % 4) * 30}%`, 
                            top: `${Math.floor(i / 4) * 40}%`,
                            opacity: 0.1 + (i % 2) * 0.05
                          }]} />
                        ))}
                      </View>
                      <View style={[styles.designLine, styles.designLine1]} />
                      <View style={[styles.designLine, styles.designLine2]} />
                    </View>

                    <View style={styles.cardContent}>
                      <View style={styles.cardTopRow}>
                        <View style={styles.cardTopLeft}>
                          {cardBrandImage && (
                            <Image
                              source={cardBrandImage}
                              style={styles.cardBrandLogoTop}
                              resizeMode="contain"
                            />
                          )}
                          <Text style={styles.cardLast4}>•••• {selectedCard.card_last4 || '••••'}</Text>
                          {selectedCard.is_default && (
                            <View style={styles.defaultBadgeCard}>
                              <Text style={styles.defaultBadgeCardText}>Default</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.cardBottomRow}>
                        <View style={styles.cardBottomLeft}>
                          {selectedCard.card_exp_month && selectedCard.card_exp_year && (
                            <Text style={styles.cardExpiry}>
                              Expires {formatExpiry(selectedCard.card_exp_month, selectedCard.card_exp_year)}
                            </Text>
                          )}
                        </View>
                        <View style={styles.cardBottomRight}>
                          {cardBrandImage && (
                            <Image
                              source={cardBrandImage}
                              style={styles.cardBrandLogoBottom}
                              resizeMode="contain"
                            />
                          )}
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              );
            })()}
          </View>

          {/* Cardholder Details */}
          <View style={styles.cardholderSection}>
            <Text style={[styles.cardholderHeading, titleStyle]}>Cardholder Details</Text>
            {selectedCard.billing_name && (
              <Text style={[styles.detailValue, textStyle]}>{selectedCard.billing_name}</Text>
            )}
            {selectedCard.billing_address_line1 && (
              <Text style={[styles.detailValue, textStyle]}>{selectedCard.billing_address_line1}</Text>
            )}
            {(selectedCard.billing_city || selectedCard.billing_state || selectedCard.billing_postal_code) && (
              <Text style={[styles.detailValue, textStyle]}>
                {[
                  selectedCard.billing_city,
                  selectedCard.billing_state,
                  selectedCard.billing_postal_code
                ].filter(Boolean).join(', ')}
              </Text>
            )}
            {selectedCard.billing_phone && (
              <Text style={[styles.detailValue, textStyle]}>+{selectedCard.billing_phone}</Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.cardActions}>
            {!selectedCard.is_default && (
              <Pressable
                style={styles.cardActionButton}
                onPress={async () => {
                  await handleSetDefault(selectedCard.stripe_payment_method_id);
                  // Go back to list screen to show updated default
                  setCurrentScreen('list');
                  setSelectedCardId(null);
                }}
              >
                <Text style={[styles.cardActionButtonText, labelStyle]}>Set as Default</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.cardActionButton, styles.removeCardActionButton]}
              onPress={() => {
                handleRemove(selectedCard).then(() => {
                  setCurrentScreen('list');
                  setSelectedCardId(null);
                });
              }}
            >
              <Text style={[styles.cardActionButtonText, styles.removeCardActionButtonText]}>Remove</Text>
            </Pressable>
          </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {currentScreen === 'list' ? (
        <>
          {/* Accordion Card Stack */}
          {sortedCards.length > 0 ? (
            <View style={styles.accordionContainer}>
              {sortedCards.map((card, index) => {
                return (
                  <View key={card.id}>
                    {renderCard(card, index)}
                    {/* Add Card Button after last card */}
                    {index === sortedCards.length - 1 && (
                      <View style={styles.addCardButtonContainer}>
                        <Pressable
                          style={styles.addCardButtonFloating}
                          onPress={handleAddPaymentMethod}
                        >
                          <Ionicons name="add" size={20} color="#73af17" />
                          <Text style={styles.addCardButtonFloatingText}>Add Card</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          {paymentMethods.length === 0 && (
            <View style={[styles.section, cardStyle]}>
              <Ionicons name="card-outline" size={48} color={isDark ? '#9CA3AF' : '#6B7280'} style={styles.emptyIcon} />
              <Text style={[styles.emptyTitle, titleStyle]}>No Payment Methods</Text>
              <Text style={[styles.emptyText, textStyle]}>
                Add a payment method to pay for completed gigs. You can add a credit or debit card.
              </Text>
              <Pressable
                style={styles.addButton}
                onPress={handleAddPaymentMethod}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" style={styles.addButtonIcon} />
                <Text style={styles.addButtonText}>Add Payment Method</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        renderCardDetailsScreen()
      )}

      <AddPaymentMethodModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handlePaymentMethodAdded}
      />
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
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  methodTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardBrandTitleImage: {
    height: 16,
    width: 40,
    resizeMode: 'contain',
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
  cardBrandIconContainer: {
    width: 26,
    height: 18,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  cardBrandImage: {
    width: 26,
    height: 18,
    resizeMode: 'contain',
  },
  cardContainer: {
    marginBottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    width: '100%',
    height: 240,
  },
  cardGradient: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    height: 240,
    justifyContent: 'space-between',
  },
  cardContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cardBackgroundDesign: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderRadius: 16,
  },
  designCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  designCircle1: {
    width: 120,
    height: 120,
    top: -40,
    right: -40,
  },
  designCircle2: {
    width: 80,
    height: 80,
    bottom: -20,
    left: -20,
  },
  designCircle3: {
    width: 60,
    height: 60,
    top: '50%',
    right: '20%',
    opacity: 0.15,
  },
  dotsPattern: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  dot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  designLine: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: '60%',
  },
  designLine1: {
    top: '30%',
    left: '10%',
    transform: [{ rotate: '-15deg' }],
  },
  designLine2: {
    bottom: '25%',
    right: '10%',
    transform: [{ rotate: '15deg' }],
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
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
    paddingTop: 20,
  },
  cardBottomLeft: {
    flex: 1,
  },
  cardExpiry: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardBottomRight: {
    alignItems: 'flex-end',
  },
  cardBrandLogoBottom: {
    width: 60,
    height: 40,
  },
  cardholderSection: {
    marginTop: 0,
    marginBottom: 24,
  },
  cardholderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardholderHeading: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardholderActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addCardButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#73af17',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addCardButtonText: {
    color: '#73af17',
    fontSize: 14,
    fontWeight: '600',
  },
  removeCardButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeCardButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  container: {
    flex: 1,
  },
  accordionContainer: {
    marginBottom: 24,
    paddingHorizontal: 0,
  },
  accordionCardWrapper: {
    position: 'relative',
    marginBottom: 0,
    width: '100%',
    minHeight: 240, // Ensure minimum height for visibility
  },
  cardPressable: {
    width: '100%',
  },
  cardGradientExpanded: {
    marginBottom: 0,
  },
  addCardButtonContainer: {
    width: '100%',
    marginTop: 20,
    paddingTop: 20,
  },
  expandIcon: {
    opacity: 0.8,
  },
  defaultBadgeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  defaultBadgeCardText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardExpandedDetails: {
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1001, // Ensure expanded details are always on top
    position: 'relative' as const,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cardActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  removeCardActionButton: {
    borderColor: '#EF4444',
  },
  cardActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  removeCardActionButtonText: {
    color: '#EF4444',
  },
  addCardButtonFloating: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#73af17',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  addCardButtonFloatingText: {
    color: '#73af17',
    fontSize: 14,
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: 4,
    width: 32,
    alignItems: 'flex-start',
  },
  screenCardContainer: {
    marginBottom: 24,
  },
});

