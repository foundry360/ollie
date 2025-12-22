import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, Pressable, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { usePendingApprovals, useApproveTask, useRejectTask } from '@/hooks/useParentApprovals';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Loading } from '@/components/ui/Loading';

export default function ParentDashboardScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const {
    data: approvals = [],
    isLoading,
    isRefetching,
    refetch,
  } = usePendingApprovals();

  const approveMutation = useApproveTask();
  const rejectMutation = useRejectTask();

  const handleApprove = async (approvalId: string) => {
    Alert.alert(
      'Approve Task',
      'Are you sure you want to approve this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveMutation.mutateAsync(approvalId);
              Alert.alert('Success', 'Task approved!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve task');
            }
          },
        },
      ]
    );
  };

  const handleReject = async (approvalId: string) => {
    if (rejectingId !== approvalId) {
      setRejectingId(approvalId);
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        approvalId,
        reason: rejectReason || undefined,
      });
      Alert.alert('Success', 'Task rejected.');
      setRejectingId(null);
      setRejectReason('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to reject task');
    }
  };

  const handleCancelReject = () => {
    setRejectingId(null);
    setRejectReason('');
  };

  if (user?.role !== 'parent') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Parent Dashboard
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

  const renderApproval = ({ item }: { item: any }) => {
    const isRejecting = rejectingId === item.id;

    return (
      <View style={[styles.approvalCard, cardStyle]}>
        <View style={styles.approvalHeader}>
          <View style={styles.approvalInfo}>
            <Text style={[styles.taskTitle, titleStyle]}>{item.task_title}</Text>
            <Text style={[styles.approvalDate, labelStyle]}>
              Requested {format(new Date(item.created_at), 'MMM d, yyyy')}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>PENDING</Text>
          </View>
        </View>

        {isRejecting ? (
          <View style={styles.rejectForm}>
            <Input
              label="Reason for rejection (optional)"
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Enter reason..."
              multiline
            />
            <View style={styles.rejectActions}>
              <Button
                title="Cancel"
                onPress={handleCancelReject}
                variant="secondary"
              />
              <Button
                title="Reject"
                onPress={() => handleReject(item.id)}
                variant="danger"
                loading={rejectMutation.isPending}
              />
            </View>
          </View>
        ) : (
          <View style={styles.approvalActions}>
            <Button
              title="Approve"
              onPress={() => handleApprove(item.id)}
              loading={approveMutation.isPending}
              fullWidth
            />
            <Button
              title="Reject"
              onPress={() => handleReject(item.id)}
              variant="danger"
              fullWidth
            />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, titleStyle]}>Parent Dashboard</Text>
        <Text style={[styles.headerSubtitle, textStyle]}>
          Review and approve task requests
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
                name="checkmark-circle-outline"
                size={64}
                color={isDark ? '#6B7280' : '#9CA3AF'}
              />
              <Text style={[styles.emptyText, titleStyle]}>No pending approvals</Text>
              <Text style={[styles.emptySubtext, textStyle]}>
                All task requests have been reviewed
              </Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
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
    fontSize: 20,
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
    backgroundColor: '#73af1720',
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  approvalInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 18,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
  approvalActions: {
    gap: 12,
  },
  rejectForm: {
    gap: 12,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 12,
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
    fontSize: 20,
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
