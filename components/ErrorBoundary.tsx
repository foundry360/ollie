import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Sentry from 'sentry-expo';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to Sentry
    Sentry.Native.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        error_boundary: true,
      },
    });

    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.content, isDark && styles.contentDark]}>
        <Ionicons name="alert-circle" size={64} color="#DC2626" />
        <Text style={[styles.title, isDark && styles.titleDark]}>
          Something went wrong
        </Text>
        <Text style={[styles.message, isDark && styles.messageDark]}>
          We're sorry, but something unexpected happened. The error has been reported and we'll look into it.
        </Text>
        {__DEV__ && error && (
          <View style={[styles.errorDetails, isDark && styles.errorDetailsDark]}>
            <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
              {error.message}
            </Text>
          </View>
        )}
        <Button
          title="Try Again"
          onPress={onReset}
          variant="primary"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  contentDark: {
    backgroundColor: '#1F2937',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#6B7280',
  },
  messageDark: {
    color: '#9CA3AF',
  },
  errorDetails: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  errorDetailsDark: {
    backgroundColor: '#7F1D1D',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#991B1B',
  },
  errorTextDark: {
    color: '#FCA5A5',
  },
});

