import { Modal, View, Text, StyleSheet, Pressable, Animated, Dimensions, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface ChatBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function ChatBottomSheet({ visible, onClose, title, avatar, children }: ChatBottomSheetProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.contentPressable}>
          <Animated.View
            style={[
              styles.container,
              isDark && styles.containerDark,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.greenHeaderBackground} />
            <View style={[styles.header, isDark && styles.headerDark, styles.headerWithGreen]}>
              <View style={[styles.handle, styles.handleOnGreen]} />
              <View style={styles.headerContent}>
                <View style={styles.titleContainer}>
                  {avatar && (
                    <Image 
                      source={{ uri: avatar }} 
                      style={styles.headerAvatar}
                    />
                  )}
                  <Text style={[styles.title, isDark && styles.titleDark, styles.titleOnGreen]}>{title}</Text>
                </View>
                <Pressable onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingView}
              keyboardVerticalOffset={0}
            >
              {children}
            </KeyboardAvoidingView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  contentPressable: {
    flex: 1,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.75,
    paddingBottom: 0,
    flexDirection: 'column',
    height: SCREEN_HEIGHT * 0.75,
  },
  containerDark: {
    backgroundColor: '#111111',
  },
  greenHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: '#73af17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 0,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  handleOnGreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
    position: 'relative',
    zIndex: 1,
  },
  headerWithGreen: {
    borderBottomWidth: 0,
  },
  headerDark: {
    borderBottomColor: '#1F1F1F',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleOnGreen: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
    minHeight: 0,
  },
});






