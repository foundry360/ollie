import { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const inputStyle = isDark ? styles.inputDark : styles.inputLight;
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const sendButtonStyle = message.trim() && !disabled
    ? styles.sendButtonActive
    : [styles.sendButton, isDark && styles.sendButtonDark];

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={[styles.input, inputStyle]}
        value={message}
        onChangeText={setMessage}
        placeholder="Type a message..."
        placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
        multiline
        maxLength={500}
        editable={!disabled}
        onSubmitEditing={handleSend}
      />
      <Pressable
        style={sendButtonStyle}
        onPress={handleSend}
        disabled={!message.trim() || disabled}
      >
        <Ionicons
          name="send"
          size={20}
          color={message.trim() && !disabled ? '#FFFFFF' : (isDark ? '#6B7280' : '#9CA3AF')}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1F2937',
    borderTopColor: '#374151',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    fontSize: 15,
    borderWidth: 1,
  },
  inputLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
    color: '#111827',
  },
  inputDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
    color: '#FFFFFF',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDark: {
    backgroundColor: '#111827',
  },
  sendButtonActive: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

