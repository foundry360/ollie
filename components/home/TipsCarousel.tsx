import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
    title: 'Complete Your Profile',
    description: 'Add your skills and availability to get more task matches',
  },
  {
    id: '2',
    icon: 'time',
    title: 'Set Your Availability',
    description: 'Let neighbors know when you\'re available to work',
  },
  {
    id: '3',
    icon: 'star',
    title: 'Build Your Rating',
    description: 'Complete tasks on time to earn great reviews',
  },
  {
    id: '4',
    icon: 'chatbubbles',
    title: 'Communicate Clearly',
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
            <View style={styles.tipContent}>
              <Ionicons name={tip.icon} size={32} color={isDark ? '#A8D574' : '#73af17'} />
              <Text style={[styles.tipTitle, isDark && styles.tipTitleDark]}>{tip.title}</Text>
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
    fontSize: 16,
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
    borderRadius: 16,
    backgroundColor: '#E8F5D9',
    borderWidth: 1,
    borderColor: '#C8E5A3',
  },
  tipCardDark: {
    backgroundColor: '#2D4A1A',
    borderColor: '#3D5F2A',
  },
  tipContent: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#73af17',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  tipTitleDark: {
    color: '#A8D574',
  },
  tipDescription: {
    fontSize: 13,
    color: '#5a8a12',
    textAlign: 'center',
    lineHeight: 18,
  },
  tipDescriptionDark: {
    color: '#B8E584',
  },
});

