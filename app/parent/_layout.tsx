import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { HeaderLogo } from '@/components/ui/HeaderLogo';

export default function ParentLayout() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: () => <HeaderLogo />,
        headerStyle: {
          backgroundColor: isDark ? '#000000' : '#73af17',
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
        headerTintColor: isDark ? '#FFFFFF' : '#000000',
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen 
        name="dashboard" 
        options={{ 
          title: 'Parent Dashboard',
        }} 
      />
      <Stack.Screen 
        name="approvals" 
        options={{ 
          title: 'Approvals',
        }} 
      />
    </Stack>
  );
}

