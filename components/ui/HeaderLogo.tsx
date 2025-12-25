import { Image, StyleSheet } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useEffect } from 'react';

export function HeaderLogo() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/ui/HeaderLogo.tsx:6',message:'HeaderLogo render',data:{isDark,colorScheme},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
  });
  // #endregion

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
