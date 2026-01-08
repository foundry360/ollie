import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';

export default function HelpLayout() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false, // We use custom headers in the components
      }}
    >
      <Stack.Screen 
        name="help-center" 
        options={{ 
          title: 'Help Center',
        }} 
      />
    </Stack>
  );
}

