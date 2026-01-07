import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TermsOfUseScreen() {
  const { colorScheme } = useThemeStore();
  const router = useRouter();
  const isDark = colorScheme === 'dark';

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Use</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, cardStyle]}>
          <Text style={[styles.lastUpdated, textStyle]}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={[styles.sectionTitle, titleStyle]}>1. Acceptance of Terms</Text>
          <Text style={[styles.bodyText, textStyle]}>
            By accessing and using Ollie, you accept and agree to be bound by the terms and provision of this agreement.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>2. Description of Service</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Ollie is a platform that connects teenagers (Teenlancers) with neighbors (Posters) for local gig opportunities. 
            The platform facilitates communication, payment processing, and gig management.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>3. User Accounts</Text>
          <Text style={[styles.bodyText, textStyle]}>
            You must be at least 14 years old to use Ollie as a Teenlancer. Users under 18 require parental consent. 
            You are responsible for maintaining the confidentiality of your account and password.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>4. User Conduct</Text>
          <Text style={[styles.bodyText, textStyle]}>
            You agree to use Ollie in a lawful manner and in accordance with these Terms. You agree not to:
            {'\n'}• Post false, misleading, or fraudulent information
            {'\n'}• Harass, abuse, or harm other users
            {'\n'}• Violate any applicable laws or regulations
            {'\n'}• Interfere with the platform's operation
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>5. Payments and Fees</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Ollie charges a platform fee on completed gigs. Payment processing is handled through secure third-party 
            payment processors. All payments are subject to verification and may be subject to holds or delays.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>6. Limitation of Liability</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Ollie acts as a platform connecting users and is not responsible for the actions, content, or services 
            provided by users. We are not liable for any disputes between users.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>7. Privacy</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Your use of Ollie is also governed by our Privacy Policy. Please review our Privacy Policy to understand 
            how we collect, use, and protect your information.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>8. Modifications to Terms</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We reserve the right to modify these Terms at any time. Continued use of the platform after changes 
            constitutes acceptance of the modified Terms.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>9. Contact Information</Text>
          <Text style={[styles.bodyText, textStyle]}>
            If you have questions about these Terms, please contact us through the app's Help Center or support channels.
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#73af17',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  content: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    flexShrink: 1,
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  lastUpdated: {
    fontSize: 12,
    marginBottom: 24,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    color: '#000000',
    flexShrink: 1,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
    color: '#374151',
    flexShrink: 1,
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
});

