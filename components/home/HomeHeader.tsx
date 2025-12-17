import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTeenStats } from '@/hooks/useTeenStats';
import { getGreeting } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

export function HomeHeader() {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: stats, isLoading } = useTeenStats();

  const greeting = getGreeting();
  const userName = user?.full_name?.split(' ')[0] || 'there';

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  const valueStyle = isDark ? styles.valueDark : styles.valueLight;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.greetingContainer}>
          <Text style={[styles.greeting, textStyle]}>
            {greeting}, {userName}!
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text style={[styles.statValue, valueStyle]}>
            {isLoading ? '...' : stats?.rating.toFixed(1) || '0.0'}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>
            {isLoading ? '...' : `${stats?.reviewCount || 0} reviews`}
          </Text>
        </View>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="checkmark-circle" size={24} color="#73af17" />
          <Text style={[styles.statValue, valueStyle]}>
            {isLoading ? '...' : stats?.tasksCompleted || 0}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>Completed</Text>
        </View>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="cash" size={24} color="#73af17" />
          <Text style={[styles.statValue, valueStyle]}>
            ${isLoading ? '...' : (stats?.weeklyEarnings || 0).toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>This Week</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 16,
  },
  containerLight: {
    backgroundColor: 'transparent',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingContainer: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  cardLight: {
    backgroundColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#000000',
  },
  valueDark: {
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    color: '#6B7280',
  },
  labelDark: {
    color: '#9CA3AF',
  },
});

