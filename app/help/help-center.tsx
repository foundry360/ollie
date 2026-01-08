import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/authStore';

interface FAQItem {
  question: string;
  answer: string;
}

interface HelpSection {
  title: string;
  icon: string;
  items: FAQItem[];
}

export default function HelpCenterScreen() {
  const { colorScheme } = useThemeStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const isDark = colorScheme === 'dark';
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedFAQs, setExpandedFAQs] = useState<Set<string>>(new Set());

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const sectionCardStyle = isDark ? styles.sectionCardDark : styles.sectionCardLight;

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const toggleFAQ = (faqKey: string) => {
    const newExpanded = new Set(expandedFAQs);
    if (newExpanded.has(faqKey)) {
      newExpanded.delete(faqKey);
    } else {
      newExpanded.add(faqKey);
    }
    setExpandedFAQs(newExpanded);
  };

  const helpSections: HelpSection[] = [
    {
      title: 'Getting Started',
      icon: 'rocket',
      items: [
        {
          question: 'How do I create an account?',
          answer: 'To create an account, download the Ollie app and follow the signup process. You\'ll need to provide your email, phone number, and date of birth. If you\'re under 18, you\'ll need parental consent to complete registration.'
        },
        {
          question: 'What information do I need to provide?',
          answer: 'You\'ll need to provide: your full name, email address, phone number (for verification), date of birth, and a profile photo. Teenlancers can also add skills and a bio to their profile.'
        },
        {
          question: 'How does age verification work?',
          answer: 'Ollie requires users to be at least 14 years old. Users under 18 must have verified parental consent. We verify ages through date of birth confirmation and may require additional documentation for certain features.'
        },
        {
          question: 'What\'s the difference between a Teenlancer and a Neighbor?',
          answer: 'Teenlancers are users aged 14-19 who can apply for and complete gigs to earn money. Neighbors are adults (20+) who post gigs and hire Teenlancers for tasks like yard work, pet care, tutoring, and more.'
        }
      ]
    },
    {
      title: 'For Teenlancers',
      icon: 'person',
      items: [
        {
          question: 'How do I find gigs?',
          answer: 'Browse available gigs on the Marketplace tab. You can filter by pay, skills required, distance, and search by keywords. Saved gigs appear in your Saved section.'
        },
        {
          question: 'How do I apply for a gig?',
          answer: 'Tap on a gig to view details, then tap "Apply for Gig". If you\'re under 18, your parent will need to approve the application before it\'s sent to the Neighbor.'
        },
        {
          question: 'How do I get paid?',
          answer: 'After completing a gig, payment is processed through the platform. You\'ll need to set up a bank account in Payment Setup to receive earnings. Payments are typically processed within 2-3 business days after gig completion.'
        },
        {
          question: 'What if I need to cancel a gig?',
          answer: 'If you need to cancel, go to the Tasks tab, find the gig, and tap "Cancel". Please cancel as early as possible and communicate with the Neighbor. Frequent cancellations may affect your account standing.'
        },
        {
          question: 'How do I mark a gig as complete?',
          answer: 'When you\'re finished with the work, go to the Tasks tab, find the gig, and tap "Mark Complete". The Neighbor will then confirm completion and payment will be processed.'
        },
        {
          question: 'Can I message Neighbors?',
          answer: 'Yes! Once you\'ve applied for or been assigned a gig, you can message the Neighbor through the Messages tab. This helps coordinate details, ask questions, and confirm arrangements.'
        }
      ]
    },
    {
      title: 'For Neighbors',
      icon: 'business',
      items: [
        {
          question: 'How do I post a gig?',
          answer: 'Go to the Tasks tab and tap the "+" button. Fill in the gig details: title, description, pay amount, location, required skills, estimated hours, and add photos if helpful. Tap "Post Gig" when ready.'
        },
        {
          question: 'How do I choose a Teenlancer?',
          answer: 'When Teenlancers apply, you\'ll see their profile, skills, and reviews. Review applications in the Tasks tab, then select "Choose Teenlancer" to assign the gig. You can also browse and select from the Select Teenlancer tab.'
        },
        {
          question: 'How do I pay for completed gigs?',
          answer: 'Add a payment method in Settings → Payment Methods. When a gig is marked complete, payment is automatically processed. You\'ll receive a confirmation and receipt.'
        },
        {
          question: 'What if a Teenlancer doesn\'t show up?',
          answer: 'If a Teenlancer doesn\'t show up or complete the work, you can cancel the gig. Contact support if you need assistance resolving the situation.'
        },
        {
          question: 'Can I edit or cancel a posted gig?',
          answer: 'You can edit gig details before it\'s been accepted. Once assigned, you\'ll need to communicate changes with the Teenlancer. You can cancel open gigs at any time.'
        },
        {
          question: 'How do I leave a review?',
          answer: 'After a gig is completed, you\'ll be prompted to leave a review. Reviews help build trust in the community and help other users make informed decisions.'
        }
      ]
    },
    {
      title: 'Payments & Earnings',
      icon: 'cash',
      items: [
        {
          question: 'How do I set up my bank account?',
          answer: 'Go to Settings → Payment Setup (for Teenlancers) or Settings → Payment Methods (for Neighbors). Follow the secure setup process to link your bank account. This is required to receive or send payments.'
        },
        {
          question: 'When will I receive payment?',
          answer: 'Payments are processed within 2-3 business days after a gig is marked complete and confirmed. You\'ll receive a notification when payment is sent.'
        },
        {
          question: 'Are there any fees?',
          answer: 'Ollie charges a small platform fee on completed gigs. The fee is deducted from the payment amount. You\'ll see the exact amount before confirming.'
        },
        {
          question: 'How do I view my earnings?',
          answer: 'Teenlancers can view all earnings in the Earnings tab. You\'ll see completed gigs, pending payments, and total earnings.'
        },
        {
          question: 'What payment methods are accepted?',
          answer: 'Payments are processed through secure bank transfers. Neighbors add payment methods (bank accounts or cards) and Teenlancers receive payments directly to their bank accounts.'
        }
      ]
    },
    {
      title: 'Safety & Security',
      icon: 'shield-checkmark',
      items: [
        {
          question: 'How does Ollie keep me safe?',
          answer: 'We verify all users, require parental consent for minors, and provide in-app messaging (no sharing personal contact info). We also have reporting features and community guidelines to maintain a safe environment.'
        },
        {
          question: 'What should I do if I feel unsafe?',
          answer: 'If you ever feel unsafe, remove yourself from the situation immediately. Report the incident through the app\'s reporting feature or contact support. In emergencies, call 911.'
        },
        {
          question: 'Should I meet in public?',
          answer: 'Yes! For first-time meetings, always meet in a public, well-lit location. Teenlancers should inform a parent or guardian about gig details and location before accepting.'
        },
        {
          question: 'What information should I share?',
          answer: 'Only share information necessary for the gig. Never share your home address, school name, or personal social media accounts. All communication should stay within the Ollie app.'
        },
        {
          question: 'How do I report a problem?',
          answer: 'Use the reporting feature in the app or contact support through the Help Center. We take all reports seriously and investigate promptly.'
        }
      ]
    },
    {
      title: 'Account & Profile',
      icon: 'settings',
      items: [
        {
          question: 'How do I update my profile?',
          answer: 'Go to the Profile tab and tap the edit icon next to any section. You can update your name, bio, skills, profile photo, and location information.'
        },
        {
          question: 'How do I change my password?',
          answer: 'Go to Settings → Change Password. Enter your new password twice and confirm. Make sure your password is at least 8 characters long.'
        },
        {
          question: 'How do I verify my account?',
          answer: 'Account verification happens automatically when you sign up. You\'ll verify your phone number and email. Additional verification may be required for certain features.'
        },
        {
          question: 'Can I delete my account?',
          answer: 'Yes, you can delete your account in Settings → Danger Zone → Delete Account. This action is permanent and cannot be undone. All your data will be deleted.'
        },
        {
          question: 'What if I forgot my password?',
          answer: 'On the login screen, tap "Forgot Password" and enter your email. You\'ll receive instructions to reset your password.'
        }
      ]
    },
    {
      title: 'Parental Controls',
      icon: 'people',
      items: [
        {
          question: 'How do parents approve gigs?',
          answer: 'When your teen applies for a gig, you\'ll receive a notification. Review the gig details in the Parent Dashboard and approve or decline the application.'
        },
        {
          question: 'What can parents see?',
          answer: 'Parents can see their teen\'s gig applications, messages, earnings, and account activity. You\'ll receive notifications about important account activity.'
        },
        {
          question: 'How do I set up a parent account?',
          answer: 'When your teen signs up, you\'ll receive an email to verify and set up your parent account. Follow the instructions to complete the setup process.'
        },
        {
          question: 'Can parents block certain gigs?',
          answer: 'Yes, parents can decline gig applications. You can also contact support if you have concerns about specific types of gigs or users.'
        }
      ]
    },
    {
      title: 'Troubleshooting',
      icon: 'construct',
      items: [
        {
          question: 'I\'m not receiving notifications',
          answer: 'Check your device notification settings and ensure Ollie has permission to send notifications. Also check Settings → Activity → Notifications in the app.'
        },
        {
          question: 'Messages aren\'t loading',
          answer: 'Try closing and reopening the app, or pull down to refresh. Ensure you have an internet connection. If problems persist, contact support.'
        },
        {
          question: 'I can\'t upload photos',
          answer: 'Make sure you\'ve granted camera and photo library permissions. Photos should be under 10MB. Try a different photo or restart the app.'
        },
        {
          question: 'Payment setup is failing',
          answer: 'Ensure all information is entered correctly. Check that your bank account details are valid. If issues persist, contact support with your account information.'
        },
        {
          question: 'The app is crashing',
          answer: 'Try closing and reopening the app. Make sure you have the latest version installed. If crashes continue, contact support with details about when it happens.'
        }
      ]
    }
  ];

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={[styles.introCard, cardStyle]}>
          <Text style={[styles.introTitle, titleStyle]}>Welcome to the Help Center</Text>
          <Text style={[styles.introText, textStyle]}>
            Find answers to common questions, learn how to use Ollie, and get support when needed.
          </Text>
          {user?.role && (
            <View style={[styles.roleBadge, isDark && styles.roleBadgeDark]}>
              <Ionicons 
                name={user.role === 'teen' ? 'person' : user.role === 'poster' ? 'business' : 'people'} 
                size={16} 
                color="#73af17" 
              />
              <Text style={[styles.roleText, textStyle]}>
                {user.role === 'teen' ? 'Teenlancer' : user.role === 'poster' ? 'Neighbor' : 'Parent'} Account
              </Text>
            </View>
          )}
        </View>

        {helpSections.map((section, sectionIndex) => {
          const isExpanded = expandedSections.has(section.title);
          return (
            <View key={sectionIndex} style={[styles.sectionCard, sectionCardStyle]}>
              <Pressable
                onPress={() => toggleSection(section.title)}
                style={styles.sectionHeader}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name={section.icon} size={24} color="#73af17" />
                  <Text style={[styles.sectionTitle, titleStyle]}>{section.title}</Text>
                </View>
                <Ionicons 
                  name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color={isDark ? '#9CA3AF' : '#6B7280'} 
                />
              </Pressable>

              {isExpanded && (
                <View style={styles.faqContainer}>
                  {section.items.map((faq, faqIndex) => {
                    const faqKey = `${section.title}-${faqIndex}`;
                    const isFAQExpanded = expandedFAQs.has(faqKey);
                    return (
                      <View key={faqIndex} style={styles.faqItem}>
                        <Pressable
                          onPress={() => toggleFAQ(faqKey)}
                          style={styles.faqQuestion}
                        >
                          <Text style={[styles.faqQuestionText, textStyle]}>{faq.question}</Text>
                          <Ionicons 
                            name={isFAQExpanded ? 'chevron-up' : 'chevron-down'} 
                            size={18} 
                            color={isDark ? '#9CA3AF' : '#6B7280'} 
                          />
                        </Pressable>
                        {isFAQExpanded && (
                          <View style={styles.faqAnswer}>
                            <Text style={[styles.faqAnswerText, textStyle]}>{faq.answer}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        <View style={[styles.contactCard, cardStyle]}>
          <Ionicons name="mail" size={32} color="#73af17" style={styles.contactIcon} />
          <Text style={[styles.contactTitle, titleStyle]}>Still Need Help?</Text>
          <Text style={[styles.contactText, textStyle]}>
            Can't find what you're looking for? Our support team is here to help.
          </Text>
          <Pressable
            style={[styles.contactButton, isDark && styles.contactButtonDark]}
            onPress={() => {
              // You can add navigation to a contact/support form here
              router.push('/legal/community-guidelines');
            }}
          >
            <Text style={[styles.contactButtonText, textStyle]}>Contact Support</Text>
            <Ionicons name="arrow-forward" size={18} color={isDark ? '#FFFFFF' : '#000000'} />
          </Pressable>
        </View>

        <View style={[styles.linksCard, cardStyle]}>
          <Text style={[styles.linksTitle, titleStyle]}>Related Resources</Text>
          <Pressable
            style={styles.linkItem}
            onPress={() => router.push('/legal/community-guidelines')}
          >
            <Ionicons name="people" size={20} color="#73af17" />
            <Text style={[styles.linkText, textStyle]}>Community Guidelines</Text>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
          <Pressable
            style={styles.linkItem}
            onPress={() => router.push('/legal/terms')}
          >
            <Ionicons name="document-text" size={20} color="#73af17" />
            <Text style={[styles.linkText, textStyle]}>Terms of Use</Text>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
          <Pressable
            style={styles.linkItem}
            onPress={() => router.push('/legal/privacy')}
          >
            <Ionicons name="shield-checkmark" size={20} color="#73af17" />
            <Text style={[styles.linkText, textStyle]}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
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
  introCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  introTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  introText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  textLight: {
    color: '#374151',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  roleBadgeDark: {
    backgroundColor: '#1F2937',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  sectionCardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  sectionCardLight: {
    backgroundColor: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  faqContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  faqItem: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
  },
  faqAnswer: {
    marginTop: 8,
    paddingLeft: 0,
  },
  faqAnswerText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6B7280',
  },
  contactCard: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  contactIcon: {
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  contactButtonDark: {
    backgroundColor: '#1F2937',
  },
  contactButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  linksCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  linksTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  linkText: {
    fontSize: 14,
    flex: 1,
  },
});

