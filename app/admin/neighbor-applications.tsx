import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { 
  getAllPendingNeighborApplications, 
  approveNeighborApplication, 
  rejectNeighborApplication,
  type PendingNeighborApplication 
} from '@/lib/api/neighborApplications';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Loading } from '@/components/ui/Loading';

export default function NeighborApplicationsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Admin Access Required
          </Text>
          <Text style={[styles.errorSubtext, isDark && styles.errorSubtextDark]}>
            This page is only available for administrators
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { data: applications = [], isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['neighbor-applications'],
    queryFn: getAllPendingNeighborApplications,
  });

  const approveMutation = useMutation({
    mutationFn: (applicationId: string) => approveNeighborApplication(applicationId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighbor-applications'] });
      Alert.alert('Success', 'Application approved successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to approve application');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ applicationId, reason }: { applicationId: string; reason?: string }) =>
      rejectNeighborApplication(applicationId, user!.id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighbor-applications'] });
      setRejectingId(null);
      setRejectReason('');
      Alert.alert('Success', 'Application rejected');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to reject application');
    },
  });

  const handleApprove = (applicationId: string) => {
    Alert.alert(
      'Approve Application',
      'Are you sure you want to approve this neighbor application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: () => approveMutation.mutate(applicationId),
        },
      ]
    );
  };

  const handleReject = (applicationId: string) => {
    if (rejectingId === applicationId) {
      // Submit rejection
      rejectMutation.mutate({ applicationId, reason: rejectReason || undefined });
    } else {
      // Show rejection form
      setRejectingId(applicationId);
      setRejectReason('');
    }
  };

  const handleCancelReject = () => {
    setRejectingId(null);
    setRejectReason('');
  };

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

  const renderApplication = ({ item }: { item: PendingNeighborApplication }) => {
    const isRejecting = rejectingId === item.id;

    return (
      <View style={[styles.applicationCard, cardStyle]}>
        <View style={styles.applicationHeader}>
          <View style={styles.applicationInfo}>
            <Text style={[styles.name, titleStyle]}>{item.full_name}</Text>
            <Text style={[styles.email, labelStyle]}>{item.email}</Text>
            <Text style={[styles.phone, labelStyle]}>{item.phone}</Text>
            {item.address && (
              <Text style={[styles.address, labelStyle]}>
                <Ionicons name="location-outline" size={14} /> {item.address}
              </Text>
            )}
            {item.date_of_birth && (
              <Text style={[styles.dob, labelStyle]}>
                DOB: {format(new Date(item.date_of_birth), 'MMM d, yyyy')}
              </Text>
            )}
            <Text style={[styles.submittedDate, labelStyle]}>
              Submitted: {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
            </Text>
            <View style={styles.verificationRow}>
              <Ionicons 
                name={item.phone_verified ? "checkmark-circle" : "close-circle"} 
                size={16} 
                color={item.phone_verified ? "#10B981" : "#EF4444"} 
              />
              <Text style={[styles.verificationText, labelStyle]}>
                Phone {item.phone_verified ? 'Verified' : 'Not Verified'}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {item.status === 'pending' && (
          <>
            {isRejecting ? (
              <View style={styles.rejectForm}>
                <Input
                  label="Rejection Reason (optional)"
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Enter reason for rejection..."
                  multiline
                  numberOfLines={3}
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
              <View style={styles.actions}>
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
          </>
        )}

        {item.status === 'rejected' && item.rejection_reason && (
          <View style={styles.reasonContainer}>
            <Text style={[styles.reasonLabel, labelStyle]}>Rejection Reason:</Text>
            <Text style={[styles.reasonText, textStyle]}>{item.rejection_reason}</Text>
          </View>
        )}
      </View>
    );
  };

  const pendingApplications = applications.filter(app => app.status === 'pending');
  const otherApplications = applications.filter(app => app.status !== 'pending');

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Text style={[styles.headerTitle, titleStyle]}>Neighbor Applications</Text>
        <Text style={[styles.headerSubtitle, textStyle]}>
          Review and approve neighbor signup applications
        </Text>
      </View>

      {isLoading ? (
        <Loading />
      ) : (
        <FlatList
          data={[...pendingApplications, ...otherApplications]}
          renderItem={renderApplication}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={isDark ? '#FFFFFF' : '#000000'}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
              <Text style={[styles.emptyText, textStyle]}>No applications found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  errorTextDark: {
    color: '#FFFFFF',
  },
  errorSubtext: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    color: '#666666',
  },
  errorSubtextDark: {
    color: '#9CA3AF',
  },
  header: {
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    borderBottomColor: '#374151',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  applicationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#73af1720',
    borderColor: '#1F2937',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  applicationInfo: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#666666',
  },
  phone: {
    fontSize: 14,
    color: '#666666',
  },
  address: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  dob: {
    fontSize: 14,
    color: '#666666',
  },
  submittedDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
  },
  verificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  verificationText: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    height: 32,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    gap: 8,
    marginTop: 16,
  },
  rejectForm: {
    marginTop: 16,
    gap: 12,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reasonContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#DC2626',
  },
  reasonText: {
    fontSize: 14,
    color: '#991B1B',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  textLight: {
    color: '#000000',
  },
  labelDark: {
    color: '#9CA3AF',
  },
  labelLight: {
    color: '#666666',
  },
});
