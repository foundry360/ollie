import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/hooks/useNotifications';
import type { Notification } from '@/lib/api/notifications';
import { Loading } from '@/components/ui/Loading';

export default function NotificationsScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: notifications = [], isLoading, error, refetch, isRefetching } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead.mutateAsync(notification.id);
    }
    // TODO: Handle navigation based on notification type
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  // Separate unread and read notifications
  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read === true);

  // Debug logging
  useEffect(() => {
    console.log('NotificationsScreen - Total:', notifications.length);
    console.log('NotificationsScreen - Unread:', unreadNotifications.length);
    console.log('NotificationsScreen - Read:', readNotifications.length);
    console.log('NotificationsScreen - Read notifications:', readNotifications.map(n => ({ id: n.id, title: n.title, read: n.read })));
  }, [notifications, unreadNotifications.length, readNotifications.length]);

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const dividerStyle = isDark ? styles.dividerDark : styles.divider;

  if (isLoading && notifications.length === 0) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]} edges={['top', 'left', 'right']}>
        <View style={[styles.header, isDark && styles.headerDark]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            <Text style={[styles.backText, titleStyle]}>Back</Text>
          </Pressable>
          <Text style={[styles.headerTitle, titleStyle]}>Notifications</Text>
          <View style={{ width: 80 }} />
        </View>
        <Loading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.backText, titleStyle]}>Back</Text>
        </Pressable>
        <Text style={[styles.headerTitle, titleStyle]}>Notifications</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#73af17"
          />
        }
      >
        {error ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
            <Text style={[styles.emptyText, textStyle]}>Error loading notifications</Text>
            <Text style={[styles.emptySubtext, subtitleStyle]}>
              {error instanceof Error ? error.message : 'Unknown error'}
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-outline" size={64} color={isDark ? '#6B7280' : '#9CA3AF'} />
            <Text style={[styles.emptyText, textStyle]}>No notifications</Text>
            <Text style={[styles.emptySubtext, subtitleStyle]}>
              You're all caught up!
            </Text>
          </View>
        ) : (
          <>
            {/* Unread Notifications Section */}
            {unreadNotifications.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Unread Notifications</Text>
                  <Pressable onPress={handleMarkAllRead} style={styles.markAllButton}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </Pressable>
                </View>
                {unreadNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
                    cardStyle={cardStyle}
                    titleStyle={titleStyle}
                    textStyle={textStyle}
                    subtitleStyle={subtitleStyle}
                    isDark={isDark}
                    isUnread={true}
                  />
                ))}
                {readNotifications.length > 0 && (
                  <View style={[styles.divider, dividerStyle]} />
                )}
              </>
            )}

            {/* Past Notifications Section */}
            {readNotifications.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Past Notifications</Text>
                </View>
                {readNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    onPress={handleNotificationPress}
                    cardStyle={cardStyle}
                    titleStyle={titleStyle}
                    textStyle={textStyle}
                    subtitleStyle={subtitleStyle}
                    isDark={isDark}
                    isUnread={false}
                  />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
  cardStyle: any;
  titleStyle: any;
  textStyle: any;
  subtitleStyle: any;
  isDark: boolean;
  isUnread: boolean;
}

function NotificationCard({
  notification,
  onPress,
  cardStyle,
  titleStyle,
  textStyle,
  subtitleStyle,
  isDark,
  isUnread,
}: NotificationCardProps) {
  // Map notification types to icons
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'profile_incomplete':
        return 'document-text-outline';
      case 'profile_completed':
        return 'checkmark-circle-outline';
      case 'payment_method_setup':
        return 'card-outline';
      case 'bank_account_setup':
        return 'business-outline';
      case 'gig_completed':
        return 'checkmark-done-circle-outline';
      default:
        return 'notifications-outline';
    }
  };

  // Remove emoji from title
  const emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])/gu;
  const cleanTitle = notification.title.replace(emojiRegex, '').trim().replace(/\s+/g, ' ');

  const iconName = getNotificationIcon(notification.type);
  const iconColor = isUnread ? '#73af17' : (isDark ? '#9CA3AF' : '#6B7280');

  // Don't show green dot for profile_completed notifications
  const showUnreadDot = isUnread && notification.type !== 'profile_completed';

  return (
    <Pressable
      style={[
        styles.notificationCard,
        cardStyle,
        isUnread && styles.unreadCard,
      ]}
      onPress={() => onPress(notification)}
      android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.titleRow}>
            <Ionicons name={iconName as any} size={20} color={iconColor} style={styles.icon} />
            <Text style={[styles.notificationTitle, titleStyle]} numberOfLines={2}>
              {cleanTitle}
            </Text>
          </View>
          {showUnreadDot && (
            <View style={styles.unreadDot} />
          )}
        </View>
        <Text style={[styles.notificationBody, textStyle]} numberOfLines={3}>
          {notification.body}
        </Text>
        <Text style={[styles.notificationTime, subtitleStyle]}>
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </Text>
      </View>
    </Pressable>
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
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 28, // Margin to add space from tab header
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#111827',
    borderBottomColor: '#374151',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    minWidth: 80,
  },
  backText: {
    fontSize: 16,
    marginLeft: 4,
    color: '#000000',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    flex: 1,
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  markAllButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#73af17',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  dividerDark: {
    backgroundColor: '#374151',
  },
  notificationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  unreadCard: {
    backgroundColor: '#F0F9FF',
    borderWidth: 0,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  icon: {
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#111827',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#73af17',
    marginTop: 6,
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
});

