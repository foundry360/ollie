import { Image, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useEffect } from 'react';

export function HeaderLogo() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';


  return (
    <Image 
      source={require('@/assets/logo.png')} 
      style={styles.logo}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    height: 44,
    width: 140,
  },
});
