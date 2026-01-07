import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';

export default function LegalLayout() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false, // We use custom headers in the components
      }}
    >
      <Stack.Screen 
        name="terms" 
        options={{ 
          title: 'Terms of Use',
        }} 
      />
      <Stack.Screen 
        name="privacy" 
        options={{ 
          title: 'Privacy Policy',
        }} 
      />
    </Stack>
  );
}

