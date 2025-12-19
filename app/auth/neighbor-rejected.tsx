import { View, Text, StyleSheet, ScrollView, Pressable, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

export default function NeighborRejectedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ applicationId?: string; reason?: string }>();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.replace('/splash');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

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

          <View style={styles.iconContainer}>
            <Ionicons name="close-circle" size={80} color="#DC2626" />
          </View>

          <Text style={[styles.title, titleStyle]}>Application Not Approved</Text>
          
          <Text style={[styles.subtitle, subtitleStyle]}>
            Unfortunately, your neighbor application was not approved at this time.
          </Text>

          {params.reason && params.reason !== 'No reason provided' && (
            <View style={[styles.card, cardStyle]}>
              <Text style={[styles.reasonLabel, textStyle]}>Reason:</Text>
              <Text style={[styles.reasonText, subtitleStyle]}>{params.reason}</Text>
            </View>
          )}

          <View style={[styles.card, cardStyle]}>
            <Text style={[styles.infoText, textStyle]}>
              If you believe this was a mistake or would like to reapply, please contact our support team.
            </Text>
          </View>

          <Pressable
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>

          <Pressable
            style={styles.supportLink}
            onPress={() => {
              // TODO: Add support contact logic
              console.log('Contact support');
            }}
          >
            <Text style={styles.supportLinkText}>Contact Support</Text>
          </Pressable>
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
    padding: 24,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 120,
    height: 120,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
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
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  card: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  textLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  signOutButton: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  supportLink: {
    marginTop: 16,
    paddingVertical: 12,
  },
  supportLinkText: {
    color: '#73af17',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

