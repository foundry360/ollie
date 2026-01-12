import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacyPolicyScreen() {
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
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, cardStyle]}>
          <Text style={[styles.lastUpdated, textStyle]}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={[styles.sectionTitle, titleStyle]}>1. Information We Collect</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We collect information that you provide directly to us, including:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Account information (name, email, phone number, date of birth)</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Profile information (bio, profile photo, address, skills)</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Payment information (processed securely through third-party payment processors)</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Location data (to match you with nearby gigs)</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Communications (messages sent through the platform)</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>2. How We Use Your Information</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We use the information we collect to:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Provide, maintain, and improve our services</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Process transactions and send related information</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Send you technical notices and support messages</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Respond to your comments and questions</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Monitor and analyze trends and usage</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Personalize your experience</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>3. Information Sharing</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We do not sell your personal information. We may share your information in the following circumstances:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>With other users as necessary to facilitate gigs (e.g., showing your profile to potential matches)</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>With service providers who perform services on our behalf</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>When required by law or to protect our rights</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>In connection with a business transfer</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>4. Data Security</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We implement appropriate technical and organizational measures to protect your personal information. 
            However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>5. Children's Privacy</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Ollie is designed for users 14 years and older. For users under 18, we require parental consent. 
            We do not knowingly collect personal information from children under 14 without parental consent.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>6. Your Rights</Text>
          <Text style={[styles.bodyText, textStyle]}>
            You have the right to:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Access and update your personal information</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Delete your account and associated data</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Opt out of certain communications</Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>Request a copy of your data</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>7. Location Data</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We collect location data to match you with nearby gigs. You can control location sharing through your 
            device settings. Location data is only shared with other users when necessary for gig matching.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>8. Third-Party Services</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Our service may contain links to third-party websites or services. We are not responsible for the privacy 
            practices of these third parties. We encourage you to read their privacy policies.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>9. Changes to This Policy</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the 
            new Privacy Policy on this page and updating the "Last Updated" date.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>10. Contact Us</Text>
          <Text style={[styles.bodyText, textStyle]}>
            If you have questions about this Privacy Policy, please contact us through the app's Help Center or 
            support channels.
          </Text>
        </View>

        <View style={[styles.footerLinks, cardStyle]}>
          <Pressable
            style={styles.footerLinkItem}
            onPress={() => router.push('/(tabs)/home')}
          >
            <Text style={[styles.footerLinkText, textStyle]}>Home</Text>
          </Pressable>
          <Text style={[styles.footerLinkSeparator, textStyle]}>•</Text>
          <Pressable
            style={styles.footerLinkItem}
            onPress={() => router.push('/legal/community-guidelines')}
          >
            <Text style={[styles.footerLinkText, textStyle]}>Community Guidelines</Text>
          </Pressable>
          <Text style={[styles.footerLinkSeparator, textStyle]}>•</Text>
          <Pressable
            style={styles.footerLinkItem}
            onPress={() => router.push('/legal/terms')}
          >
            <Text style={[styles.footerLinkText, textStyle]}>Terms of Use</Text>
          </Pressable>
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
  bulletList: {
    marginTop: 8,
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexShrink: 1,
  },
  bulletMarker: {
    fontSize: 14,
    lineHeight: 22,
    marginRight: 8,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    flexShrink: 1,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 12,
  },
  footerLinkItem: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  footerLinkText: {
    fontSize: 14,
    color: '#73af17',
    textDecorationLine: 'underline',
  },
  footerLinkSeparator: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});

