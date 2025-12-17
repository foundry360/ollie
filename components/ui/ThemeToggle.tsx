import { View, Pressable, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeToggle() {
  const { colorScheme, setTheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <Pressable
      onPress={toggleTheme}
      style={[
        styles.toggle,
        isDark ? styles.toggleEnabled : styles.toggleDisabled,
      ]}
    >
      <View
        style={[
          styles.pill,
          isDark ? styles.pillEnabled : styles.pillDisabled,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  toggleEnabled: {
    backgroundColor: '#73af17',
  },
  toggleDisabled: {
    backgroundColor: '#D1D5DB',
  },
  pill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  pillEnabled: {
    alignSelf: 'flex-end',
  },
  pillDisabled: {
    alignSelf: 'flex-start',
  },
});
