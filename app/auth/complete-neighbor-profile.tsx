import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { useNeighborSignupStore } from '@/stores/neighborSignupStore';
import { getNeighborApplicationStatus } from '@/lib/api/neighborApplications';
import { createUserProfile, getUserProfile, supabase } from '@/lib/supabase';
import { UserRole } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const profileSchema = z.object({
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function CompleteNeighborProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ applicationId?: string }>();
  const { setUser, setLoading } = useAuthStore();
  const { 
    applicationId: storeApplicationId,
    userId,
    email,
    full_name,
    phone,
    address,
    date_of_birth,
    reset: resetSignupStore 
  } = useNeighborSignupStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [application, setApplication] = useState<any>(null);
  const applicationId = params.applicationId || storeApplicationId;

  useEffect(() => {
    // Verify application is approved
    if (applicationId) {
      verifyApplication();
    }
  }, [applicationId]);

  const verifyApplication = async () => {
    if (!applicationId) return;

    try {
      const app = await getNeighborApplicationStatus(applicationId);
      setApplication(app);

      if (!app) {
        Alert.alert('Error', 'Application not found');
        router.replace('/auth/signup-adult');
        return;
      }

      if (app.status !== 'approved') {
        Alert.alert(
          'Not Approved',
          app.status === 'pending' 
            ? 'Your application is still under review.'
            : 'Your application was not approved.'
        );
        router.replace('/auth/pending-neighbor-approval');
        return;
      }
    } catch (error: any) {
      console.error('Error verifying application:', error);
      Alert.alert('Error', 'Failed to verify application status');
    }
  };

  const pickProfilePhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const { control, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: '',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    // Verify current auth user
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    // Use application.user_id if available, otherwise fall back to store userId or auth user ID
    // This ensures we use the correct ID that matches what the trigger created
    const targetUserId = application?.user_id || userId || authUser?.id;
    
    if (!targetUserId) {
      Alert.alert('Error', 'User ID is missing. Please start over.');
      router.replace('/auth/signup-adult');
      return;
    }
    
    // #region agent log
    console.log('[DEBUG] complete-neighbor-profile - User ID verification', {
      authUserId: authUser?.id,
      storeUserId: userId,
      applicationUserId: application?.user_id,
      targetUserId,
      authMatchesApplication: authUser?.id === application?.user_id,
      authMatchesStore: authUser?.id === userId,
      authMatchesTarget: authUser?.id === targetUserId
    });
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/complete-neighbor-profile.tsx:111',message:'User ID verification',data:{authUserId:authUser?.id,storeUserId:userId,applicationUserId:application?.user_id,targetUserId,authMatchesApplication:authUser?.id===application?.user_id,authMatchesStore:authUser?.id===userId,authMatchesTarget:authUser?.id===targetUserId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
    // #endregion
    
    // Warn if there's a mismatch (but continue anyway - the trigger may have created the profile)
    if (authUser?.id && targetUserId !== authUser.id) {
      console.warn('⚠️ [complete-profile] User ID mismatch detected:', {
        authUserId: authUser.id,
        targetUserId,
        applicationUserId: application?.user_id,
        storeUserId: userId
      });
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      // Create full user profile with all data
      const profileData: any = {
        email: email || application?.email,
        full_name: full_name || application?.full_name,
        phone: phone || application?.phone,
        address: address || application?.address,
        date_of_birth: date_of_birth || application?.date_of_birth,
        role: UserRole.POSTER,
        verified: true,
        application_status: 'active',
      };

      if (data.bio) {
        profileData.bio = data.bio;
      }

      // Upload profile photo if selected
      if (profilePhoto) {
        // TODO: Upload to Supabase Storage and get URL
        // For now, we'll skip photo upload
        console.log('Profile photo selected:', profilePhoto);
      }

      // Get the address from application if not in store
      const finalAddress = address || application?.address;
      console.log('💾 [complete-profile] Saving address:', finalAddress);

      // #region agent log
      console.log('[DEBUG] complete-neighbor-profile - BEFORE createUserProfile', {
        storeUserId: userId,
        applicationUserId: application?.user_id,
        targetUserId,
        applicationId: application?.id,
        idsMatch: userId === application?.user_id,
        usingApplicationId: !!application?.user_id
      });
      fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/complete-neighbor-profile.tsx:151',message:'BEFORE createUserProfile',data:{storeUserId:userId,applicationUserId:application?.user_id,targetUserId,applicationId:application?.id,idsMatch:userId===application?.user_id,usingApplicationId:!!application?.user_id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      
      // Create or update user profile
      // Use application.user_id to match what the trigger created
      let profile;
      try {
        profile = await createUserProfile(targetUserId, {
          ...profileData,
          address: finalAddress,
        });
        // #region agent log
        console.log('[DEBUG] complete-neighbor-profile - Profile created', {
          profileId: profile?.id,
          storeUserId: userId,
          idsMatch: profile?.id === userId
        });
        fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/auth/complete-neighbor-profile.tsx:158',message:'Profile created',data:{profileId:profile?.id,storeUserId:userId,idsMatch:profile?.id===userId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
        console.log('✅ [complete-profile] Profile created, address:', profile?.address);
      } catch (error: any) {
        // If profile exists, update it with address and other data
        if (error.code !== '23505') { // Not a unique constraint error
          throw error;
        }
        // Profile exists, update it with address and other fields
        console.log('⚠️ [complete-profile] Profile exists, updating with address:', finalAddress);
        const { data: updatedProfile, error: updateError } = await supabase
          .from('users')
          .update({
            address: finalAddress,
            phone: profileData.phone,
            date_of_birth: profileData.date_of_birth,
            verified: true,
            ...(data.bio && { bio: data.bio }),
          })
          .eq('id', targetUserId)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ [complete-profile] Error updating existing profile:', updateError);
          throw updateError;
        }
        
        profile = updatedProfile;
        console.log('✅ [complete-profile] Profile updated, address:', profile?.address);
      }

      if (!profile) {
        throw new Error('Failed to create user profile');
      }
      
      // Always ensure address is saved (in case RPC function doesn't support it yet)
      if (finalAddress && (!profile.address || profile.address !== finalAddress)) {
        console.log('🔄 [complete-profile] Ensuring address is saved:', finalAddress);
        const { data: updatedProfile, error: updateError } = await supabase
          .from('users')
          .update({ address: finalAddress })
          .eq('id', targetUserId)
          .select()
          .single();
        
        if (updateError) {
          console.error('❌ [complete-profile] Error updating address:', updateError);
          // Don't throw - profile was created successfully, just log the error
        } else if (updatedProfile) {
          profile = updatedProfile;
          console.log('✅ [complete-profile] Address confirmed saved:', profile.address);
        }
      }

      // Set user and clear signup store
      setUser(profile);
      resetSignupStore();
      setLoading(false);
      setIsSubmitting(false);

      Alert.alert(
        'Welcome to Ollie!',
        'Your account has been activated. You can now start posting tasks.',
        [
          {
            text: 'Get Started',
            onPress: () => router.replace('/(tabs)/home')
          }
        ]
      );
    } catch (error: any) {
      console.error('Error completing profile:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to complete profile. Please try again.'
      );
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;

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
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Image 
              source={require('@/assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Ionicons name="checkmark-circle" size={64} color="#73af17" style={styles.successIcon} />
          <Text style={[styles.title, titleStyle]}>Application Approved!</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>
            Complete your profile to get started on Ollie
          </Text>

          <View style={styles.photoSection}>
            <Text style={[styles.sectionLabel, subtitleStyle]}>Profile Photo (Optional)</Text>
            <Pressable
              style={[styles.photoButton, cardStyle]}
              onPress={pickProfilePhoto}
            >
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={32} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  <Text style={[styles.photoPlaceholderText, subtitleStyle]}>Add Photo</Text>
                </View>
              )}
            </Pressable>
          </View>

          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Bio (Optional)"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.bio?.message}
                placeholder="Tell us about yourself..."
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            )}
          />

          <Button
            title="Complete Profile"
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={isSubmitting}
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logo: {
    width: 100,
    height: 100,
  },
  successIcon: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
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
    textAlign: 'center',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  photoSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  cardLight: {
    borderColor: '#E5E7EB',
  },
  cardDark: {
    borderColor: '#1F2937',
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  photoPlaceholderText: {
    fontSize: 12,
    marginTop: 4,
  },
});
