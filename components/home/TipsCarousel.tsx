import { View, Text, StyleSheet, FlatList, Image, Dimensions } from 'react-native';
import { useRef, useEffect } from 'react';
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
  const flatListRef = useRef<FlatList>(null);

  const screenWidth = Dimensions.get('window').width;
  const cardWidth = 200;
  const cardGap = 12;
  const snapInterval = cardWidth + cardGap;
  const sidePadding = (screenWidth - cardWidth) / 2;

  // Create infinite loop by duplicating the tips array
  const loopedTips = [...TIPS, ...TIPS, ...TIPS];
  const initialIndex = TIPS.length; // Start at the middle set

  useEffect(() => {
    // Scroll to the middle set on mount
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    }, 100);
  }, []);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / snapInterval);
    
    // If we're at the first set, jump to the middle set
    if (currentIndex < TIPS.length / 2) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: currentIndex + TIPS.length, 
          animated: false 
        });
      }, 50);
    }
    // If we're at the last set, jump to the middle set
    else if (currentIndex >= TIPS.length * 2.5) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: currentIndex - TIPS.length, 
          animated: false 
        });
      }, 50);
    }
  };

  const renderTip = ({ item: tip }: { item: Tip }) => (
    <View style={[styles.tipCard, isDark && styles.tipCardDark, { marginHorizontal: cardGap / 2 }]}>
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
  );

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Tips for Success</Text>
      <FlatList
        ref={flatListRef}
        data={loopedTips}
        renderItem={renderTip}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={snapInterval}
        snapToAlignment="center"
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: sidePadding }
        ]}
        getItemLayout={(data, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
        initialScrollIndex={initialIndex}
        onScrollToIndexFailed={(info) => {
          // Handle scroll to index failure
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
          });
        }}
      />
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
    color: '#000000',
  },
  scrollContent: {
    gap: 0,
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
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOpacity: 0.1,
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
    color: '#000000',
  },
  tipDescription: {
    fontSize: 11,
    color: '#6B8A3A',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
  },
  tipDescriptionDark: {
    color: '#374151',
  },
});















