import { View, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function Loading() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  
  return (
    <View style={[styles.container, containerStyle]}>
      <ThreeDotsLoader color="#73af17" />
    </View>
  );
}

interface ThreeDotsLoaderProps {
  color?: string;
  size?: 'small' | 'medium' | 'large';
}

export function ThreeDotsLoader({ color = '#73af17', size = 'medium' }: ThreeDotsLoaderProps) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  
  const dotSize = size === 'small' ? 8 : size === 'large' ? 12 : 10;
  const dotSpacing = size === 'small' ? 4 : size === 'large' ? 6 : 5;
  
  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
    };
    
    const anim1 = animateDot(dot1, 0);
    const anim2 = animateDot(dot2, 200);
    const anim3 = animateDot(dot3, 400);
    
    anim1.start();
    anim2.start();
    anim3.start();
    
    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, [dot1, dot2, dot3]);
  
  return (
    <View style={[styles.dotsContainer, { gap: dotSpacing }]}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot1,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot2,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: dot3,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 20,
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    // Size and color are set inline
  },
});

