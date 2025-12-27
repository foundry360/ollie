import { View, StyleSheet, Text } from 'react-native';
import { Task } from '@/types';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface MarketplaceMapProps {
  gigs: Task[];
  userLocation: { latitude: number; longitude: number } | null;
  onMarkerPress: (taskId: string) => void;
}

export function MarketplaceMap({ gigs, userLocation, onMarkerPress }: MarketplaceMapProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  // Note: expo-maps requires a development build and doesn't work in Expo Go
  // This is a fallback component that shows a message instead
  // To enable map view, create a development build: npx expo run:ios or npx expo run:android

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={styles.emptyContainer}>
        <Ionicons
          name="map-outline"
          size={64}
          color={isDark ? '#6B7280' : '#9CA3AF'}
        />
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Map View Unavailable
        </Text>
        <Text style={[styles.message, isDark && styles.messageDark]}>
          Map view requires a development build.{'\n'}
          Use the list view to browse gigs instead.
        </Text>
        <Text style={[styles.hint, isDark && styles.hintDark]}>
          To enable map view, run:{'\n'}
          npx expo run:ios{'\n'}
          or{'\n'}
          npx expo run:android
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  messageDark: {
    color: '#9CA3AF',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  hintDark: {
    color: '#6B7280',
  },
});























