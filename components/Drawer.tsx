import { useState, createContext } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Alert, Platform } from 'react-native';
import { Drawer as DrawerLayout } from 'react-native-drawer-layout';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { signOut } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Create a context to pass openDrawer function and drawer state
export const DrawerContext = createContext<{ openDrawer: () => void; drawerOpen: boolean }>({ 
  openDrawer: () => {}, 
  drawerOpen: false 
});

interface DrawerProps {
  children: React.ReactNode;
}

export function Drawer({ children }: DrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  const openDrawer = () => {
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel', onPress: closeDrawer },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear user state first
              setUser(null);
              
              // Note: We intentionally keep 'last_login_email' in AsyncStorage
              // so the welcome back greeting and password-only login still work
              
              // Sign out from Supabase
              await signOut();
              
              // Close drawer
              closeDrawer();
              
              // Navigate to splash screen
              router.replace('/splash');
            } catch (error: any) {
              console.error('Logout error:', error);
              // Even if there's an error, clear local state and navigate
              setUser(null);
              closeDrawer();
              router.replace('/splash');
              Alert.alert('Logout', 'You have been logged out.');
            }
          },
        },
      ]
    );
  };

  const handleNavigate = (path: string) => {
    closeDrawer();
    router.push(path);
  };

  const drawerContent = (
    <SafeAreaView style={[styles.drawerContainer, isDark && styles.drawerContainerDark]} edges={['top', 'bottom', 'left']}>
      <ScrollView style={styles.drawerContent}>
        <Pressable style={styles.profileSection} onPress={closeDrawer}>
          {user?.profile_photo_url ? (
            <Image source={{ uri: user.profile_photo_url }} style={styles.profileAvatar} />
          ) : (
            <View style={[styles.profileAvatarPlaceholder, isDark && styles.profileAvatarPlaceholderDark]}>
              <Ionicons name="person" size={32} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, isDark && styles.profileNameDark]}>
              {user?.full_name || 'User'}
            </Text>
            <Text style={[styles.profileRole, isDark && styles.profileRoleDark]}>
              {user?.role === 'teen' ? 'Teenlancer' : 
               user?.role === 'poster' ? 'Neighbor' : 
               user?.role === 'parent' ? 'Parent' : 
               user?.role === 'admin' ? 'Admin' : 
               user?.role || 'User'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.menuSection}>
          <Pressable
            style={[styles.menuItem, isDark && styles.menuItemDark]}
            onPress={() => handleNavigate('/(tabs)/profile')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="person-outline" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemText, isDark && styles.menuItemTextDark]}>Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          <Pressable
            style={[styles.menuItem, isDark && styles.menuItemDark]}
            onPress={() => handleNavigate('/(tabs)/settings')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="settings-outline" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemText, isDark && styles.menuItemTextDark]}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          {user?.role === 'teen' && (
            <Pressable
              style={[styles.menuItem, isDark && styles.menuItemDark]}
              onPress={() => handleNavigate('/(tabs)/qr-code')}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name="qr-code-outline" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
                <Text style={[styles.menuItemText, isDark && styles.menuItemTextDark]}>Share Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </Pressable>
          )}
        </View>

        <View style={[styles.divider, isDark && styles.dividerDark]} />

        <Pressable
          style={[styles.logoutButton, isDark && styles.logoutButtonDark]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#73af17" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  // On web, just render children without drawer (drawer-layout doesn't work on web)
  if (Platform.OS === 'web') {
    return (
      <DrawerContext.Provider value={{ openDrawer: () => {}, drawerOpen: false }}>
        <View style={styles.content}>
          {children}
        </View>
      </DrawerContext.Provider>
    );
  }

  return (
    <DrawerContext.Provider value={{ openDrawer, drawerOpen }}>
      <DrawerLayout
        open={drawerOpen}
        onOpen={openDrawer}
        onClose={closeDrawer}
        drawerPosition="left"
        drawerType="slide"
        drawerStyle={{ width: 280 }}
        renderDrawerContent={() => drawerContent}
        overlayStyle={isDark ? styles.overlayDark : styles.overlay}
      >
        <View style={styles.content}>
          {children}
        </View>
      </DrawerLayout>
    </DrawerContext.Provider>
  );
}


const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  drawerContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  drawerContainerDark: {
    backgroundColor: '#111111',
  },
  drawerContent: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  profileAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  profileAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  profileNameDark: {
    color: '#FFFFFF',
  },
  profileRole: {
    fontSize: 14,
    color: '#6B7280',
  },
  profileRoleDark: {
    color: '#9CA3AF',
  },
  menuSection: {
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  menuItemDark: {
    // Same styling for dark mode
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  menuItemTextDark: {
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  dividerDark: {
    backgroundColor: '#1F1F1F',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 16,
    marginTop: 8,
  },
  logoutButtonDark: {
    // Same styling for dark mode
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#73af17',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  overlayDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
});

