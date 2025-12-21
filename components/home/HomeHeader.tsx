import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTeenStats } from '@/hooks/useTeenStats';
import { getGreeting } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { ReviewsModal } from '@/components/reviews/ReviewsModal';

export function HomeHeader() {
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: stats, isLoading } = useTeenStats();
  const [showReviewsModal, setShowReviewsModal] = useState(false);

  const greeting = getGreeting();
  const userName = user?.full_name?.split(' ')[0] || 'there';

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : {};
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const labelStyle = isDark ? styles.labelDark : {};
  const valueStyle = isDark ? styles.valueDark : {};

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
          onPress={() => {
            if (user?.id && (stats?.reviewCount || 0) > 0) {
              setShowReviewsModal(true);
            }
          }}
        >
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isLoading ? '...' : stats?.rating.toFixed(1) || '0.0'}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>
            {isLoading ? '...' : `${stats?.reviewCount || 0} reviews`}
          </Text>
        </Pressable>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="checkmark-circle" size={24} color="#73af17" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {isLoading ? '...' : stats?.tasksCompleted || 0}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>Completed</Text>
        </View>

        <View style={[styles.statCard, cardStyle]}>
          <Ionicons name="cash" size={24} color="#73af17" />
          <Text 
            style={[styles.statValue, valueStyle]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            ${isLoading ? '...' : (stats?.weeklyEarnings || 0).toFixed(2)}
          </Text>
          <Text style={[styles.statLabel, labelStyle]}>This Week</Text>
        </View>
      </View>
      {user?.id && (
        <ReviewsModal
          visible={showReviewsModal}
          userId={user.id}
          onClose={() => setShowReviewsModal(false)}
        />
      )}
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






