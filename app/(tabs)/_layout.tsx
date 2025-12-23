import { Tabs, useSegments } from 'expo-router';
import { Platform, Pressable, Image, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { Drawer, DrawerContext } from '@/components/Drawer';
import { HeaderLogo } from '@/components/ui/HeaderLogo';
import { useContext, useEffect, useMemo } from 'react';
import { useConversations, messageKeys } from '@/hooks/useMessages';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

function HeaderLeft() {
  const { openDrawer, drawerOpen } = useContext(DrawerContext);
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const segments = useSegments();
  const isDark = colorScheme === 'dark';

  // #region agent log
  useEffect(() => {
    const currentRoute = segments[segments.length - 1];
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/_layout.tsx:14',message:'HeaderLeft render/segment change',data:{currentRoute,segments:segments.join('/'),drawerOpen},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
  }, [segments, drawerOpen]);
  // #endregion

  // Hide the avatar when drawer is open
  if (drawerOpen) {
    return null;
  }

  // Get the current route name from segments
  const currentRoute = segments[segments.length - 1];
  const isProfileOrSettings = currentRoute === 'profile' || currentRoute === 'settings' || currentRoute === 'qr-code';

  return (
    <Pressable
      onPress={openDrawer}
      style={{ marginLeft: 16, padding: 4 }}
    >
      {isProfileOrSettings ? (
        <Ionicons name="chevron-back" size={28} color={isDark ? '#FFFFFF' : '#000000'} />
      ) : (
        <>
          {user?.profile_photo_url ? (
            <Image 
              source={{ uri: user.profile_photo_url }} 
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#73af17' }} 
            />
          ) : (
            <View style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 20, 
              backgroundColor: isDark ? '#374151' : '#F3F4F6',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: '#73af17'
            }}>
              <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

function HeaderRight() {
  const { colorScheme } = useThemeStore();
  const segments = useSegments();
  const isDark = colorScheme === 'dark';

  // Get the current route name from segments
  const currentRoute = segments[segments.length - 1];
  // Show notification bell on all screens except profile, settings, and qr-code
  const hideNotificationRoutes = ['profile', 'settings', 'qr-code'];
  const showNotification = !hideNotificationRoutes.includes(currentRoute);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/_layout.tsx:66',message:'HeaderRight render/segment change',data:{currentRoute,showNotification,segments:segments.join('/')},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
  }, [segments, showNotification]);
  // #endregion

  // Always render a container to prevent layout shifts, but hide content when not on main screens
  return (
    <View style={{ marginRight: 16, width: showNotification ? 'auto' : 0, opacity: showNotification ? 1 : 0 }}>
      <Pressable
        onPress={() => {
          // TODO: Navigate to notifications screen
          console.log('Notifications pressed');
        }}
        style={{ padding: 4 }}
        disabled={!showNotification}
      >
        <Ionicons name="notifications-outline" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
      </Pressable>
    </View>
  );
}


export default function TabLayout() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  const segments = useSegments();
  
  // Check if user is a neighbor (poster) - they shouldn't see the Marketplace
  const isNeighbor = user?.role === 'poster';

  // Get conversations to calculate unread message count
  const queryClient = useQueryClient();
  const { data: conversations = [] } = useConversations();
  const unreadCount = useMemo(() => {
    return conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0);
  }, [conversations]);

  // Set up real-time subscription for new messages to update badge
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('messages-badge-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // Invalidate conversations to refetch and update badge
          queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${user.id}`,
        },
        () => {
          // Invalidate on updates (e.g., read status changes)
          queryClient.invalidateQueries({ queryKey: messageKeys.conversations() });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  // #region agent log
  useEffect(() => {
    const currentRoute = segments[segments.length - 1];
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/_layout.tsx:100',message:'TabLayout render/segment change',data:{isDark,colorScheme,currentRoute,segments:segments.join('/')},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'F'})}).catch(()=>{});
  }, [segments, isDark, colorScheme]);
  // #endregion

  // Memoize header style config to prevent recreation on every render
  const headerStyleConfig = useMemo(() => ({
    backgroundColor: isDark ? '#000000' : '#73af17',
    borderBottomWidth: 0,
    height: 120,
    elevation: 0,
    shadowOpacity: 0,
  }), [isDark]);

  // Memoize tab bar style to prevent recreation on every render
  const tabBarStyle = useMemo(() => ({
    backgroundColor: isDark ? '#000000' : '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: isDark ? '#374151' : '#E5E7EB',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    height: Platform.OS === 'ios' ? 88 : 60,
  }), [isDark]);

  // Memoize header container styles to prevent recreation
  const headerTitleContainerStyle = useMemo(() => ({
    paddingBottom: 24,
  }), []);

  const headerLeftContainerStyle = useMemo(() => ({
    paddingBottom: 24,
  }), []);

  const headerRightContainerStyle = useMemo(() => ({
    paddingBottom: 24,
  }), []);

  // Memoize header component functions to prevent recreation
  const headerLeft = useMemo(() => () => <HeaderLeft />, []);
  const headerRight = useMemo(() => () => <HeaderRight />, []);
  const headerTitle = useMemo(() => () => <HeaderLogo />, []);

  // Memoize tab bar label style to prevent recreation
  const tabBarLabelStyle = useMemo(() => ({
    fontSize: 12,
    fontWeight: '500' as const,
  }), []);

  // Memoize screen options to prevent recreation on every render
  const screenOptions = useMemo(() => ({
    headerShown: true,
    headerLeft,
    headerRight,
    headerTitle,
    tabBarActiveTintColor: '#73af17',
    tabBarInactiveTintColor: isDark ? '#9CA3AF' : '#6B7280',
    tabBarStyle,
    headerStyle: headerStyleConfig,
    headerTitleContainerStyle,
    headerLeftContainerStyle,
    headerRightContainerStyle,
    headerShadowVisible: false,
    headerBackTitleVisible: false,
    headerTintColor: isDark ? '#FFFFFF' : '#000000',
    tabBarLabelStyle,
  }), [isDark, headerLeft, headerRight, headerTitle, tabBarStyle, headerStyleConfig, headerTitleContainerStyle, headerLeftContainerStyle, headerRightContainerStyle, tabBarLabelStyle]);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/(tabs)/_layout.tsx:145',message:'Screen options memoized',data:{headerHeight:headerStyleConfig.height,paddingBottom:24,isDark},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  }, [isDark, headerStyleConfig.height]);
  // #endregion

  return (
    <Drawer>
      <Tabs 
        initialRouteName="home"
        screenOptions={screenOptions}
      >
      <Tabs.Screen 
        name="home" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
          tabBarLabelStyle,
        }} 
      />
      <Tabs.Screen 
        name="tasks" 
        options={{ 
          title: 'My Gigs',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" size={size} color={color} />
          ),
          tabBarLabelStyle,
        }} 
      />
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Marketplace',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color} />
          ),
          tabBarLabelStyle,
          href: isNeighbor ? null : undefined, // Hide Marketplace tab for neighbors
        }} 
      />
      <Tabs.Screen 
        name="select-teenlancer" 
        options={{ 
          title: 'Teenlancers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
          tabBarLabelStyle,
          href: isNeighbor ? undefined : null, // Only show for neighbors
        }} 
      />
      <Tabs.Screen 
        name="earnings" 
        options={{ 
          title: 'Wallet',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
          tabBarLabelStyle,
        }} 
      />
      <Tabs.Screen 
        name="messages" 
        options={{ 
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <View style={{ position: 'relative' }}>
              <Ionicons name="chatbubble-outline" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={{
                  position: 'absolute',
                  top: -8,
                  right: -10,
                  backgroundColor: '#73af17',
                  borderRadius: 12,
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: isDark ? '#000000' : '#FFFFFF',
                  zIndex: 10,
                  elevation: 5, // Android shadow
                  shadowColor: '#000', // iOS shadow
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: '700',
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount.toString()}
                  </Text>
                </View>
              )}
            </View>
          ),
          tabBarLabelStyle,
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          title: 'Profile',
          href: null, // Hide from tab bar
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
          href: null, // Hide from tab bar
        }} 
      />
      <Tabs.Screen 
        name="qr-code" 
        options={{ 
          title: 'Share Profile',
          href: null, // Hide from tab bar
        }} 
      />
      <Tabs.Screen 
        name="payment-setup" 
        options={{ 
          title: 'Payment Setup',
          href: null, // Hide from tab bar
        }} 
      />
      <Tabs.Screen 
        name="payment-methods" 
        options={{ 
          title: 'Payment Methods',
          href: null, // Hide from tab bar
        }} 
      />
    </Tabs>
    </Drawer>
  );
}

