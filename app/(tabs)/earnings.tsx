import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEarningsSummary, useEarningsHistory } from '@/hooks/useEarnings';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Loading } from '@/components/ui/Loading';

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

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useEarningsSummary();
  const {
    data: history = [],
    isLoading: historyLoading,
    isRefetching,
    refetch: refetchHistory,
  } = useEarningsHistory(
    statusFilter === 'all' ? undefined : { status: statusFilter }
  );

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

  if (user?.role !== 'teen') {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.errorText, titleStyle]}>Wallet</Text>
          <Text style={[styles.errorSubtext, textStyle]}>
            Wallet is only available for teens
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderEarningItem = ({ item }: { item: any }) => (
    <View style={[styles.earningItem, cardStyle]}>
      <View style={styles.earningHeader}>
        <View style={styles.earningInfo}>
          <Text style={[styles.earningTitle, titleStyle]} numberOfLines={1}>
            {item.task_title}
          </Text>
          <Text style={[styles.earningDate, labelStyle]}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
        <View style={styles.earningAmount}>
          <Text style={[styles.amountText, titleStyle]}>${item.amount.toFixed(2)}</Text>
          <View
            style={[
              styles.statusBadge,
              item.status === 'paid' && styles.statusBadgePaid,
              item.status === 'pending' && styles.statusBadgePending,
            ]}
          >
            <Text style={styles.statusText}>
              {item.status === 'paid' ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>
      </View>
      {item.paid_at && (
        <Text style={[styles.paidDate, labelStyle]}>
          Paid on {format(new Date(item.paid_at), 'MMM d, yyyy')}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
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
            <View style={styles.summarySection}>
              <Text style={[styles.sectionTitle, titleStyle]}>Wallet Summary</Text>
              <View style={styles.summaryGrid}>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="cash" size={32} color="#73af17" />
                  <Text style={[styles.summaryLabel, labelStyle]}>Total Earnings</Text>
                  <Text style={[styles.summaryValue, titleStyle]}>
                    ${summary?.total_earnings.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="time" size={32} color={isDark ? '#F59E0B' : '#F59E0B'} />
                  <Text style={[styles.summaryLabel, labelStyle]}>Pending</Text>
                  <Text style={[styles.summaryValue, titleStyle]}>
                    ${summary?.pending_earnings.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="checkmark-circle" size={32} color={isDark ? '#10B981' : '#10B981'} />
                  <Text style={[styles.summaryLabel, labelStyle]}>Paid</Text>
                  <Text style={[styles.summaryValue, titleStyle]}>
                    ${summary?.paid_earnings.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <View style={[styles.summaryCard, cardStyle]}>
                  <Ionicons name="list" size={32} color={isDark ? '#8B5CF6' : '#8B5CF6'} />
                  <Text style={[styles.summaryLabel, labelStyle]}>Gigs</Text>
                  <Text style={[styles.summaryValue, titleStyle]}>
                    {summary?.completed_tasks || 0}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.filtersSection}>
              <Text style={[styles.sectionTitle, titleStyle]}>History</Text>
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
                  <Text style={[styles.emptyText, titleStyle]}>No earnings yet</Text>
                  <Text style={[styles.emptySubtext, textStyle]}>
                    Complete tasks to start earning!
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
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
  },
  summarySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 0,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#000000',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 8,
    color: '#6B7280',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  summaryValue: {
    fontSize: 20,
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
    backgroundColor: '#374151',
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
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
});
