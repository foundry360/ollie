import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { getNeighborApplicationStatus } from '@/lib/api/neighborApplications';

export default function VerifyIdScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ applicationId?: string }>();
  const { 
    applicationId: storeApplicationId,
    userId,
    setCurrentStep 
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const applicationId = params.applicationId || storeApplicationId;

  const handleTakePhoto = async (side: 'front' | 'back') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take a photo of your ID.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 2],
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      if (side === 'front') {
        setFrontPhoto(result.assets[0].uri);
      } else {
        setBackPhoto(result.assets[0].uri);
      }
    }
  };


  const uploadPhoto = async (uri: string, fileName: string): Promise<string> => {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Determine content type from file extension
    const fileExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = fileExt === 'png' ? 'image/png' : 
                       fileExt === 'webp' ? 'image/webp' : 
                       'image/jpeg';
    
    const { data, error } = await supabase.storage
      .from('id-verifications')
      .upload(fileName, blob, {
        contentType: contentType,
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      
      if (error.message?.includes('row-level security') || error.message?.includes('violates') || error.statusCode === 403) {
        throw new Error(
          'Storage upload blocked by security policy. Please ensure storage policies are correctly configured.'
        );
      }
      
      if (error.message?.includes('Bucket not found') || error.message?.includes('not found')) {
        throw new Error(
          'Storage bucket not found. Please create an "id-verifications" bucket in Supabase Storage.'
        );
      }
      
      throw new Error(`Failed to upload image: ${error.message}`);
    }

    // For private buckets, create a signed URL (valid for 1 year)
    console.log('🔗 [verify-id] Creating signed URL for path:', data.path);
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('id-verifications')
      .createSignedUrl(data.path, 31536000); // 1 year expiry

    if (urlError) {
      console.error('❌ [verify-id] Error creating signed URL:', urlError);
      throw new Error(`Failed to generate file URL: ${urlError.message}`);
    }

    if (!signedUrlData?.signedUrl) {
      console.error('❌ [verify-id] No signed URL returned:', signedUrlData);
      throw new Error('Failed to generate file URL - no URL returned');
    }

    console.log('✅ [verify-id] Signed URL created successfully, length:', signedUrlData.signedUrl.length);
    return signedUrlData.signedUrl;
  };

  const handleSubmit = async () => {
    if (!frontPhoto) {
      Alert.alert('Missing Photo', 'Please take a photo of the front of your ID.');
      return;
    }

    if (!backPhoto) {
      Alert.alert('Missing Photo', 'Please take a photo of the back of your ID.');
      return;
    }

    if (!applicationId) {
      Alert.alert('Error', 'Application ID is missing. Please start over.');
      return;
    }

    // Always use the authenticated user's ID for storage policies
    // Storage policies check against auth.uid(), so we must use the authenticated session
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !authUser) {
      Alert.alert('Error', 'You must be logged in to continue. Please sign in again.');
      return;
    }
    
    const finalUserId = authUser.id;
    
    // Verify the application belongs to this user (security check)
    if (applicationId) {
      try {
        const application = await getNeighborApplicationStatus(applicationId);
        if (application && application.user_id !== finalUserId) {
          Alert.alert('Error', 'This application does not belong to your account.');
          return;
        }
      } catch (error) {
        console.log('Could not verify application ownership:', error);
        // Continue anyway - the storage policy will prevent unauthorized access
      }
    }

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Generate unique file names with user ID prefix
      const timestamp = Date.now();
      const frontFileName = `${finalUserId}/id-front-${timestamp}.jpg`;
      const backFileName = `${finalUserId}/id-back-${timestamp}.jpg`;

      // Upload photos
      const [frontPhotoUrl, backPhotoUrl] = await Promise.all([
        uploadPhoto(frontPhoto, frontFileName),
        uploadPhoto(backPhoto, backFileName),
      ]);

      // Update application with ID photo URLs
      console.log('💾 [verify-id] Updating application with ID photo URLs:', {
        applicationId,
        frontPhotoUrl: frontPhotoUrl.substring(0, 50) + '...',
        backPhotoUrl: backPhotoUrl.substring(0, 50) + '...',
      });

      const { data: updatedApp, error: updateError } = await supabase
        .from('pending_neighbor_applications')
        .update({
          id_front_photo_url: frontPhotoUrl,
          id_back_photo_url: backPhotoUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ [verify-id] Error updating application:', updateError);
        throw new Error(updateError.message || 'Failed to update application with ID photos');
      }

      if (!updatedApp) {
        console.error('❌ [verify-id] Update returned no data');
        throw new Error('Failed to update application - no data returned');
      }

      console.log('✅ [verify-id] Application updated successfully:', {
        id: updatedApp.id,
        hasFrontPhoto: !!updatedApp.id_front_photo_url,
        hasBackPhoto: !!updatedApp.id_back_photo_url,
        frontPhotoLength: updatedApp.id_front_photo_url?.length || 0,
        backPhotoLength: updatedApp.id_back_photo_url?.length || 0,
      });

      // Verify the update by querying it back (to ensure it persisted)
      const { data: verifiedApp, error: verifyError } = await supabase
        .from('pending_neighbor_applications')
        .select('id_front_photo_url, id_back_photo_url')
        .eq('id', applicationId)
        .single();

      if (verifyError) {
        console.error('⚠️ [verify-id] Warning: Could not verify update:', verifyError);
      } else {
        console.log('✅ [verify-id] Verified update persisted:', {
          hasFrontPhoto: !!verifiedApp?.id_front_photo_url,
          hasBackPhoto: !!verifiedApp?.id_back_photo_url,
        });
      }

      // Update store and redirect
      setCurrentStep('pending');
      router.replace({
        pathname: '/auth/pending-neighbor-approval',
        params: { applicationId }
      });
    } catch (error: any) {
      console.error('Error submitting ID verification:', error);
      Alert.alert(
        'Submission Failed',
        error.message || 'Failed to submit ID verification. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 40 }]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
            <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
          </Pressable>

          <View style={styles.logoContainer}>
            <Ionicons name="id-card" size={64} color="#73af17" />
          </View>

          <View style={styles.stepTracker}>
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, isDark && styles.stepNumberDark]}>
                <Text style={[styles.stepNumberText, isDark && styles.stepNumberTextDark]}>1</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Account Info</Text>
            </View>
            
            <View style={[styles.stepConnector, isDark && styles.stepConnectorDark]} />
            
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, isDark && styles.stepNumberDark]}>
                <Text style={[styles.stepNumberText, isDark && styles.stepNumberTextDark]}>2</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Address Info</Text>
            </View>
            
            <View style={[styles.stepConnector, isDark && styles.stepConnectorDark]} />
            
            <View style={styles.stepItem}>
              <View style={[styles.stepNumber, styles.stepNumberActive]}>
                <Text style={styles.stepNumberTextActive}>3</Text>
              </View>
              <Text style={[styles.stepLabel, isDark && styles.stepLabelDark]} numberOfLines={1}>Verify ID</Text>
            </View>
          </View>

          <Text style={[styles.title, titleStyle]}>ID Verification</Text>
          <Text style={[styles.subtitle, textStyle]}>
            Please use your camera to take clear photos of the front and back of your government-issued ID. This helps keep our community safe.
          </Text>

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
                <Text style={[styles.placeholderText, textStyle]}>No photo taken</Text>
              </View>
            )}

            <Button
              title="Take Photo"
              onPress={() => handleTakePhoto('front')}
              variant="secondary"
              fullWidth
            />
          </View>

          <View style={[styles.section, cardStyle]}>
            <Text style={[styles.sectionTitle, titleStyle]}>Back of ID</Text>
            <Text style={[styles.sectionDescription, textStyle]}>
              Take a clear photo of the back of your ID
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
                <Text style={[styles.placeholderText, textStyle]}>No photo taken</Text>
              </View>
            )}

            <Button
              title="Take Photo"
              onPress={() => handleTakePhoto('back')}
              variant="secondary"
              fullWidth
            />
          </View>

          <View style={styles.infoSection}>
            <Ionicons name="information-circle" size={20} color="#73af17" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, isDark && styles.infoTitleDark]}>Privacy & Security</Text>
              <Text style={[styles.infoText, isDark && styles.infoTextDark]}>
                Your ID photos are encrypted and stored securely. They are only used for verification purposes and are never shared with other users.
              </Text>
            </View>
          </View>

          <Button
            title={isUploading ? "Uploading..." : "Submit for Verification"}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={!frontPhoto || !backPhoto || isSubmitting}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
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
    backgroundColor: '#111827',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    alignSelf: 'flex-start',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'left',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  cardDark: {
    backgroundColor: '#374151',
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
    color: '#666666',
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
  infoSection: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: 'transparent',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  infoTitleDark: {
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
  },
  infoTextDark: {
    color: '#9CA3AF',
  },
  stepTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 8,
    paddingHorizontal: 16,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepNumberActive: {
    backgroundColor: '#73af17',
  },
  stepNumberDark: {
    backgroundColor: '#4B5563',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepNumberTextActive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stepNumberTextDark: {
    color: '#9CA3AF',
  },
  stepLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 60,
  },
  stepLabelDark: {
    color: '#9CA3AF',
  },
  stepConnector: {
    width: 24,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
    marginBottom: 24,
  },
  stepConnectorDark: {
    backgroundColor: '#4B5563',
  },
  textDark: {
    color: '#9CA3AF',
  },
});

