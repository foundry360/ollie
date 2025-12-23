import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface Tip {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const TIPS: Tip[] = [
  {
    id: '1',
    icon: 'person',
    title: 'Update Your Profile',
    description: 'Add your skills to get more gig matches',
  },
  {
    id: '2',
    icon: 'star',
    title: 'Build Your Rating',
    description: 'Complete gigs on time to earn great reviews',
  },
  {
    id: '3',
    icon: 'time',
    title: 'Set Your Availability',
    description: 'Let neighbors know when you\'re available',
  },
  {
    id: '4',
    icon: 'chatbubbles',
    title: 'Good Communication',
    description: 'Respond to messages quickly to build trust',
  },
];

export function TipsCarousel() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Tips for Success</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TIPS.map((tip) => (
          <View key={tip.id} style={[styles.tipCard, isDark && styles.tipCardDark]}>
            <View style={[styles.tipTopHalf, isDark && styles.tipTopHalfDark]}>
              {tip.id === '1' ? (
                <Image 
                  source={require('@/assets/profile-img.jpg')} 
                  style={styles.tipImageBackground}
                  resizeMode="cover"
                />
              ) : tip.id === '2' ? (
                <Image 
                  source={require('@/assets/rating-img.jpg')} 
                  style={styles.tipImageBackground}
                  resizeMode="cover"
                />
              ) : tip.id === '3' ? (
                <Image 
                  source={require('@/assets/availability-img.jpg')} 
                  style={styles.tipImageBackground}
                  resizeMode="cover"
                />
              ) : tip.id === '4' ? (
                <Image 
                  source={require('@/assets/talk-img.jpg')} 
                  style={styles.tipImageBackground}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.iconContainer, isDark && styles.iconContainerDark]}>
                  <Ionicons name={tip.icon} size={28} color={isDark ? '#A8D574' : '#73af17'} />
                </View>
              )}
            </View>
            <View style={styles.tipBottomHalf}>
              <Text 
                style={[styles.tipTitle, isDark && styles.tipTitleDark]}
                numberOfLines={2}
              >
                {tip.title}
              </Text>
              <Text style={[styles.tipDescription, isDark && styles.tipDescriptionDark]}>{tip.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 12,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tipCard: {
    width: 200,
    height: 200,
    borderRadius: 20,
    backgroundColor: '#F0F9E8',
    borderWidth: 1.5,
    borderColor: '#D4E8B8',
    shadowColor: '#73af17',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  tipCardDark: {
    backgroundColor: '#1F3A0F',
    borderColor: '#2D5A1A',
    shadowColor: '#A8D574',
    shadowOpacity: 0.2,
  },
  tipTopHalf: {
    height: '50%',
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  tipTopHalfDark: {
    backgroundColor: '#73af17',
  },
  tipImageBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  tipBottomHalf: {
    height: '50%',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5D9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconContainerDark: {
    backgroundColor: '#2D4A1A',
  },
  iconContainerOverImage: {
    backgroundColor: 'rgba(232, 245, 217, 0.9)',
  },
  tipTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5a8a12',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.1,
    width: '100%',
  },
  tipTitleDark: {
    color: '#A8D574',
  },
  tipDescription: {
    fontSize: 11,
    color: '#6B8A3A',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
  },
  tipDescriptionDark: {
    color: '#B8E584',
  },
});















