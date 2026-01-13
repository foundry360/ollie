import { Image as RNImage, ImageProps as RNImageProps, StyleSheet } from 'react-native';
import { Platform } from 'react-native';

// Try to import expo-image, fallback to React Native Image if not available
let ExpoImage: any = null;
try {
  if (Platform.OS !== 'web') {
    ExpoImage = require('expo-image').Image;
  }
} catch (e) {
  // expo-image not available, will use React Native Image
  console.log('expo-image not available, using React Native Image');
}

interface OptimizedImageProps extends Omit<RNImageProps, 'source' | 'resizeMode'> {
  source: { uri: string } | number;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scaleDown';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  transition?: number;
}

export function OptimizedImage(props: OptimizedImageProps) {
  const { contentFit, cachePolicy, transition, ...restProps } = props;

  // Use expo-image if available (native builds)
  if (ExpoImage) {
    return (
      <ExpoImage
        {...restProps}
        contentFit={contentFit || 'cover'}
        cachePolicy={cachePolicy || 'memory-disk'}
        transition={transition || 200}
      />
    );
  }

  // Fallback to React Native Image (Expo Go, web, or when native module unavailable)
  const resizeMode = contentFit === 'contain' ? 'contain' : 
                     contentFit === 'fill' ? 'stretch' : 
                     contentFit === 'none' ? 'center' : 'cover';

  return (
    <RNImage
      {...restProps}
      resizeMode={resizeMode}
    />
  );
}



















