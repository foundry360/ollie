import { View, Text, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useWeeklyEarnings } from '@/hooks/useWeeklyEarnings';
import { Ionicons } from '@expo/vector-icons';

export function WeeklyEarnings() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: weeklyData, isLoading } = useWeeklyEarnings();

  if (isLoading || !weeklyData) {
    return (
      <View style={[styles.container, styles.cardBackground]}>
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </View>
    );
  }

  const maxAmount = Math.max(...weeklyData.dailyBreakdown.map(d => d.amount), 1);
  const isPositive = weeklyData.percentageChange >= 0;

  return (
    <View style={[styles.container, styles.cardBackground]}>
      <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.totalLabel}>This Week</Text>
            <Text style={styles.totalAmount}>${weeklyData.total.toFixed(2)}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              <Text style={styles.statText}>{weeklyData.taskCount} gigs</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons
                name={isPositive ? 'arrow-up' : 'arrow-down'}
                size={16}
                color="#FFFFFF"
              />
              <Text style={styles.statText}>
                {isPositive ? '+' : ''}{weeklyData.percentageChange.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {weeklyData.dailyBreakdown.map((day, index) => {
                const height = maxAmount > 0 ? (day.amount / maxAmount) * 60 : 0;
                return (
                  <View key={index} style={styles.chartBarContainer}>
                    <View style={styles.barWrapper}>
                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(height, 2) },
                        ]}
                      />
                    </View>
                    <Text style={styles.dayLabel}>{day.dayName}</Text>
                    <Text style={styles.dayAmount}>
                      ${day.amount > 0 ? day.amount.toFixed(0) : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
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
  cardBackground: {
    backgroundColor: '#73af17',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  chartContainer: {
    marginTop: 8,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    width: '80%',
    height: 60,
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  bar: {
    width: '100%',
    backgroundColor: '#A8D574',
    borderRadius: 4,
    minHeight: 2,
  },
  dayLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 4,
  },
  dayAmount: {
    fontSize: 9,
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 2,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});






