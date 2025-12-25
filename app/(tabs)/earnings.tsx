import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  useEarningsSummary, 
  useEarningsHistory,
  useNeighborSpendingSummary,
  useNeighborSpendingHistory 
} from '@/hooks/useEarnings';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Loading } from '@/components/ui/Loading';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { DateFilter, DateFilterOption } from '@/components/earnings/DateFilter';

export default function EarningsScreen() {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/earnings.tsx:12',message:'EarningsScreen mount',data:{insetsTop:insets.top,insetsBottom:insets.bottom},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  }, [insets.top, insets.bottom]);
  // #endregion
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all-time');
  const [selectedGigId, setSelectedGigId] = useState<string | null>(null);
  const [showGigModal, setShowGigModal] = useState(false);

  // Calculate date range based on filter
  const getDateRange = (filter: typeof dateFilter): { startDate?: string; endDate?: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'this-week': {
        // Get Monday of this week (day 0 = Sunday, so we adjust)
        const dayOfWeek = today.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const start = new Date(today);
        start.setDate(today.getDate() - daysFromMonday);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'last-week': {
        // Get Monday of last week
        const dayOfWeek = today.getDay();
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const end = new Date(today);
        end.setDate(today.getDate() - daysFromMonday - 1);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'this-month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'last-month': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'last-6-months': {
        const start = new Date(today);
        start.setMonth(today.getMonth() - 6);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'last-year': {
        const start = new Date(today);
        start.setFullYear(today.getFullYear() - 1);
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
      }
      case 'all-time':
      default:
        return {};
    }
  };

  const isNeighbor = user?.role === 'poster';
  const dateRange = getDateRange(dateFilter);
  
  // Use different hooks based on user role
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = isNeighbor
    ? useNeighborSpendingSummary(dateRange)
    : useEarningsSummary(dateRange);
  
  const {
    data: history = [],
    isLoading: historyLoading,
    isRefetching,
    refetch: refetchHistory,
  } = isNeighbor
    ? useNeighborSpendingHistory({
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        ...dateRange,
      })
    : useEarningsHistory({
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        ...dateRange,
      });

  const handleRefresh = () => {
    refetchSummary();
    refetchHistory();
  };

  const isLoading = summaryLoading || historyLoading;

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  // Wallet is available for both teens and neighbors

  const handleEarningPress = (gigId: string | null | undefined) => {
    if (!gigId) {
      console.warn('Cannot open gig details: gig_id is missing');
      return;
    }
    setSelectedGigId(gigId);
    setShowGigModal(true);
  };

  const handleCloseGigModal = () => {
    setShowGigModal(false);
    setSelectedGigId(null);
  };

  const renderEarningItem = ({ item }: { item: any }) => {
    const hasGigId = !!item.gig_id;
    
    return (
      <Pressable
        onPress={() => hasGigId && handleEarningPress(item.gig_id)}
        disabled={!hasGigId}
        android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
        style={!hasGigId && styles.earningItemDisabled}
      >
      <View style={[styles.earningItem, cardStyle]}>
        <View style={styles.earningHeader}>
          <View style={styles.earningInfo}>
            <Text style={[styles.earningTitle, titleStyle]} numberOfLines={1}>
              {item.task_title}
            </Text>
            <Text style={[styles.earningDate, labelStyle]}>
              {format(new Date(item.created_at), 'MMM d, yyyy')}
            </Text>
            {isNeighbor && item.teen_name && (
              <Text style={[styles.teenName, labelStyle]}>
                Paid to: {item.teen_name}
              </Text>
            )}
          </View>
          <View style={styles.earningAmount}>
            <Text style={[styles.amountText, titleStyle]}>${item.amount.toFixed(2)}</Text>
            <View
              style={[
                styles.statusBadge,
                item.payment_status === 'succeeded' && styles.statusBadgePaid,
                (item.payment_status === 'pending' || item.payment_status === 'processing') && styles.statusBadgePending,
                item.payment_status === 'failed' && styles.statusBadgeFailed,
              ]}
            >
              <Text style={styles.statusText}>
                {item.payment_status === 'succeeded' ? 'Paid' :
                 item.payment_status === 'processing' ? 'Processing' :
                 item.payment_status === 'failed' ? 'Failed' :
                 item.status === 'paid' ? 'Paid' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>
        {item.platform_fee_amount && item.platform_fee_amount > 0 && (
          <Text style={[styles.feeText, labelStyle]}>
            Platform fee: ${item.platform_fee_amount.toFixed(2)} • Net: ${(item.amount - item.platform_fee_amount).toFixed(2)}
          </Text>
        )}
        {item.payment_failed_reason && (
          <Text style={[styles.errorText, { color: '#EF4444' }]}>
            Payment failed: {item.payment_failed_reason}
          </Text>
        )}
        {item.paid_at && (
          <Text style={[styles.paidDate, labelStyle]}>
            {isNeighbor ? 'Payment sent on' : 'Paid on'} {format(new Date(item.paid_at), 'MMM d, yyyy')}
          </Text>
        )}
      </View>
    </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#73af17"
          />
        }
      >
        {isLoading && !summary ? (
          <Loading />
        ) : (
          <>
            <Text style={[styles.screenTitle, titleStyle]}>Wallet</Text>
            <View style={styles.summarySection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, titleStyle]}>
                  {isNeighbor ? 'Spending Summary' : 'Earnings Summary'}
                </Text>
                <DateFilter value={dateFilter} onChange={setDateFilter} />
              </View>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="cash" size={32} color="#73af17" />
                  <Text 
                    style={[styles.summaryLabel, labelStyle]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {isNeighbor ? 'Total Spent' : 'Total Earnings'}
                  </Text>
                  <Text 
                    style={[styles.summaryValue, titleStyle]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ${isNeighbor 
                      ? (summary as any)?.total_spent?.toFixed(2) || '0.00'
                      : (summary as any)?.total_earnings?.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="time" size={32} color={isDark ? '#F59E0B' : '#F59E0B'} />
                  <Text style={[styles.summaryLabel, labelStyle]}>Pending</Text>
                  <Text 
                    style={[styles.summaryValue, titleStyle]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ${isNeighbor
                      ? (summary as any)?.pending_spent?.toFixed(2) || '0.00'
                      : (summary as any)?.pending_earnings?.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="checkmark-circle" size={32} color="#73af17" />
                  <Text style={[styles.summaryLabel, labelStyle]}>Paid</Text>
                  <Text 
                    style={[styles.summaryValue, titleStyle]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ${isNeighbor
                      ? (summary as any)?.paid_spent?.toFixed(2) || '0.00'
                      : (summary as any)?.paid_earnings?.toFixed(2) || '0.00'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.filtersSection}>
              <Text style={[styles.sectionTitle, titleStyle]}>History</Text>
              
              {/* Status Filter */}
              <View style={styles.filters}>
                <View
                  style={[
                    styles.filterButton,
                    statusFilter === 'all' && styles.filterButtonActive,
                    isDark && statusFilter !== 'all' && styles.filterButtonDark,
                  ]}
                >
                  <Pressable onPress={() => setStatusFilter('all')}>
                    <Text
                      style={[
                        styles.filterButtonText,
                        statusFilter === 'all' && styles.filterButtonTextActive,
                        isDark && statusFilter !== 'all' && styles.filterButtonTextDark,
                      ]}
                    >
                      All
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.filterButton,
                    statusFilter === 'pending' && styles.filterButtonActive,
                    isDark && statusFilter !== 'pending' && styles.filterButtonDark,
                  ]}
                >
                  <Pressable onPress={() => setStatusFilter('pending')}>
                    <Text
                      style={[
                        styles.filterButtonText,
                        statusFilter === 'pending' && styles.filterButtonTextActive,
                        isDark && statusFilter !== 'pending' && styles.filterButtonTextDark,
                      ]}
                    >
                      Pending
                    </Text>
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.filterButton,
                    statusFilter === 'paid' && styles.filterButtonActive,
                    isDark && statusFilter !== 'paid' && styles.filterButtonDark,
                  ]}
                >
                  <Pressable onPress={() => setStatusFilter('paid')}>
                    <Text
                      style={[
                        styles.filterButtonText,
                        statusFilter === 'paid' && styles.filterButtonTextActive,
                        isDark && statusFilter !== 'paid' && styles.filterButtonTextDark,
                      ]}
                    >
                      Paid
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.historySection}>
              {history.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons
                    name="receipt-outline"
                    size={64}
                    color={isDark ? '#6B7280' : '#9CA3AF'}
                  />
                  <Text style={[styles.emptyText, titleStyle]}>
                    {isNeighbor ? 'No payments made' : 'No payments received'}
                  </Text>
                  <Text style={[styles.emptySubtext, textStyle]}>
                    {isNeighbor 
                      ? 'Your payment history will appear here once gigs are completed'
                      : 'Complete gigs to start earning!'}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={history}
                  renderItem={renderEarningItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          </>
        )}
      </ScrollView>
      <GigDetailModal
        visible={showGigModal}
        taskId={selectedGigId}
        onClose={handleCloseGigModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
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
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 0,
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 0,
    color: '#000000',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    minWidth: '30%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
    color: '#000000',
  },
  filtersSection: {
    marginBottom: 24,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  filterButtonDark: {
    backgroundColor: '#111827',
    borderColor: '#4B5563',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextDark: {
    color: '#D1D5DB',
  },
  historySection: {
    marginBottom: 24,
  },
  earningItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  earningItemDisabled: {
    opacity: 0.6,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  earningInfo: {
    flex: 1,
    marginRight: 12,
  },
  earningTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  earningDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  earningAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000000',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  statusBadgePaid: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgePending: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeFailed: {
    backgroundColor: '#FEE2E2',
  },
  feeText: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  paidDate: {
    fontSize: 12,
    marginTop: 8,
    color: '#6B7280',
  },
  teenName: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
});
