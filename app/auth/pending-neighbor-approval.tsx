import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { getNeighborApplicationStatus } from '@/lib/api/neighborApplications';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function PendingNeighborApprovalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ applicationId?: string }>();
  const { 
    applicationId: storeApplicationId,
    setCurrentStep 
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [application, setApplication] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const applicationId = params.applicationId || storeApplicationId;

  useEffect(() => {
    if (applicationId) {
      checkStatus();
      // Poll for status updates every 10 seconds
      const interval = setInterval(() => {
        checkStatus();
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [applicationId]);

  const checkStatus = async () => {
    if (!applicationId) return;

    try {
      const app = await getNeighborApplicationStatus(applicationId);
      setApplication(app);
      setIsLoading(false);

      if (app) {
        if (app.status === 'approved') {
          // Redirect to complete profile
          setCurrentStep('complete-profile');
          router.replace({
            pathname: '/auth/complete-neighbor-profile',
            params: { applicationId }
          });
        } else if (app.status === 'rejected') {
          // Show rejection screen
          router.replace({
            pathname: '/auth/neighbor-rejected',
            params: { 
              applicationId,
              reason: app.rejection_reason || 'No reason provided'
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Error checking application status:', error);
      setIsLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
          <Text style={[styles.loadingText, subtitleStyle]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={[styles.card, cardStyle]}>
            <Ionicons name="time-outline" size={64} color="#73af17" style={styles.icon} />
            <Text style={[styles.title, titleStyle]}>Application Under Review</Text>
            <Text style={[styles.subtitle, subtitleStyle]}>
              Thank you for submitting your neighbor application. Our team is reviewing your information.
            </Text>

            {application && (
              <View style={styles.infoContainer}>
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <Text style={[styles.infoText, subtitleStyle]}>
                    Submitted: {format(new Date(application.created_at), 'MMM d, yyyy')}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <Text style={[styles.infoText, subtitleStyle]}>
                    Phone: {application.phone_verified ? 'Verified ✓' : 'Not verified'}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.statusContainer}>
              <ActivityIndicator size="small" color="#73af17" />
              <Text style={[styles.statusText, subtitleStyle]}>
                We'll notify you once a decision has been made
              </Text>
            </View>

            <Pressable
              style={styles.refreshButton}
              onPress={checkStatus}
            >
              <Ionicons name="refresh" size={20} color="#73af17" />
              <Text style={styles.refreshButtonText}>Check Status</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  cardDark: {
    backgroundColor: '#1F2937',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  infoContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 14,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  statusText: {
    fontSize: 14,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
  },
});
