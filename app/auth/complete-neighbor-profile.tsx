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
    if (!userId) {
      Alert.alert('Error', 'User ID is missing. Please start over.');
      router.replace('/auth/signup-adult');
      return;
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

      // Create or update user profile
      let profile;
      try {
        profile = await createUserProfile(userId, profileData);
      } catch (error: any) {
        // If profile exists, update it
        if (error.code !== '23505') { // Not a unique constraint error
          throw error;
        }
        profile = await getUserProfile(userId);
      }

      if (!profile) {
        throw new Error('Failed to create user profile');
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
    backgroundColor: '#000000',
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
  cardDark: {
    borderColor: '#4B5563',
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
