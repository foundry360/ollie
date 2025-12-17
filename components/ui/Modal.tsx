import { Modal as RNModal, View, Text, StyleSheet, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

interface CustomModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
  email?: string; // Optional email to bold in message
}

export function CustomModal({
  visible,
  title,
  message,
  buttonText = 'Got it',
  onClose,
  email,
}: CustomModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  // Debug: Log when modal receives props
  console.log('🎯 Modal render - visible:', visible, 'email:', email, 'title:', title);

  // If email is provided, split message and bold the email
  const renderMessage = () => {
    if (email) {
      // Message should end with the email, so we append it
      return (
        <Text style={[styles.message, isDark && styles.messageDark]}>
          {message}
          <Text style={styles.emailBold}>{email}</Text>
        </Text>
      );
    }
    return <Text style={[styles.message, isDark && styles.messageDark]}>{message}</Text>;
  };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isDark && styles.modalContainerDark]}>
          <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
          <View style={styles.messageContainer}>
            {renderMessage()}
          </View>
          <Pressable
            style={[styles.button, isDark && styles.buttonDark]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, isDark && styles.buttonTextDark]}>
              {buttonText}
            </Text>
          </Pressable>
        </View>
      </View>
    </RNModal>
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
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalContainerDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  messageContainer: {
    marginBottom: 24,
    width: '100%',
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: '#374151',
  },
  messageDark: {
    color: '#D1D5DB',
  },
  emailBold: {
    fontWeight: 'bold',
    color: '#73af17',
  },
  button: {
    backgroundColor: '#73af17',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 120,
  },
  buttonDark: {
    backgroundColor: '#73af17',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextDark: {
    color: '#FFFFFF',
  },
});

