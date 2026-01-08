import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import * as Sentry from 'sentry-expo';
import { trackApiError, trackEvent, addBreadcrumb } from '@/lib/sentry';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SentryTestScreen() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Test 1: Simple Error
  const testSimpleError = () => {
    try {
      throw new Error('Test Error: Simple error from Sentry test screen');
    } catch (error) {
      Sentry.Native.captureException(error as Error);
      addResult('✅ Simple error sent to Sentry');
      Alert.alert('Test Sent', 'Simple error has been sent to Sentry. Check your dashboard!');
    }
  };

  // Test 2: Error with Context
  const testErrorWithContext = () => {
    try {
      throw new Error('Test Error: Error with additional context');
    } catch (error) {
      Sentry.Native.captureException(error as Error, {
        tags: {
          test_type: 'context_error',
          screen: 'sentry_test',
        },
        extra: {
          userId: 'test-user-123',
          action: 'testing_sentry',
          timestamp: new Date().toISOString(),
        },
      });
      addResult('✅ Error with context sent to Sentry');
      Alert.alert('Test Sent', 'Error with context has been sent to Sentry!');
    }
  };

  // Test 3: API Error Tracking
  const testApiError = () => {
    const testError = new Error('Test API Error: Simulated API failure');
    trackApiError('test-endpoint', testError, {
      method: 'POST',
      url: '/api/test',
      statusCode: 500,
    });
    addResult('✅ API error tracked');
    Alert.alert('Test Sent', 'API error has been tracked in Sentry!');
  };

  // Test 4: Custom Event
  const testCustomEvent = () => {
    trackEvent('test_event', {
      eventType: 'user_action',
      action: 'button_click',
      screen: 'sentry_test',
    });
    addResult('✅ Custom event tracked');
    Alert.alert('Test Sent', 'Custom event has been tracked!');
  };

  // Test 5: Breadcrumb
  const testBreadcrumb = () => {
    addBreadcrumb('User clicked test button', 'user_action', {
      buttonName: 'test_breadcrumb',
      screen: 'sentry_test',
    });
    addResult('✅ Breadcrumb added');
    Alert.alert('Breadcrumb Added', 'Breadcrumb has been added. Trigger an error to see it in context!');
  };

  // Test 6: Unhandled Promise Rejection
  const testUnhandledPromise = () => {
    Promise.reject(new Error('Test Error: Unhandled promise rejection'));
    addResult('✅ Unhandled promise rejection triggered');
    Alert.alert('Test Sent', 'Unhandled promise rejection sent to Sentry!');
  };

  // Test 7: React Component Error (will be caught by ErrorBoundary)
  const TestErrorComponent = () => {
    throw new Error('Test Error: React component error');
  };

  const testComponentError = () => {
    addResult('⚠️ Component error will trigger ErrorBoundary');
    Alert.alert(
      'Component Error Test',
      'This will trigger the ErrorBoundary. The error will be caught and sent to Sentry.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Trigger Error',
          onPress: () => {
            // This will cause a render error
            setTimeout(() => {
              throw new Error('Test Error: Component render error');
            }, 100);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
        </Pressable>
        <Text style={[styles.title, isDark && styles.titleDark]}>Sentry Test Screen</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, isDark && styles.sectionDark]}>
          <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
            Error Tracking Tests
          </Text>
          <Text style={[styles.description, isDark && styles.descriptionDark]}>
            Click the buttons below to test different Sentry error tracking features.
            Check your Sentry dashboard to see the errors appear.
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="Test Simple Error"
            onPress={testSimpleError}
            variant="primary"
            fullWidth
          />
          <Button
            title="Test Error with Context"
            onPress={testErrorWithContext}
            variant="primary"
            fullWidth
          />
          <Button
            title="Test API Error"
            onPress={testApiError}
            variant="primary"
            fullWidth
          />
          <Button
            title="Test Custom Event"
            onPress={testCustomEvent}
            variant="secondary"
            fullWidth
          />
          <Button
            title="Test Breadcrumb"
            onPress={testBreadcrumb}
            variant="secondary"
            fullWidth
          />
          <Button
            title="Test Promise Rejection"
            onPress={testUnhandledPromise}
            variant="primary"
            fullWidth
          />
        </View>

        {testResults.length > 0 && (
          <View style={[styles.resultsSection, isDark && styles.resultsSectionDark]}>
            <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
              Test Results
            </Text>
            {testResults.map((result, index) => (
              <Text key={index} style={[styles.resultText, isDark && styles.resultTextDark]}>
                {result}
              </Text>
            ))}
          </View>
        )}

        <View style={[styles.infoSection, isDark && styles.infoSectionDark]}>
          <Ionicons name="information-circle" size={24} color="#73af17" />
          <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
            Go to your Sentry dashboard to see the errors:{'\n'}
            https://sentry.io/organizations/foundry360-llc/projects/ollie/
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerDark: {
    backgroundColor: '#1F2937',
    borderBottomColor: '#374151',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginLeft: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  descriptionDark: {
    color: '#9CA3AF',
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  resultsSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  resultsSectionDark: {
    backgroundColor: '#1F2937',
  },
  resultText: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  resultTextDark: {
    color: '#9CA3AF',
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoSectionDark: {
    backgroundColor: '#1F3A1F',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#166534',
    marginLeft: 12,
    lineHeight: 20,
  },
  infoTextDark: {
    color: '#86EFAC',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
});

