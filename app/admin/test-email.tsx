import { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { testNeighborApprovalEmail } from '@/lib/api/testEmail';

export default function TestEmailScreen() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendTestEmail = async () => {
    if (!email || !fullName) {
      Alert.alert('Error', 'Please enter both email and full name');
      return;
    }

    setIsSending(true);
    try {
      const result = await testNeighborApprovalEmail(email, fullName);
      
      if (result.success) {
        Alert.alert(
          'Success',
          `Test email sent to ${email}!\n\nCheck the Edge Function logs in Supabase Dashboard for details.`,
          [{ text: 'OK' }]
        );
        setEmail('');
        setFullName('');
      } else {
        Alert.alert(
          'Error',
          `Failed to send email: ${result.error || 'Unknown error'}\n\nCheck console for details.`
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send test email');
    } finally {
      setIsSending(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, titleStyle]}>Test Neighbor Approval Email</Text>
        <Text style={[styles.subtitle, textStyle]}>
          Send a test approval email without going through the full approval process.
        </Text>

        <View style={[styles.card, cardStyle]}>
          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="user@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <Input
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="John Doe"
            autoCapitalize="words"
          />

          <Button
            title={isSending ? 'Sending...' : 'Send Test Email'}
            onPress={handleSendTestEmail}
            disabled={isSending || !email || !fullName}
            loading={isSending}
            fullWidth
          />
        </View>

        <View style={[styles.infoCard, cardStyle]}>
          <Text style={[styles.infoTitle, titleStyle]}>How to Check Results</Text>
          <Text style={[styles.infoText, textStyle]}>
            1. Check your email inbox for the test email{'\n'}
            2. Check Supabase Dashboard → Edge Functions → send-neighbor-approval-email → Logs{'\n'}
            3. Check browser/React Native console for detailed logs
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#f9fafb',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  textLight: {
    color: '#374151',
  },
  textDark: {
    color: '#d1d5db',
  },
  card: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  cardLight: {
    backgroundColor: '#ffffff',
  },
  cardDark: {
    backgroundColor: '#1f2937',
  },
  labelLight: {
    color: '#374151',
  },
  labelDark: {
    color: '#d1d5db',
  },
  infoCard: {
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

