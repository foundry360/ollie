import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingCompletionApprovals, approveCompletion, rejectCompletion, CompletionApproval } from '@/lib/api/completionApprovals';
import { format } from 'date-fns';
import { Alert } from '@/components/ui/Alert';
import { useRouter } from 'expo-router';

export function CompletionApprovalsCard() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  // Only show for neighbors (posters)
  if (user?.role !== 'poster') {
    return null;
  }

  const { data: approvals = [], isLoading, error: queryError } = useQuery({
    queryKey: ['pendingCompletionApprovals'],
    queryFn: getPendingCompletionApprovals,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Log errors for debugging
  if (queryError) {
    console.error('Error loading completion approvals:', queryError);
  }

  const approveMutation = useMutation({
    mutationFn: approveCompletion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingCompletionApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['userTasks'] });
      Alert.alert('Success', 'Completion approved. Payment will be processed.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to approve completion');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ gigId, reason }: { gigId: string; reason?: string }) => rejectCompletion(gigId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingCompletionApprovals'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['userTasks'] });
      Alert.alert('Success', 'Completion rejected. Gig status reverted to in progress.');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to reject completion');
    },
  });

  // Don't render if no approvals
  if (approvals.length === 0) {
    return null;
  }

  const handleApprove = (gigId: string) => {
    Alert.alert(
      'Approve Completion',
      'Are you sure you want to approve this completion? Payment will be processed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => approveMutation.mutate(gigId),
        },
      ]
    );
  };

  const handleReject = (gigId: string) => {
    Alert.alert(
      'Reject Completion',
      'Are you sure you want to reject this completion? The gig will be reverted to in progress.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => rejectMutation.mutate({ gigId }),
        },
      ]
    );
  };

  const handleViewGig = (gigId: string) => {
    router.push(`/tasks/${gigId}`);
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#F97316" />
          <Text style={[styles.headerTitle, titleStyle]}>Completion Approvals</Text>
          <View style={[styles.badge, isDark ? styles.badgeDark : styles.badgeLight]}>
            <Text style={[styles.badgeText, isDark ? styles.badgeTextDark : styles.badgeTextLight]}>
              {approvals.length}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.approvalsList}>
        {approvals.map((approval) => (
          <View key={approval.id} style={[styles.approvalCard, cardStyle]}>
            <View style={styles.approvalHeader}>
              <View style={styles.approvalInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                    {approval.gig?.title || 'Unknown Gig'}
                  </Text>
                  <Pressable
                    style={[styles.viewButton, isDark ? styles.viewButtonDark : styles.viewButtonLight]}
                    onPress={() => handleViewGig(approval.gig_id)}
                  >
                    <Ionicons name="eye-outline" size={16} color={isDark ? '#D1D5DB' : '#374151'} />
                    <Text style={[styles.viewButtonText, labelStyle]}>View</Text>
                  </Pressable>
                </View>
                <Text style={[styles.teenName, labelStyle]}>
                  {approval.teen?.full_name || 'Unknown Teenlancer'}
                </Text>
                <Text style={[styles.amount, textStyle]}>
                  ${approval.gig?.pay?.toFixed(2) || '0.00'}
                </Text>
                <Text style={[styles.date, labelStyle]}>
                  Submitted {format(new Date(approval.created_at), 'MMM d, h:mm a')}
                </Text>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable
                style={[styles.rejectButton, isDark && styles.rejectButtonDark]}
                onPress={() => handleReject(approval.gig_id)}
                disabled={rejectMutation.isPending}
              >
                <Ionicons name="close-circle-outline" size={16} color="#F97316" />
                <Text style={styles.rejectButtonText}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.approveButton, isDark && styles.approveButtonDark]}
                onPress={() => handleApprove(approval.gig_id)}
                disabled={approveMutation.isPending}
              >
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text style={styles.approveButtonText}>Approve</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeLight: {
    backgroundColor: '#E5E7EB',
  },
  badgeDark: {
    backgroundColor: '#374151',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextLight: {
    color: '#111827',
  },
  badgeTextDark: {
    color: '#FFFFFF',
  },
  approvalsList: {
    gap: 12,
  },
  approvalCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  approvalHeader: {
    marginBottom: 12,
  },
  approvalInfo: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  gigTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  teenName: {
    fontSize: 14,
    marginBottom: 4,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#73af17',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    marginTop: 4,
  },
  textLight: {
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  labelLight: {
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    backgroundColor: 'transparent',
  },
  viewButtonLight: {
    backgroundColor: 'transparent',
  },
  viewButtonDark: {
    backgroundColor: 'transparent',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#F97316',
    flex: 1,
  },
  rejectButtonDark: {
    backgroundColor: 'transparent',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F97316',
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    backgroundColor: '#73af17',
    flex: 1,
  },
  approveButtonDark: {
    backgroundColor: '#73af17',
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

