import { View, Text, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useParentApprovals } from '@/hooks/useParentApprovals';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Loading } from '@/components/ui/Loading';

export default function ParentApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const {
    data: approvals = [],
    isLoading,
    isRefetching,
    refetch,
  } = useParentApprovals();

  const handleRefresh = () => {
    refetch();
  };

  if (user?.role !== 'parent') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Parent Approvals
          </Text>
          <Text style={[styles.errorSubtext, isDark && styles.errorSubtextDark]}>
            This page is only available for parents
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'rejected':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const renderApproval = ({ item }: { item: any }) => (
    <Pressable
      style={[styles.approvalCard, cardStyle]}
      onPress={() => router.push(`/tasks/${item.task_id}`)}
    >
      <View style={styles.approvalHeader}>
        <View style={styles.approvalInfo}>
          <Text style={[styles.taskTitle, titleStyle]} numberOfLines={2}>
            {item.task_title}
          </Text>
          <Text style={[styles.approvalDate, labelStyle]}>
            {format(new Date(item.created_at), 'MMM d, yyyy')}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      {item.reason && (
        <View style={styles.reasonContainer}>
          <Text style={[styles.reasonLabel, labelStyle]}>Reason:</Text>
          <Text style={[styles.reasonText, textStyle]}>{item.reason}</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, titleStyle]}>All Approvals</Text>
        <Text style={[styles.headerSubtitle, textStyle]}>
          View approval history
        </Text>
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={approvals}
          renderItem={renderApproval}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            approvals.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="document-text-outline"
                size={64}
                color={isDark ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.emptyText, titleStyle]}>No approvals yet</Text>
              <Text style={[styles.emptySubtext, textStyle]}>
                Approval requests will appear here
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor="#73af17"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#000000',
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  listContent: {
    padding: 16,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  approvalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#000000',
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  approvalInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  approvalDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  reasonContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    color: '#6B7280',
  },
  reasonText: {
    fontSize: 14,
    color: '#374151',
  },
  emptyContainer: {
    flex: 1,
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
  errorTextDark: {
    color: '#FFFFFF',
  },
  errorSubtext: {
    fontSize: 16,
    textAlign: 'center',
  },
  errorSubtextDark: {
    color: '#9CA3AF',
  },
});
