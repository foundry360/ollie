import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { HeaderLogo } from '@/components/ui/HeaderLogo';

export default function ChatLayout() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: () => <HeaderLogo />,
        headerStyle: {
          backgroundColor: isDark ? '#111827' : '#73af17',
          borderBottomWidth: 0,
          height: 120,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleContainerStyle: {
          paddingBottom: 24,
        },
        headerLeftContainerStyle: {
          paddingBottom: 24,
        },
        headerRightContainerStyle: {
          paddingBottom: 24,
        },
        headerShadowVisible: false,
        headerTintColor: '#FFFFFF',
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen 
        name="[taskId]" 
        options={{ 
          title: 'Chat',
          headerShown: false, // Chat screen has custom header
        }} 
      />
    </Stack>
  );
}

