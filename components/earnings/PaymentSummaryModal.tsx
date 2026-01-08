import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import type { EarningsRecord } from '@/lib/api/earnings';
import { getBankAccount } from '@/lib/api/payments';

interface PaymentSummaryModalProps {
  visible: boolean;
  earning: EarningsRecord | null;
  onClose: () => void;
}

export function PaymentSummaryModal({ visible, earning, onClose }: PaymentSummaryModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [bankAccountLast4, setBankAccountLast4] = useState<string | null>(null);
  
  // Fetch bank account when modal opens
  useEffect(() => {
    if (visible && earning) {
      getBankAccount()
        .then((account) => {
          if (account?.account_number_last4) {
            setBankAccountLast4(account.account_number_last4);
          } else {
            setBankAccountLast4(null);
          }
        })
        .catch((error) => {
          console.error('Error fetching bank account:', error);
          setBankAccountLast4(null);
        });
    }
  }, [visible, earning]);
  
  if (!earning) return null;
  
  const grossAmount = earning.amount;
  const platformFee = earning.platform_fee_amount || 0;
  const netAmount = grossAmount - platformFee;
  
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  
  // Determine payment status
  const hasPayoutStatusColumn = earning.payout_status !== undefined;
  const isPaid = hasPayoutStatusColumn 
    ? earning.payout_status === 'paid'
    : false;
  const isFailed = earning.payment_status === 'failed' || earning.payout_status === 'failed';
  const isPending = !isPaid && !isFailed;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.modalContent, containerStyle]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.modalTitle}>Payment Summary</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
          
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Transaction Summary */}
            <View style={styles.transactionSummary}>
              <Ionicons name="cash" size={48} color="#73af17" />
              <Text style={styles.transactionAmount}>
                ${netAmount.toFixed(2)}
              </Text>
              <Text style={[styles.transactionStatus, isPaid ? styles.transactionStatusCompleted : styles.transactionStatusPending]}>
                {isPaid ? 'Transaction Completed' : 'Transaction Pending'}
              </Text>
            </View>

            {/* Gig Info */}
            <View style={[styles.section, cardStyle]}>
              <Text style={[styles.sectionTitle, titleStyle]}>Gig Details</Text>
              <View style={styles.infoRow}>
                <Text style={[styles.label, labelStyle]}>Gig Title</Text>
                <Text style={[styles.value, textStyle]} numberOfLines={2}>
                  {earning.task_title}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.label, labelStyle]}>Completed Date</Text>
                <Text style={[styles.value, textStyle]}>
                  {format(new Date(earning.created_at), 'MMM d, yyyy')}
                </Text>
              </View>
              {earning.paid_at && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, labelStyle]}>Paid Date</Text>
                  <Text style={[styles.value, textStyle]}>
                    {format(new Date(earning.paid_at), 'MMM d, yyyy')}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Payment Breakdown */}
            <View style={[styles.section, cardStyle]}>
              <Text style={[styles.sectionTitle, titleStyle]}>Payment Breakdown</Text>
              
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, textStyle]}>Gig Pay (Gross)</Text>
                <Text style={[styles.breakdownValue, textStyle]}>${grossAmount.toFixed(2)}</Text>
              </View>
              
              {platformFee > 0 && (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, labelStyle, styles.feeLabel]}>
                    Platform Fee
                  </Text>
                  <Text style={[styles.breakdownValue, styles.feeValue]}>
                    ${platformFee.toFixed(2)}
                  </Text>
                </View>
              )}
              
              <View style={[styles.divider, isDark && styles.dividerDark]} />
              
              <View style={styles.breakdownRow}>
                <Text style={[styles.breakdownLabel, titleStyle, styles.netLabel]}>
                  Your Earnings (Net)
                </Text>
              </View>
              {bankAccountLast4 ? (
                <View style={[styles.bankAccountRow, isDark && styles.bankAccountRowDark]}>
                  <Text style={[styles.bankAccountLabel, labelStyle]}>
                    Bank Account: ({bankAccountLast4})
                  </Text>
                  <Text style={[styles.bankAccountValue, titleStyle, styles.netValue]}>
                    ${netAmount.toFixed(2)}
                  </Text>
                </View>
              ) : (
                <View style={styles.breakdownRow}>
                  <Text style={[styles.breakdownValue, titleStyle, styles.netValue]}>
                    ${netAmount.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    height: '90%',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#73af17',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  transactionSummary: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  transactionAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#73af17',
    marginTop: 12,
    marginBottom: 8,
  },
  transactionStatus: {
    fontSize: 16,
    fontWeight: '500',
  },
  transactionStatusCompleted: {
    color: '#73af17',
  },
  transactionStatusPending: {
    color: '#F59E0B',
  },
  section: {
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 0,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  cardLight: {
    backgroundColor: '#F9FAFB',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#111827',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  labelDark: {
    color: '#9CA3AF',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  textDark: {
    color: '#D1D5DB',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  feeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownLabel: {
    fontSize: 16,
    color: '#374151',
  },
  feeLabel: {
    color: '#6B7280',
  },
  netLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  feeValue: {
    color: '#EF4444',
  },
  netValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#73af17',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  dividerDark: {
    backgroundColor: '#374151',
  },
  statusContainer: {
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgePaid: {
    backgroundColor: '#73af17',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeFailed: {
    backgroundColor: '#EF4444',
  },
  statusTextPaid: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextPending: {
    color: '#92400E',
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextFailed: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  bankAccountRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankAccountRowDark: {
    borderTopColor: '#374151',
  },
  bankAccountLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  bankAccountValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#73af17',
  },
});

