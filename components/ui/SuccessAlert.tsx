import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface SuccessAlertProps {
  visible: boolean;
  message: string;
  onClose: () => void;
  title?: string;
}

export function SuccessAlert({ visible, message, title = 'Success', onClose }: SuccessAlertProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={styles.overlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <Pressable 
          style={[
            styles.container,
            isDark ? styles.containerDark : styles.containerLight
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.iconContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#73af17" />
          </View>
          <Text style={[styles.title, isDark ? styles.titleDark : styles.titleLight]}>
            {title}
          </Text>
          <Text style={[styles.message, isDark ? styles.messageDark : styles.messageLight]}>
            {message}
          </Text>
          <Pressable
            style={[styles.button, isDark ? styles.buttonDark : styles.buttonLight]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, isDark ? styles.buttonTextDark : styles.buttonTextLight]}>
              OK
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  messageLight: {
    color: '#6B7280',
  },
  messageDark: {
    color: '#D1D5DB',
  },
  button: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#73af17',
  },
  buttonLight: {
    backgroundColor: '#73af17',
  },
  buttonDark: {
    backgroundColor: '#73af17',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonTextLight: {
    color: '#FFFFFF',
  },
  buttonTextDark: {
    color: '#FFFFFF',
  },
});





