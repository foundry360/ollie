import { Pressable, Text, StyleSheet, View } from 'react-native';
import { clsx } from 'clsx';
import { useThemeStore } from '@/stores/themeStore';
import { ThreeDotsLoader } from './Loading';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  align?: 'left' | 'center' | 'right';
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, className, fullWidth = false, align = 'center' }: ButtonProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const buttonStyle = [
    styles.button,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'danger' && styles.danger,
    fullWidth && styles.fullWidth,
  ];

  const textStyle = [
    styles.text,
    variant === 'primary' && styles.textPrimary,
    variant === 'secondary' && styles.textSecondary,
    variant === 'danger' && styles.textDanger,
  ];

  const getButtonStyle = (pressed: boolean) => {
    const styleArray: any[] = [];
    
    // Start with base button style
    styleArray.push(styles.button);
    
    // Apply alignment
    if (align === 'left') {
      styleArray.push(styles.alignLeft);
    } else if (align === 'right') {
      styleArray.push(styles.alignRight);
    }
    
    // Apply variant background color
    if (variant === 'primary') {
      styleArray.push(styles.primary);
    } else if (variant === 'secondary') {
      styleArray.push(styles.secondary);
    } else if (variant === 'danger') {
      styleArray.push(styles.danger);
    }
    
    // Apply fullWidth - must come after base styles
    if (fullWidth) {
      styleArray.push(styles.fullWidth);
    }
    
    if (disabled || loading) {
      styleArray.push(styles.disabled);
    }
    
    if (pressed) {
      styleArray.push(styles.pressed);
    }
    
    return styleArray;
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
    >
      {({ pressed }) => (
        <View style={getButtonStyle(pressed)}>
          {loading ? (
            <ThreeDotsLoader 
              color={
                variant === 'secondary' 
                  ? (isDark ? '#FFFFFF' : '#111827')
                  : '#fff'
              } 
              size="small"
            />
          ) : (
            <Text style={[
              styles.text,
              variant === 'primary' && styles.textPrimary,
              variant === 'secondary' && (isDark ? styles.textSecondaryDark : styles.textSecondary),
              variant === 'danger' && styles.textDanger,
            ].filter(Boolean)}>
              {title}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
    minHeight: 48,
  },
  alignLeft: {
    alignItems: 'flex-start',
    paddingLeft: 0,
  },
  alignRight: {
    alignItems: 'flex-end',
    paddingRight: 0,
  },
  primary: {
    backgroundColor: '#73af17',
  },
  secondary: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: '#dc2626',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontWeight: '600',
    fontSize: 16,
  },
  textPrimary: {
    color: '#ffffff',
  },
  textSecondary: {
    color: '#111827',
  },
  textSecondaryDark: {
    color: '#FFFFFF',
  },
  textDanger: {
    color: '#ffffff',
  },
});

