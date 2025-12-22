import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function Loading() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const spinValue = useRef(new Animated.Value(0)).current;
  
  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinValue]);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{ rotate: spin }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#73af17',
    borderTopColor: 'transparent',
  },
});

