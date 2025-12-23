import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useNeighborStats } from '@/hooks/useNeighborStats';
import { getGreeting } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';

export function NeighborHeader() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: stats, isLoading } = useNeighborStats();

  const greeting = getGreeting();
  const userName = user?.full_name?.split(' ')[0] || 'there';

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;
  const valueStyle = isDark ? styles.valueDark : styles.valueLight;

  const handleActivePress = () => {
    router.push('/(tabs)/tasks');
  };

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
        <Pressable 
          style={[styles.statCard, cardStyle]}
          onPress={handleActivePress}
          android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
        >
          <Ionicons name="time" size={24} color="#fbbc04" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isLoading ? '...' : stats?.activeGigs || 0}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>Active</Text>
        </Pressable>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="checkmark-circle" size={24} color="#73af17" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isLoading ? '...' : stats?.completedGigs || 0}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>Completed</Text>
        </View>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="cash" size={24} color="#F59E0B" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            ${isLoading ? '...' : (stats?.totalSpent || 0).toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>Total Spent</Text>
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
    fontSize: 15,
    fontWeight: '600',
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
    minWidth: 0,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
  },
  cardLight: {
    backgroundColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  statValue: {
    fontSize: 16,
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














