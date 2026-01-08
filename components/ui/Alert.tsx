import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
}

interface AlertState extends AlertOptions {
  visible: boolean;
}

let alertState: AlertState = {
  visible: false,
  title: '',
  message: '',
  buttons: [],
  cancelable: true,
};

let setAlertState: ((state: AlertState) => void) | null = null;

// Support both React Native Alert API and options object
export function showAlert(
  titleOrOptions: string | AlertOptions,
  message?: string,
  buttons?: AlertButton[],
  options?: { cancelable?: boolean }
): void {
  let alertOptions: AlertOptions;
  
  // If first argument is a string, it's React Native Alert API format
  if (typeof titleOrOptions === 'string') {
    alertOptions = {
      title: titleOrOptions,
      message: message,
      buttons: (buttons && buttons.length > 0) 
        ? buttons 
        : [{ text: 'OK', onPress: () => {}, style: 'default' as const }],
      cancelable: options?.cancelable !== false,
    };
  } else {
    // Otherwise it's an options object
    alertOptions = titleOrOptions;
    if (!alertOptions.buttons || alertOptions.buttons.length === 0) {
      alertOptions.buttons = [{ text: 'OK', onPress: () => {}, style: 'default' as const }];
    }
    if (alertOptions.cancelable === undefined) {
      alertOptions.cancelable = true;
    }
  }
  
  alertState = {
    ...alertOptions,
    visible: true,
  };
  
  if (setAlertState) {
    setAlertState(alertState);
  }
}

export function AlertComponent() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [state, setState] = useState<AlertState>(alertState);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    setAlertState = setState;
  }, []);

  useEffect(() => {
    if (state.visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 11,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [state.visible, fadeAnim, scaleAnim]);

  const handleClose = () => {
    if (state.cancelable) {
      setState({ ...state, visible: false });
      alertState.visible = false;
    }
  };

  const handleButtonPress = (button: AlertButton) => {
    setState({ ...state, visible: false });
    alertState.visible = false;
    if (button.onPress) {
      button.onPress();
    }
  };

  if (!state.visible) return null;

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case 'destructive':
        return [styles.button, styles.destructiveButton];
      case 'cancel':
        return [styles.button, styles.cancelButton, isDark && styles.cancelButtonDark];
      default:
        return [styles.button, styles.defaultButton, isDark && styles.defaultButtonDark];
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case 'destructive':
        return styles.destructiveButtonText;
      case 'cancel':
        return [styles.buttonText, isDark && styles.buttonTextDark];
      default:
        return [styles.buttonText, styles.primaryButtonText];
    }
  };

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <Animated.View
            style={[
              styles.container,
              isDark && styles.containerDark,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {state.title && (
              <Text style={[styles.title, isDark && styles.titleDark]}>
                {state.title}
              </Text>
            )}
            {state.message && (
              <Text style={[styles.message, isDark && styles.messageDark]}>
                {state.message}
              </Text>
            )}
            <View style={[
              styles.buttonContainer,
              (state.buttons?.length || 0) > 2 && styles.buttonContainerVertical,
              (state.buttons?.length || 0) === 2 && styles.buttonContainerTwo,
            ]}>
              {state.buttons?.map((button, index) => (
                <Pressable
                  key={index}
                  style={[
                    ...getButtonStyle(button.style),
                    index > 0 && (state.buttons?.length || 0) > 2 && styles.buttonVerticalSpacing,
                    index > 0 && (state.buttons?.length || 0) === 2 && styles.buttonSpacing,
                    (state.buttons?.length || 0) === 1 && styles.buttonSingle,
                    (state.buttons?.length || 0) > 2 && styles.buttonFullWidth,
                  ]}
                  onPress={() => handleButtonPress(button)}
                >
                  <Text style={getButtonTextStyle(button.style)}>
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Re-export React Native's Alert for compatibility
// Alert.alert supports: alert(title, message?, buttons?, options?)
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ) => {
    showAlert(title, message, buttons, options);
  },
  prompt: () => {
    console.warn('Alert.prompt is not yet implemented in custom Alert');
  },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageDark: {
    color: '#D1D5DB',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  buttonContainerTwo: {
    justifyContent: 'center',
  },
  buttonContainerVertical: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  buttonSingle: {
    flex: 1,
    minWidth: 'auto',
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  buttonSpacing: {
    marginLeft: 0,
  },
  buttonVerticalSpacing: {
    marginTop: 8,
    marginLeft: 0,
  },
  buttonFullWidth: {
    width: '100%',
    flex: 0,
  },
  defaultButton: {
    backgroundColor: '#73af17',
  },
  defaultButtonDark: {
    backgroundColor: '#73af17',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonDark: {
    borderColor: '#4B5563',
  },
  destructiveButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  buttonTextDark: {
    color: '#9CA3AF',
  },
  primaryButtonText: {
    color: '#FFFFFF',
  },
  destructiveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

