import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';

export default function RequestSentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ parentEmail?: string }>();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  const handleContinue = () => {
    if (params.parentEmail) {
      router.replace(`/auth/pending-approval?parentEmail=${encodeURIComponent(params.parentEmail)}`);
    } else {
      router.replace('/role-selection');
    }
  };

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#73af17" />
        </View>

        <Text style={[styles.title, textStyle]}>Request Sent!</Text>
        
        <Text style={[styles.subtitle, subtitleStyle]}>
          We've sent an approval request to:
        </Text>
        
        {params.parentEmail && (
          <Text style={[styles.emailText, textStyle]}>{params.parentEmail}</Text>
        )}
        
        <Text style={[styles.subtitle, subtitleStyle]}>
          Once your parent approves, you'll be able to create your account and start using Ollie!
        </Text>

        <Button
          title="Continue"
          onPress={handleContinue}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 150,
    height: 150,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  textLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
    marginTop: 8,
    textAlign: 'center',
  },
});

