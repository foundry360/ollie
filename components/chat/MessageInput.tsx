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
    const trimmedMessage = message.trim();
    console.log('[MessageInput] handleSend called:', {
      hasMessage: !!trimmedMessage,
      messageLength: trimmedMessage.length,
      disabled,
      messagePreview: trimmedMessage.substring(0, 50),
    });
    
    if (!trimmedMessage) {
      console.log('[MessageInput] ❌ Not sending - message is empty');
      return;
    }
    
    if (disabled) {
      console.log('[MessageInput] ❌ Not sending - input is disabled');
      return;
    }
    
    console.log('[MessageInput] ✅ Calling onSend with message');
    try {
      onSend(trimmedMessage);
      setMessage('');
      console.log('[MessageInput] ✅ Message sent, input cleared');
    } catch (error) {
      console.error('[MessageInput] ❌ Error in onSend:', error);
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
    borderTopWidth: 0,
    gap: 12,
  },
  containerLight: {
    backgroundColor: 'transparent',
  },
  containerDark: {
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
    borderColor: '#D1D5DB',
    color: '#111827',
  },
  inputDark: {
    backgroundColor: 'transparent',
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

