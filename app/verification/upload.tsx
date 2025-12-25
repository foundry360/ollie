import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '@/components/ui/Loading';

export default function VerificationUploadScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickPhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontPhoto(result.assets[0].uri);
      } else {
        setBackPhoto(result.assets[0].uri);
      }
    }
  };

  const handleTakePhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontPhoto(result.assets[0].uri);
      } else {
        setBackPhoto(result.assets[0].uri);
      }
    }
  };

  const handleSubmit = async () => {
    if (!frontPhoto) {
      Alert.alert('Missing Photo', 'Please upload a photo of the front of your ID.');
      return;
    }

    setIsSubmitting(true);
    try {
      // In production, upload photos to Supabase Storage
      // For now, just mark as submitted
      // TODO: Implement actual file upload to Supabase Storage
      
      // Update user verification status (this would be done via API in production)
      Alert.alert(
        'Verification Submitted',
        'Your ID verification has been submitted. We will review it and notify you once it\'s approved.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={[styles.title, titleStyle]}>ID Verification</Text>
          <Text style={[styles.subtitle, textStyle]}>
            Upload photos of your government-issued ID to verify your identity. This helps keep our community safe.
          </Text>
        </View>

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>Front of ID</Text>
          <Text style={[styles.sectionDescription, textStyle]}>
            Take a clear photo of the front of your ID
          </Text>
          
          {frontPhoto ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: frontPhoto }} style={styles.photo} />
              <Pressable
                style={styles.removeButton}
                onPress={() => setFrontPhoto(null)}
              >
                <Ionicons name="close-circle" size={32} color="#DC2626" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="id-card-outline" size={64} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.placeholderText, textStyle]}>No photo selected</Text>
            </View>
          )}

          <View style={styles.photoButtons}>
            <Button
              title="Pick from Library"
              onPress={() => handlePickPhoto('front')}
              variant="secondary"
            />
            <Button
              title="Take Photo"
              onPress={() => handleTakePhoto('front')}
              variant="secondary"
            />
          </View>
        </View>

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>Back of ID (Optional)</Text>
          <Text style={[styles.sectionDescription, textStyle]}>
            Some IDs require a back photo for verification
          </Text>
          
          {backPhoto ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: backPhoto }} style={styles.photo} />
              <Pressable
                style={styles.removeButton}
                onPress={() => setBackPhoto(null)}
              >
                <Ionicons name="close-circle" size={32} color="#DC2626" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="id-card-outline" size={64} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.placeholderText, textStyle]}>No photo selected</Text>
            </View>
          )}

          <View style={styles.photoButtons}>
            <Button
              title="Pick from Library"
              onPress={() => handlePickPhoto('back')}
              variant="secondary"
            />
            <Button
              title="Take Photo"
              onPress={() => handleTakePhoto('back')}
              variant="secondary"
            />
          </View>
        </View>

        <View style={[styles.infoSection, cardStyle]}>
          <Ionicons name="information-circle" size={24} color="#73af17" />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, titleStyle]}>Privacy & Security</Text>
            <Text style={[styles.infoText, textStyle]}>
              Your ID photos are encrypted and stored securely. They are only used for verification purposes and are never shared with other users.
            </Text>
          </View>
        </View>

        <Button
          title="Submit for Verification"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!frontPhoto || isSubmitting}
          fullWidth
        />
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
    backgroundColor: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#73af1720',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 16,
    color: '#6B7280',
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 200,
    backgroundColor: '#F3F4F6',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  photoPlaceholder: {
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  placeholderText: {
    fontSize: 14,
    marginTop: 8,
    color: '#6B7280',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  infoSection: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#EFF6FF',
    gap: 12,
  },
  infoSectionDark: {
    backgroundColor: '#1E3A8A',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#1E40AF',
  },
  infoTitleDark: {
    color: '#93C5FD',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1E40AF',
  },
  infoTextDark: {
    color: '#DBEAFE',
  },
  labelDark: {
    color: '#9CA3AF',
  },
});
