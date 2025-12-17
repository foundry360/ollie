import { Stack, useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { HeaderLogo } from '@/components/ui/HeaderLogo';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function HeaderBackButton() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  return (
    <Pressable
      onPress={() => router.back()}
      android_ripple={null}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 16,
        backgroundColor: 'transparent',
      }}
    >
      <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
      <Text style={{ fontSize: 16, color: isDark ? '#FFFFFF' : '#000000' }}>Back</Text>
    </Pressable>
  );
}

export default function AuthLayout() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const screenOptions = {
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
  };

  return (
    <Stack
      screenOptions={screenOptions}
    >
      <Stack.Screen 
        name="age-gate-teen" 
        options={{ 
          title: 'Age Verification',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="request-approval" 
        options={{ 
          title: 'Request Approval',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="request-sent" 
        options={{ 
          title: 'Request Sent',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="pending-approval" 
        options={{ 
          title: 'Pending Approval',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="check-status" 
        options={{ 
          title: 'Check Approval Status',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="complete-account" 
        options={{ 
          title: 'Complete Account',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="signup-adult" 
        options={{ 
          title: 'Neighbor Signup',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="login" 
        options={{ 
          title: 'Login',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="callback" 
        options={{ 
          title: 'Signing In...',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="confirm-email" 
        options={{ 
          title: 'Confirm Email',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="verify-phone" 
        options={{ 
          title: 'Verify Phone',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="neighbor-application" 
        options={{ 
          title: 'Application',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="pending-neighbor-approval" 
        options={{ 
          title: 'Pending Approval',
          headerShown: false,
        }} 
      />
      <Stack.Screen 
        name="complete-neighbor-profile" 
        options={{ 
          title: 'Complete Profile',
          headerShown: false,
        }} 
      />
    </Stack>
  );
}

