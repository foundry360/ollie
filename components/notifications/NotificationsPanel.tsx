import { Modal, View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/hooks/useNotifications';
import type { Notification } from '@/lib/api/notifications';

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ visible, onClose }: NotificationsPanelProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const { data: notifications = [], isLoading, error } = useNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  // Debug logging
  useEffect(() => {
    if (visible) {
      console.log('NotificationsPanel - notifications:', notifications);
      console.log('NotificationsPanel - isLoading:', isLoading);
      console.log('NotificationsPanel - error:', error);
      console.log('NotificationsPanel - count:', notifications.length);
    }
  }, [visible, notifications, isLoading, error]);
  
  const slideAnim = useRef(new Animated.Value(400)).current; // Start off-screen to the right

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleNotificationPress = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead.mutateAsync(notification.id);
    }
    // TODO: Handle navigation based on notification type
    onClose();
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead.mutateAsync();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View
          style={[
            styles.panel,
            containerStyle,
            {
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.header, isDark && styles.headerDark]}>
              <View style={styles.headerContent}>
                <Text style={[styles.headerTitle, titleStyle]}>Notifications</Text>
                {unreadCount > 0 && (
                  <Pressable onPress={handleMarkAllRead} style={styles.markAllButton}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </Pressable>
                )}
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              </Pressable>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Debug: Show data info */}
              {__DEV__ && (
                <View style={{ padding: 8, backgroundColor: '#FEF3C7', marginBottom: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, color: '#92400E' }}>
                    Debug: {notifications.length} notifications, isLoading: {isLoading.toString()}, error: {error ? 'yes' : 'no'}
                  </Text>
                </View>
              )}
              {error ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
                  <Text style={[styles.emptyText, textStyle]}>Error loading notifications</Text>
                  <Text style={[styles.emptySubtext, subtitleStyle]}>
                    {error instanceof Error ? error.message : 'Unknown error'}
                  </Text>
                </View>
              ) : isLoading ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, textStyle]}>Loading notifications...</Text>
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
                  {/* Test card to verify rendering */}
                  {__DEV__ && notifications.length > 0 && (
                    <View style={{ padding: 16, backgroundColor: '#D1FAE5', marginBottom: 12, borderRadius: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#065F46' }}>
                        TEST: Should see {notifications.length} notification(s) below
                      </Text>
                    </View>
                  )}
                  {notifications.map((notification) => {
                    return (
                      <View key={notification.id} style={{ width: '100%' }}>
                        <Pressable
                          style={[
                            styles.notificationCard,
                            cardStyle,
                            !notification.read && styles.unreadCard,
                          ]}
                          onPress={() => handleNotificationPress(notification)}
                          android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
                        >
                          <View style={styles.notificationContent}>
                            <View style={styles.notificationHeader}>
                              <Text style={[styles.notificationTitle, titleStyle]} numberOfLines={2}>
                                {notification.title || 'No title'}
                              </Text>
                              {!notification.read && (
                                <View style={styles.unreadDot} />
                              )}
                            </View>
                            <Text style={[styles.notificationBody, textStyle]} numberOfLines={3}>
                              {notification.body || 'No body'}
                            </Text>
                            <Text style={[styles.notificationTime, subtitleStyle]}>
                              {notification.created_at 
                                ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                                : 'Just now'}
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  panel: {
    width: '85%',
    maxWidth: 400,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
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
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerDark: {
    backgroundColor: '#111827',
    borderBottomColor: '#374151',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
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
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
    width: '100%',
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
  },
  notificationCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    minHeight: 100,
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  unreadCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#73af17',
    borderWidth: 2,
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
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
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

