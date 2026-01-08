import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CommunityGuidelinesScreen() {
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
        <Text style={styles.headerTitle}>Community Guidelines</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.content, cardStyle]}>
          <Text style={[styles.lastUpdated, textStyle]}>Last Updated: {new Date().toLocaleDateString()}</Text>
          
          <Text style={[styles.introText, textStyle]}>
            Welcome to Ollie! Our community guidelines are designed to create a safe, respectful, and transparent environment for everyone. These guidelines apply to all users, whether you're a Teenlancer or a Neighbor. By using Ollie, you agree to follow these guidelines.
          </Text>

          <Text style={[styles.sectionTitle, titleStyle]}>1. Age Restrictions & Verification</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Ollie is committed to protecting young users and ensuring age-appropriate interactions:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Minimum Age:</Text> You must be at least 14 years old to use Ollie as a Teenlancer
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Parental Consent:</Text> Users under 18 years old require verified parental consent before accessing the platform
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Identity Verification:</Text> We verify user identities through phone number verification, email confirmation, and may require additional documentation for certain features
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Age Misrepresentation:</Text> Providing false age information or attempting to bypass age restrictions is strictly prohibited and will result in immediate account suspension
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Background Checks:</Text> Neighbors may be subject to background checks for certain types of gigs involving direct interaction with minors
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>2. Safety & Security</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Your safety is our top priority. We require all users to:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Meet in Public:</Text> For initial meetings, always meet in a public, well-lit location. Never meet at private residences for first-time gigs
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Inform Others:</Text> Teenlancers should inform a parent or guardian about gig details, location, and expected duration before accepting any gig
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>No Personal Information:</Text> Never share personal information such as home address, school name, or social media handles outside of what's necessary for the gig
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Report Concerns:</Text> Immediately report any suspicious behavior, inappropriate requests, or safety concerns through the app's reporting feature
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Emergency Contacts:</Text> Keep emergency contact information updated in your profile
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Trust Your Instincts:</Text> If something feels wrong or unsafe, trust your instincts and remove yourself from the situation. You can always cancel a gig if you feel uncomfortable
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>3. Transparency & Honesty</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Building trust requires transparency from all users:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Accurate Profiles:</Text> Provide accurate information in your profile, including your skills, experience, and availability. Misleading information undermines trust
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Clear Gig Descriptions:</Text> Neighbors must provide clear, detailed descriptions of gigs including tasks, duration, location, and compensation. Hidden requirements or misleading descriptions are prohibited
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Honest Reviews:</Text> Leave honest, constructive reviews based on actual experiences. False reviews, review manipulation, or retaliatory reviews are not allowed
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Payment Transparency:</Text> All payment terms must be clearly stated before a gig begins. No hidden fees or last-minute changes to agreed-upon compensation
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Communication:</Text> Respond to messages in a timely manner and communicate clearly about expectations, changes, or cancellations
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>4. Respectful Behavior</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We expect all users to treat each other with respect and dignity:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>No Harassment:</Text> Harassment, bullying, discrimination, or any form of abusive behavior is strictly prohibited. This includes but is not limited to: threats, intimidation, hate speech, or unwanted advances
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Professional Communication:</Text> Maintain professional and respectful communication in all messages, even during disagreements
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Inappropriate Content:</Text> Do not share, request, or post inappropriate, explicit, or offensive content including images, videos, or messages
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Respect Boundaries:</Text> Respect personal boundaries and physical space. Do not make inappropriate requests or pressure others into uncomfortable situations
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Cultural Sensitivity:</Text> Be respectful of different backgrounds, cultures, and perspectives
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>5. Verification & Account Security</Text>
          <Text style={[styles.bodyText, textStyle]}>
            To maintain platform integrity, we require:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Phone Verification:</Text> All users must verify their phone number to create an account
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Email Confirmation:</Text> Email addresses must be verified to ensure account security and enable important communications
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Profile Photo:</Text> A clear, recent profile photo is required. Photos must show your face clearly and cannot be of other people, objects, or inappropriate content
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Account Security:</Text> Keep your account secure by using a strong password and not sharing your login credentials with others
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>One Account Per Person:</Text> Each user is allowed only one account. Creating multiple accounts to circumvent restrictions or bans is prohibited
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>6. Prohibited Activities</Text>
          <Text style={[styles.bodyText, textStyle]}>
            The following activities are strictly prohibited and will result in immediate account suspension or termination:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Soliciting or engaging in illegal activities, including but not limited to: drug use, theft, vandalism, or any criminal behavior
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Attempting to circumvent payment through the platform or soliciting payment outside of Ollie's payment system
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Posting fake gigs, spam, or misleading content designed to manipulate or deceive users
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Using the platform to recruit for other services, businesses, or platforms without explicit permission
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Sharing contact information to communicate outside of the platform before a gig is accepted
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Impersonating others, including creating fake profiles or pretending to be someone you're not
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Engaging in any form of exploitation, including but not limited to: labor exploitation, financial exploitation, or taking advantage of minors
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>7. Reporting & Enforcement</Text>
          <Text style={[styles.bodyText, textStyle]}>
            We take violations of these guidelines seriously:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Report Violations:</Text> If you witness or experience a violation of these guidelines, report it immediately through the app's reporting feature or contact support
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Investigation Process:</Text> All reports are reviewed by our safety team. We investigate thoroughly and may request additional information
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Enforcement Actions:</Text> Violations may result in warnings, temporary suspensions, permanent bans, or legal action depending on severity
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Appeal Process:</Text> Users who believe their account was suspended in error can appeal through our support channels
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                <Text style={[styles.boldText, textStyle]}>Law Enforcement:</Text> We cooperate with law enforcement when required and may report illegal activities to appropriate authorities
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>8. Platform Integrity</Text>
          <Text style={[styles.bodyText, textStyle]}>
            Help us maintain a trustworthy platform:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Complete gigs as agreed upon and communicate promptly about any issues or delays
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Pay fairly and on time through the platform's payment system
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Provide accurate ratings and reviews based on genuine experiences
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Respect the platform's terms of service and community standards
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>9. Parental Involvement</Text>
          <Text style={[styles.bodyText, textStyle]}>
            For users under 18, parental involvement is essential:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Parents/guardians must provide consent and verify their identity before a minor can use the platform
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Parents receive notifications about their child's activity, including gig applications and messages
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Parents can review and approve gig applications before acceptance
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Parents have access to their child's account activity and can contact support with concerns
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, titleStyle]}>10. Contact & Support</Text>
          <Text style={[styles.bodyText, textStyle]}>
            If you have questions about these guidelines, need to report a violation, or require support:
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Use the in-app Help Center for general questions and support
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                Use the reporting feature to report violations or safety concerns
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={[styles.bulletMarker, textStyle]}>•</Text>
              <Text style={[styles.bulletText, textStyle]}>
                For urgent safety concerns, contact support immediately
              </Text>
            </View>
          </View>

          <Text style={[styles.footerText, textStyle]}>
            By using Ollie, you acknowledge that you have read, understood, and agree to follow these Community Guidelines. These guidelines work in conjunction with our Terms of Use and Privacy Policy to create a safe and positive experience for everyone.
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
  introText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
    color: '#374151',
    flexShrink: 1,
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
  boldText: {
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 14,
    lineHeight: 22,
    marginTop: 32,
    marginBottom: 16,
    color: '#374151',
    fontStyle: 'italic',
    flexShrink: 1,
  },
});

