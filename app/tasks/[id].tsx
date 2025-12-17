import { View, Text, StyleSheet, ScrollView, Alert, Image, Pressable, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTask, useAcceptTask, useStartTask, useCompleteTask, useCancelTask } from '@/hooks/useTasks';
import { useAuthStore } from '@/stores/authStore';
import { TaskStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '@/components/ui/Loading';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: task, isLoading } = useTask(id as string);
  const acceptTaskMutation = useAcceptTask();
  const startTaskMutation = useStartTask();
  const completeTaskMutation = useCompleteTask();
  const cancelTaskMutation = useCancelTask();

  const isPoster = user?.id === task?.poster_id;
  const isTeen = user?.id === task?.teen_id;
  const canAccept = !isPoster && !isTeen && task?.status === 'open' && user?.role === 'teen';
  const canStart = isTeen && task?.status === 'accepted';
  const canComplete = isTeen && task?.status === 'in_progress';
  const canCancel = (isPoster || isTeen) && task?.status !== 'completed' && task?.status !== 'cancelled';

  const handleAccept = async () => {
    if (!task) return;
    
    Alert.alert(
      'Accept Task',
      `Are you sure you want to accept "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await acceptTaskMutation.mutateAsync(task.id);
              Alert.alert('Success', 'Task accepted! Waiting for parent approval if required.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to accept task');
            }
          },
        },
      ]
    );
  };

  const handleStart = async () => {
    if (!task) return;
    
    try {
      await startTaskMutation.mutateAsync(task.id);
      Alert.alert('Success', 'Task started!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start task');
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    
    Alert.alert(
      'Complete Task',
      `Mark "${task.title}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await completeTaskMutation.mutateAsync(task.id);
              Alert.alert('Success', 'Task completed! Earnings will be processed.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to complete task');
            }
          },
        },
      ]
    );
  };

  const handleCancel = async () => {
    if (!task) return;
    
    Alert.alert(
      'Cancel Task',
      `Are you sure you want to cancel "${task.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelTaskMutation.mutateAsync(task.id);
              Alert.alert('Success', 'Task cancelled.', [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to cancel task');
            }
          },
        },
      ]
    );
  };

  const handleOpenMap = () => {
    if (!task) return;
    const { latitude, longitude } = task.location;
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?daddr=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${encodeURIComponent(task.address)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps app');
    });
  };

  const handleChat = () => {
    router.push(`/chat/${task?.id}`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <Loading />
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
            Task not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  const sectionStyle = isDark ? styles.sectionDark : styles.sectionLight;

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return '#10B981';
      case 'accepted':
        return '#3B82F6';
      case 'in_progress':
        return '#F59E0B';
      case 'completed':
        return '#6366F1';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {task.photos && task.photos.length > 0 && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: task.photos[0] }} style={styles.image} />
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />
              <Text style={[styles.statusText, isDark && styles.statusTextDark]}>
                {task.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.title, titleStyle]}>{task.title}</Text>
            <View style={styles.payRow}>
              <Ionicons name="cash" size={24} color="#73af17" />
              <Text style={[styles.payAmount, titleStyle]}>${task.pay.toFixed(2)}</Text>
            </View>
          </View>

          <View style={[styles.section, sectionStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Description</Text>
            <Text style={[styles.description, textStyle]}>{task.description}</Text>
          </View>

          <View style={[styles.section, sectionStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Details</Text>
            {task.estimated_hours && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                <Text style={[styles.detailText, textStyle]}>
                  Estimated: {task.estimated_hours} hours
                </Text>
              </View>
            )}
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.detailText, textStyle]}>{task.address}</Text>
            </View>
            {task.required_skills && task.required_skills.length > 0 && (
              <View style={styles.skillsContainer}>
                <Text style={[styles.label, labelStyle]}>Required Skills:</Text>
                <View style={styles.skills}>
                  {task.required_skills.map((skill, index) => (
                    <View key={index} style={[styles.skillTag, isDark && styles.skillTagDark]}>
                      <Text style={[styles.skillText, isDark && styles.skillTextDark]}>{skill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>

          <View style={[styles.section, sectionStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Location</Text>
            <View style={[styles.locationContainer, isDark && styles.locationContainerDark]}>
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={24} color="#73af17" />
                <View style={styles.locationTextContainer}>
                  <Text style={[styles.locationAddress, textStyle]}>{task.address}</Text>
                  <Text style={[styles.locationCoords, labelStyle]}>
                    {task.location.latitude.toFixed(6)}, {task.location.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>
            <Pressable style={styles.mapButton} onPress={handleOpenMap}>
              <Ionicons name="navigate" size={20} color="#73af17" />
              <Text style={[styles.mapButtonText, isDark && styles.mapButtonTextDark]}>
                Open in Maps
              </Text>
            </Pressable>
          </View>

          <View style={styles.actions}>
            {canAccept && (
              <Button
                title="Accept Task"
                onPress={handleAccept}
                loading={acceptTaskMutation.isPending}
                fullWidth
              />
            )}
            {canStart && (
              <Button
                title="Start Task"
                onPress={handleStart}
                loading={startTaskMutation.isPending}
                fullWidth
              />
            )}
            {canComplete && (
              <Button
                title="Mark as Complete"
                onPress={handleComplete}
                loading={completeTaskMutation.isPending}
                fullWidth
              />
            )}
            {(isPoster || isTeen) && task.status !== 'completed' && task.status !== 'cancelled' && (
              <Button
                title="Chat"
                onPress={handleChat}
                variant="secondary"
                fullWidth
              />
            )}
            {canCancel && (
              <Button
                title="Cancel Task"
                onPress={handleCancel}
                loading={cancelTaskMutation.isPending}
                variant="danger"
                fullWidth
              />
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    width: '100%',
    height: 250,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusTextDark: {
    color: '#9CA3AF',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  sectionDark: {
    backgroundColor: '#000000',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000000',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  skillsContainer: {
    marginTop: 12,
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillTagDark: {
    backgroundColor: '#1E3A8A',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#93C5FD',
  },
  locationContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  locationContainerDark: {
    backgroundColor: '#374151',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
    color: '#000000',
  },
  locationCoords: {
    fontSize: 12,
    color: '#6B7280',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#73af17',
  },
  mapButtonTextDark: {
    color: '#73af17',
  },
  actions: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
  },
  errorTextDark: {
    color: '#9CA3AF',
  },
});
