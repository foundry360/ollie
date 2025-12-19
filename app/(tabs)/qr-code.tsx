import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

export default function QRCodeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';

  // Generate profile URL - use environment variable for localhost testing
  const baseUrl = process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://olliejobs.com';
  const profileUrl = user?.id 
    ? `${baseUrl}/profile/${user.id}` 
    : '';

  const handleShare = async () => {
    if (!profileUrl) {
      Alert.alert('Error', 'Unable to generate profile link');
      return;
    }

    try {
      await Share.share({
        message: `Check out my Ollie profile: ${profileUrl}`,
        url: profileUrl,
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share profile');
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  if (!user || user.role !== 'teen') {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, titleStyle]}>Access Denied</Text>
          <Text style={[styles.errorSubtext, textStyle]}>This feature is only available for Teenlancers.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom']}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, cardStyle]}>
          <Text style={[styles.title, titleStyle]}>Your Profile QR Code</Text>
          <Text style={[styles.subtitle, textStyle]}>
            Share this QR code so others can view your profile
          </Text>

          {profileUrl ? (
            <View style={styles.qrContainer}>
              <View style={[styles.qrWrapper, isDark && styles.qrWrapperDark]}>
                <QRCode
                  value={profileUrl}
                  size={250}
                  color={isDark ? '#FFFFFF' : '#000000'}
                  backgroundColor={isDark ? '#111111' : '#FFFFFF'}
                />
              </View>
            </View>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, textStyle]}>Unable to generate QR code</Text>
            </View>
          )}

          <Pressable
            style={[styles.shareButton, isDark && styles.shareButtonDark]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            <Text style={styles.shareButtonText}>Share Profile Link</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    borderRadius: 12,
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#111111',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 0,
    color: '#000000',
    textAlign: 'center',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    textAlign: 'center',
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  qrWrapper: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  qrWrapperDark: {
    backgroundColor: '#111111',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#73af17',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    gap: 8,
    marginTop: 16,
  },
  shareButtonDark: {
    backgroundColor: '#73af17',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
