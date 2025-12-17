import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useActiveTask, useCompleteTask } from '@/hooks/useTasks';
import { calculateProgressPercentage, formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

export function ActiveTaskCard() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: activeTask } = useActiveTask();
  const completeTaskMutation = useCompleteTask();
  
  if (!activeTask) return null;

  const progress = calculateProgressPercentage(
    activeTask.updated_at,
    activeTask.estimated_hours
  );

  const handleComplete = async () => {
    try {
      await completeTaskMutation.mutateAsync(activeTask.id);
      router.push(`/tasks/${activeTask.id}`);
    } catch (error) {
      console.error('Error completing task:', error);
    }
  };

  const handlePress = () => {
    router.push(`/tasks/${activeTask.id}`);
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{activeTask.title}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="location" size={16} color="#FFFFFF" />
              <Text style={styles.metaText} numberOfLines={1}>
                {activeTask.address.split(',')[0]}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="cash" size={16} color="#FFFFFF" />
              <Text style={styles.metaText}>${activeTask.pay.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>{progress}% complete</Text>
          </View>

          <Text style={styles.timeText}>
            Started {formatTimeAgo(activeTask.updated_at)}
          </Text>

          <Pressable
            onPress={handleComplete}
            disabled={completeTaskMutation.isPending}
            style={[styles.completeButton, completeTaskMutation.isPending && styles.completeButtonDisabled]}
          >
            {completeTaskMutation.isPending ? (
              <ActivityIndicator color="#3B82F6" />
            ) : (
              <Text style={styles.completeButtonText}>Mark Complete</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: 16,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  timeText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    marginBottom: 12,
  },
  completeButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
});

