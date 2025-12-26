import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  required?: boolean;
}

export function Input({ label, error, required = false, style, ...props }: InputProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isDark && styles.labelDark]}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      <TextInput
        style={[
          styles.input,
          isDark && styles.inputDark,
          error && styles.inputError,
          style
        ]}
        placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  labelDark: {
    color: '#D1D5DB',
  },
  required: {
    color: '#DC2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
    color: '#111827',
    minHeight: 50,
  },
  inputDark: {
    backgroundColor: '#111827',
    borderColor: '#4B5563',
    color: '#FFFFFF',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
});
