import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useConversations } from '@/hooks/useMessages';
import { Ionicons } from '@expo/vector-icons';

interface ActionButton {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  badge?: number;
}

export function QuickActions() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: conversations = [] } = useConversations();

  const unreadCount = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);

  const actions: ActionButton[] = [
    {
      id: 'browse',
      label: 'Marketplace',
      icon: 'search',
      route: '/tasks',
      color: '#73af17',
    },
    {
      id: 'schedule',
      label: 'My Schedule',
      icon: 'calendar',
      route: '/schedule',
      color: '#3B82F6',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: 'chatbubbles',
      route: '/messages',
      color: '#8B5CF6',
      badge: unreadCount,
    },
    {
      id: 'earnings',
      label: 'Earnings',
      icon: 'cash',
      route: '/earnings',
      color: '#10B981',
    },
  ];

  const handlePress = (route: string) => {
    router.push(route as any);
  };

  const buttonStyle = (color: string) => [
    styles.button,
    { backgroundColor: color },
    isDark && styles.buttonDark,
  ];
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            style={buttonStyle(action.color)}
            onPress={() => handlePress(action.route)}
            android_ripple={{ color: 'rgba(255, 255, 255, 0.2)' }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={action.icon} size={28} color="#FFFFFF" />
              {action.badge && action.badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {action.badge > 99 ? '99+' : action.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, textStyle]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  buttonDark: {
    opacity: 0.9,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  textLight: {
    color: '#FFFFFF',
  },
  textDark: {
    color: '#FFFFFF',
  },
});








