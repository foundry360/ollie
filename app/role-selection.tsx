import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

type Role = 'teen' | 'neighbor' | null;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  
  // Use expo-video instead of deprecated expo-av
  const player = useVideoPlayer(require('@/assets/background.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
  });

  useEffect(() => {
    // Start video playback when component mounts
    if (player) {
      player.play();
    }
  }, [player]);

  // Video player is automatically configured in useVideoPlayer hook
  // No need for separate useEffect

  const handleCreateAccount = () => {
    if (!selectedRole) {
      return; // Don't allow creating account without selecting a role
    }
    if (selectedRole === 'teen') {
      router.push('/auth/age-gate-teen');
    } else {
      router.push('/auth/signup-adult');
    }
  };

  const handleLogin = () => {
    router.push('/auth/login');
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <View style={[styles.container, containerStyle]}>
      <VideoView
        player={player}
        style={styles.backgroundVideo}
        contentFit="cover"
        nativeControls={false}
      />
      <LinearGradient
        colors={['transparent', 'rgba(30, 58, 95, 0.4)', 'rgba(45, 74, 111, 0.85)', 'rgba(17, 24, 39, 1)', '#111827']}
        locations={[0, 0.5, 0.7, 0.9, 1]}
        style={styles.gradient}
      />
      <SafeAreaView style={styles.safeContent} edges={[]}>
        <View style={styles.content}>
          <View style={styles.spacerTop} />

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.taglineContainer}>
                <Text 
                  style={[styles.tagline, isDark && styles.taglineDark]} 
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  Built for <Text style={styles.taglineHighlight}>Teens</Text>. Trusted by <Text style={styles.taglineHighlight}>Parents</Text>.
                </Text>
                <Text style={[styles.tagline, isDark && styles.taglineDark]}>
                  Powered by <Text style={styles.taglineHighlight}>Community</Text>
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.spacerBottom} />

          <View style={styles.bottomSection}>
          <View style={styles.roleToggle}>
            <Pressable
              style={[
                styles.toggleOption,
                styles.toggleOptionLeft,
                selectedRole === 'teen' && styles.toggleOptionSelected,
                isDark && selectedRole !== 'teen' && styles.toggleOptionDark,
                !selectedRole || selectedRole === 'teen' ? null : (isDark ? styles.toggleOptionWithDividerDark : styles.toggleOptionWithDivider),
              ]}
              onPress={() => setSelectedRole('teen')}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedRole === 'teen' 
                    ? styles.toggleTextSelected 
                    : (isDark ? styles.toggleTextDark : styles.toggleTextLight),
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                I'm a Teenlancer
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.toggleOption,
                styles.toggleOptionRight,
                selectedRole === 'neighbor' && styles.toggleOptionSelected,
                isDark && selectedRole !== 'neighbor' && styles.toggleOptionDark,
              ]}
              onPress={() => setSelectedRole('neighbor')}
            >
              <Text
                style={[
                  styles.toggleText,
                  selectedRole === 'neighbor' 
                    ? styles.toggleTextSelected 
                    : (isDark ? styles.toggleTextDark : styles.toggleTextLight),
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                I'm a Neighbor
              </Text>
            </Pressable>
          </View>

          {selectedRole && (
            <View style={styles.actions}>
              <Button
                title="Get Started"
                onPress={handleCreateAccount}
                variant="primary"
                fullWidth
              />
            </View>
          )}

          <Pressable style={styles.loginLink} onPress={handleLogin}>
            <Text style={[styles.loginLinkText, isDark && styles.loginLinkTextDark]}>
              Already have an account? Login
            </Text>
          </Pressable>
        </View>
      </View>
      </SafeAreaView>
    </View>
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
    backgroundColor: '#111827',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 0,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
  safeContent: {
    flex: 1,
    zIndex: 2,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 0,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0,
    width: '100%',
  },
  logo: {
    width: 210,
    height: 210,
    marginBottom: -8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 24,
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  taglineContainer: {
    marginTop: -4,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    color: '#FFFFFF',
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: 0.3,
    opacity: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  taglineDark: {
    color: '#FFFFFF',
  },
  taglineHighlight: {
    color: '#73af17',
  },
  spacerTop: {
    flex: 1.4,
  },
  spacerBottom: {
    flex: 0.6,
  },
  bottomSection: {
    marginBottom: 32,
  },
  roleToggle: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 0,
  },
  toggleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  toggleOptionLeft: {
    borderTopLeftRadius: 28,
    borderBottomLeftRadius: 28,
  },
  toggleOptionRight: {
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    borderLeftWidth: 0,
  },
  toggleOptionWithDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleOptionWithDividerDark: {
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
  },
  toggleOptionDark: {
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  toggleOptionSelected: {
    borderColor: '#73af17',
    backgroundColor: '#FFFFFF',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    numberOfLines: 1,
  },
  toggleTextLight: {
    color: '#FFFFFF',
  },
  toggleTextSelected: {
    color: '#000000',
  },
  toggleTextDark: {
    color: '#FFFFFF',
  },
  actions: {
    marginBottom: 16,
    width: '100%',
  },
  loginLink: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#73af17',
  },
  loginLinkTextDark: {
    color: '#73af17',
  },
});

