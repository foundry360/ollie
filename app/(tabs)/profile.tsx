import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import { updateProfile, uploadProfilePhoto } from '@/lib/api/users';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimeRangePicker } from '@/components/ui/TimeRangePicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Ionicons } from '@expo/vector-icons';

// Helper functions to convert between 24-hour and 12-hour format
const convertTo12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

const convertTo24Hour = (time12: string): string => {
  if (!time12) return '';
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return time12; // Return as-is if already in 24-hour format
  
  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
};

// Default availability structure (stored in 24-hour format, displayed in 12-hour)
const defaultAvailability = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '09:00', end: '17:00' },
  sunday: { start: '09:00', end: '17:00' },
};

export default function ProfileScreen() {
  const { user, setUser } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [profilePhoto, setProfilePhoto] = useState<string | null>(user?.profile_photo_url || null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [editingSection, setEditingSection] = useState<'account' | 'location' | 'bio' | 'tasks' | 'availability' | null>(null);
  const [isSavingAccountInfo, setIsSavingAccountInfo] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [isSavingTasks, setIsSavingTasks] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [useSameHours, setUseSameHours] = useState(false);
  const [sameHoursRange, setSameHoursRange] = useState({ start: '09:00', end: '17:00' });
  
  // Account Info form state
  const [accountInfoData, setAccountInfoData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  
  // Parse address string into components
  const parseAddress = (addressString?: string) => {
    if (!addressString) return { address: '', city: '', state: '', zipCode: '' };
    
    // Try to parse "address, city, state zip" format
    const parts = addressString.split(',').map(s => s.trim());
    if (parts.length >= 3) {
      const address = parts[0];
      const city = parts[1];
      const stateZip = parts[2].split(' ');
      const state = stateZip[0] || '';
      const zipCode = stateZip.slice(1).join('') || '';
      return { address, city, state, zipCode };
    }
    return { address: addressString, city: '', state: '', zipCode: '' };
  };

  // Format phone number with +1 prefix and hyphens (+1-XXX-XXX-XXXX)
  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Remove leading 1 if present (we'll add it back)
    const digitsWithout1 = digits.startsWith('1') ? digits.slice(1) : digits;
    
    // Limit to 10 digits
    const limitedDigits = digitsWithout1.slice(0, 10);
    
    // Format: +1-XXX-XXX-XXXX
    if (limitedDigits.length === 0) return '';
    if (limitedDigits.length <= 3) return `+1-${limitedDigits}`;
    if (limitedDigits.length <= 6) return `+1-${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3)}`;
    return `+1-${limitedDigits.slice(0, 3)}-${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  };

  // Location form state
  const [locationData, setLocationData] = useState(parseAddress(user?.address));
  
  // Bio form state
  const [bioData, setBioData] = useState(user?.bio || '');

  // Available skills list
  const availableSkills = ['Yard Work', 'Pet Care', 'Babysitting', 'Tutoring', 'Cleaning', 'Moving', 'Tech Help', 'Cooking', 'Delivery', 'Other'];
  
  // Jobs form state
  const [tasksData, setTasksData] = useState({
    skills: user?.skills || [] as string[],
    availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
  });

  // Sync form state when user changes
  useEffect(() => {
    setAccountInfoData({
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setLocationData(parseAddress(user?.address));
    setProfilePhoto(user?.profile_photo_url || null);
    setBioData(user?.bio || '');
    setTasksData({
      skills: user?.skills || [],
      availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
    });
  }, [user]);

  const handlePickPhoto = async () => {
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
      await handlePhotoSelected(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handlePhotoSelected(result.assets[0].uri);
    }
  };

  const handlePhotoSelected = async (uri: string) => {
    setIsUploadingPhoto(true);
    try {
      // Upload to Supabase Storage and get public URL
      const publicUrl = await uploadProfilePhoto(uri);
      
      // Update profile with new photo URL
      const updatedProfile = await updateProfile({ profile_photo_url: publicUrl });
      setUser(updatedProfile);
      setProfilePhoto(publicUrl);
      
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', error.message || 'Failed to upload profile photo');
    } finally {
      setIsUploadingPhoto(false);
    }
  };


  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
        <Text style={[styles.screenTitle, titleStyle]}>Profile</Text>
        <View style={[
          styles.profileHeader, 
          cardStyle,
          (user?.role === 'teen' || user?.role === 'poster') && (isDark ? styles.profileHeaderLightGreenDark : styles.profileHeaderLightGreen)
        ]}>
          <Pressable 
            style={styles.photoContainer} 
            onPress={() => {
              // Show action sheet to choose photo source
              Alert.alert(
                'Change Profile Photo',
                'Choose an option',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Take Photo', onPress: handleTakePhoto },
                  { text: 'Choose from Library', onPress: handlePickPhoto },
                  ...(profilePhoto ? [{ text: 'Remove Photo', style: 'destructive', onPress: () => setProfilePhoto(null) }] : []),
                ]
              );
            }}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.photo} />
            ) : (
              <View style={[styles.photoPlaceholder, isDark && styles.photoPlaceholderDark]}>
                <Ionicons name="person" size={48} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </View>
            )}
            <View style={styles.photoEditBadge}>
              {isUploadingPhoto ? (
                <Ionicons name="hourglass" size={20} color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={20} color="#FFFFFF" />
              )}
            </View>
          </Pressable>
          <View style={styles.profileInfoContainer}>
            {isUploadingPhoto && (
              <Text style={[styles.uploadingText, textStyle]}>Uploading photo...</Text>
            )}
            <Text style={[styles.name, titleStyle]}>{user?.full_name || 'User'}</Text>
            <View style={styles.roleBadge}>
              <Text style={[styles.roleText, textStyle]}>
                {user?.role === 'teen' ? 'TEENLANCER' : 
                 user?.role === 'poster' ? 'NEIGHBOR' : 
                 user?.role === 'parent' ? 'PARENT' : 
                 user?.role === 'admin' ? 'ADMIN' : 
                 user?.role?.toUpperCase() || 'USER'}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, cardStyle]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, titleStyle]}>Account Info</Text>
            </View>
            <Pressable onPress={() => {
              setEditingSection('account');
              setAccountInfoData({
                full_name: user?.full_name || '',
                email: user?.email || '',
                phone: user?.phone || '',
              });
            }}>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </Pressable>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color="#73af17" />
            <Text style={[styles.infoValue, textStyle]}>{user?.full_name || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="mail" size={20} color="#73af17" />
            <Text style={[styles.infoValue, textStyle]}>{user?.email || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color="#73af17" />
            <Text style={[styles.infoValue, textStyle]}>{user?.phone ? formatPhoneNumber(user.phone) : 'Not set'}</Text>
          </View>
        </View>

        <View style={[styles.section, cardStyle]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, titleStyle]}>Location</Text>
            </View>
            <Pressable onPress={() => {
              setEditingSection('location');
              setLocationData(parseAddress(user?.address));
            }}>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </Pressable>
          </View>

          {locationData.address && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#73af17" />
              <Text style={[styles.infoValue, textStyle]}>{locationData.address}</Text>
            </View>
          )}
          {(locationData.city || locationData.state || locationData.zipCode) && (
            <View style={[styles.infoRow, styles.infoRowNoMargin]}>
              <Text style={[styles.infoValue, textStyle]}>
                {[
                  locationData.city,
                  locationData.state && locationData.zipCode 
                    ? `${locationData.state} ${locationData.zipCode}`.trim()
                    : locationData.state || locationData.zipCode
                ].filter(part => part && part.trim().length > 0).join(', ')}
              </Text>
            </View>
          )}
          {!locationData.address && !locationData.city && !locationData.state && !locationData.zipCode && (
            <View style={styles.infoRow}>
              <Ionicons name="location" size={20} color="#73af17" />
              <Text style={[styles.infoValue, textStyle]}>Not set</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, cardStyle]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={[styles.sectionTitle, titleStyle]}>Bio</Text>
            </View>
            <Pressable onPress={() => {
              setEditingSection('bio');
              setBioData(user?.bio || '');
            }}>
              <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
            </Pressable>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoValue, textStyle]}>{user?.bio || 'Not set'}</Text>
          </View>
        </View>

        {user?.role === 'teen' && (
          <View style={[styles.section, cardStyle]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, titleStyle]}>Gigs</Text>
              </View>
              <Pressable onPress={() => {
                setEditingSection('tasks');
                setTasksData({
                  skills: user?.skills || [],
                  availability: tasksData.availability,
                });
              }}>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              </Pressable>
            </View>

            <Text style={[styles.subsectionTitle, titleStyle]}>Skills</Text>
            {tasksData.skills && tasksData.skills.length > 0 ? (
              <View style={styles.skillsContainer}>
                {tasksData.skills.map((skill) => (
                  <View
                    key={skill}
                    style={[styles.skillBubble, styles.skillBubbleDisplay]}
                  >
                    <Text style={styles.skillTextSelected}>
                      {skill}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.infoValue, textStyle]}>No skills selected</Text>
            )}
          </View>
        )}

        {user?.role === 'teen' && (
          <View style={[styles.section, cardStyle]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[styles.sectionTitle, titleStyle]}>Availability</Text>
              </View>
              <Pressable onPress={() => {
                setEditingSection('availability');
                const availability = (user?.availability as typeof defaultAvailability) || defaultAvailability;
                setTasksData({
                  ...tasksData,
                  availability,
                });
                // Check if all days have the same hours to set toggle state
                const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                const firstDay = availability.monday;
                const allSame = days.every(day => {
                  const dayData = availability[day as keyof typeof availability];
                  return dayData.start === firstDay.start && dayData.end === firstDay.end;
                });
                setUseSameHours(allSame);
                if (allSame) {
                  setSameHoursRange({
                    start: firstDay.start,
                    end: firstDay.end,
                  });
                }
              }}>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              </Pressable>
            </View>

            {(() => {
              // Check if all days have the same hours
              const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
              const firstDay = tasksData.availability.monday;
              const allSame = days.every(day => {
                const dayData = tasksData.availability[day as keyof typeof tasksData.availability];
                return dayData.start === firstDay.start && dayData.end === firstDay.end;
              });

              if (allSame) {
                // Show single "Hours" row when all days are the same
                return (
                  <View style={styles.availabilityRow}>
                    <Ionicons name="time" size={20} color="#73af17" />
                    <Text style={[styles.infoValue, textStyle]}>
                      {convertTo12Hour(firstDay.start)} - {convertTo12Hour(firstDay.end)}
                    </Text>
                  </View>
                );
              } else {
                // Show individual days
                return days.map((day) => {
                  const dayData = tasksData.availability[day as keyof typeof tasksData.availability];
                  const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                  return (
                    <View key={day} style={styles.availabilityRow}>
                      <Ionicons name="time" size={20} color="#73af17" />
                      <Text style={[styles.dayLabel, textStyle, styles.availabilityDayFixed]}>
                        {dayName}
                      </Text>
                      <Text style={[styles.infoValue, textStyle]}>
                        {convertTo12Hour(dayData.start)} - {convertTo12Hour(dayData.end)}
                      </Text>
                    </View>
                  );
                });
              }
            })()}
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Account Info Bottom Sheet */}
      <BottomSheet
        visible={editingSection === 'account'}
        onClose={() => {
          setEditingSection(null);
          setAccountInfoData({
            full_name: user?.full_name || '',
            email: user?.email || '',
            phone: user?.phone || '',
          });
        }}
        title="Edit Account Info"
      >
        <View style={styles.bottomSheetContent}>
          <Input
            label="Full Name"
            value={accountInfoData.full_name}
            onChangeText={(text) => setAccountInfoData({ ...accountInfoData, full_name: text })}
          />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, styles.infoLabelBold, labelStyle]}>Email</Text>
            <Text style={[styles.infoValue, textStyle]}>{user?.email || 'Not set'}</Text>
          </View>
          <Input
            label="Phone"
            value={accountInfoData.phone}
            onChangeText={(text) => setAccountInfoData({ ...accountInfoData, phone: formatPhoneNumber(text) })}
            keyboardType="phone-pad"
            style={{ marginTop: 16 }}
          />
          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setEditingSection(null);
                setAccountInfoData({
                  full_name: user?.full_name || '',
                  email: user?.email || '',
                  phone: user?.phone || '',
                });
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isSavingAccountInfo ? 'Saving...' : 'Save Changes'}
              onPress={async () => {
                setIsSavingAccountInfo(true);
                try {
                  const updateData: any = {
                    full_name: accountInfoData.full_name,
                  };
                  
                  if (accountInfoData.phone) {
                    updateData.phone = accountInfoData.phone;
                  }
                  
                  const updatedProfile = await updateProfile(updateData);
                  setUser(updatedProfile);
                  setEditingSection(null);
                  Alert.alert('Success', 'Account info updated successfully!');
                } catch (error: any) {
                  console.error('Error updating account info:', error);
                  Alert.alert('Error', error.message || 'Failed to update account info');
                } finally {
                  setIsSavingAccountInfo(false);
                }
              }}
              loading={isSavingAccountInfo}
              disabled={isSavingAccountInfo}
              style={styles.savePasswordButton}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Location Bottom Sheet */}
      <BottomSheet
        visible={editingSection === 'location'}
        onClose={() => {
          setEditingSection(null);
          setLocationData(parseAddress(user?.address));
        }}
        title="Edit Location"
      >
        <View style={styles.bottomSheetContent}>
          <Input
            label="Address"
            value={locationData.address}
            onChangeText={(text) => setLocationData({ ...locationData, address: text })}
          />
          <Input
            label="City"
            value={locationData.city}
            onChangeText={(text) => setLocationData({ ...locationData, city: text })}
            style={{ marginTop: 16 }}
          />
          <View style={styles.locationRow}>
            <View style={styles.locationRowLeft}>
              <Input
                label="State"
                value={locationData.state}
                onChangeText={(text) => setLocationData({ ...locationData, state: text.toUpperCase() })}
                maxLength={2}
                placeholder="CA"
                style={{ marginTop: 16 }}
              />
            </View>
            <View style={styles.locationRowRight}>
              <Input
                label="Zip Code"
                value={locationData.zipCode}
                onChangeText={(text) => setLocationData({ ...locationData, zipCode: text })}
                keyboardType="numeric"
                maxLength={10}
                placeholder="12345"
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setEditingSection(null);
                setLocationData(parseAddress(user?.address));
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isSavingLocation ? 'Saving...' : 'Save Changes'}
              onPress={async () => {
                setIsSavingLocation(true);
                try {
                  const parts = [
                    locationData.address,
                    locationData.city,
                    locationData.state && locationData.zipCode 
                      ? `${locationData.state} ${locationData.zipCode}`.trim()
                      : locationData.state || locationData.zipCode
                  ].filter(part => part && part.trim().length > 0);
                  
                  const addressString = parts.length > 0 ? parts.join(', ') : '';
                  
                  const updatedProfile = await updateProfile({
                    address: addressString || null,
                  });
                  setUser(updatedProfile);
                  setEditingSection(null);
                  Alert.alert('Success', 'Location updated successfully!');
                } catch (error: any) {
                  console.error('Error updating location:', error);
                  Alert.alert('Error', error.message || 'Failed to update location');
                } finally {
                  setIsSavingLocation(false);
                }
              }}
              loading={isSavingLocation}
              disabled={isSavingLocation}
              style={styles.savePasswordButton}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Bio Bottom Sheet */}
      <BottomSheet
        visible={editingSection === 'bio'}
        onClose={() => {
          setEditingSection(null);
          setBioData(user?.bio || '');
        }}
        title="Edit Bio"
      >
        <View style={styles.bottomSheetContent}>
          <View style={[styles.textArea, isDark && styles.textAreaDark]}>
            <TextInput
              style={[styles.textAreaInput, isDark && styles.textAreaInputDark]}
              value={bioData}
              onChangeText={setBioData}
              placeholder="Tell us about yourself..."
              placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setEditingSection(null);
                setBioData(user?.bio || '');
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isSavingBio ? 'Saving...' : 'Save Changes'}
              onPress={async () => {
                setIsSavingBio(true);
                try {
                  const updatedProfile = await updateProfile({
                    bio: bioData,
                  });
                  setUser(updatedProfile);
                  setEditingSection(null);
                  Alert.alert('Success', 'Bio updated successfully!');
                } catch (error: any) {
                  console.error('Error updating bio:', error);
                  Alert.alert('Error', error.message || 'Failed to update bio');
                } finally {
                  setIsSavingBio(false);
                }
              }}
              loading={isSavingBio}
              disabled={isSavingBio}
              style={styles.savePasswordButton}
            />
          </View>
        </View>
      </BottomSheet>

      {/* Jobs Bottom Sheet */}
      <BottomSheet
        visible={editingSection === 'tasks'}
        onClose={() => {
          setEditingSection(null);
          setTasksData({
            skills: user?.skills || [],
            availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
          });
        }}
        title="Edit Gigs"
      >
        <ScrollView style={styles.bottomSheetContent} contentContainerStyle={{ paddingBottom: 20 }}>
          <Text style={[styles.subsectionTitle, titleStyle]}>Skills</Text>
          <View style={styles.skillsContainer}>
            {availableSkills.map((skill) => (
              <Pressable
                key={skill}
                onPress={() => {
                  const currentSkills = tasksData.skills || [];
                  const isSelected = currentSkills.includes(skill);
                  setTasksData({
                    ...tasksData,
                    skills: isSelected
                      ? currentSkills.filter(s => s !== skill)
                      : [...currentSkills, skill],
                  });
                }}
                style={[
                  styles.skillBubble,
                  (tasksData.skills || []).includes(skill) && styles.skillBubbleSelected,
                  isDark && styles.skillBubbleDark,
                  (tasksData.skills || []).includes(skill) && isDark && styles.skillBubbleSelectedDark,
                ]}
              >
                <Text style={[
                  styles.skillText,
                  (tasksData.skills || []).includes(skill) && styles.skillTextSelected,
                  isDark && styles.skillTextDark,
                ]}>
                  {skill}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setEditingSection(null);
                setTasksData({
                  skills: user?.skills || [],
                  availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
                });
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isSavingTasks ? 'Saving...' : 'Save Changes'}
              onPress={async () => {
                setIsSavingTasks(true);
                try {
                  const updatedProfile = await updateProfile({
                    skills: tasksData.skills,
                  });
                  setUser(updatedProfile);
                  setEditingSection(null);
                  Alert.alert('Success', 'Skills updated successfully!');
                } catch (error: any) {
                  console.error('Error updating skills:', error);
                  Alert.alert('Error', error.message || 'Failed to update skills');
                } finally {
                  setIsSavingTasks(false);
                }
              }}
              loading={isSavingTasks}
              disabled={isSavingTasks}
              style={styles.savePasswordButton}
            />
          </View>
        </ScrollView>
      </BottomSheet>

      {/* Availability Bottom Sheet */}
      <BottomSheet
        visible={editingSection === 'availability'}
        onClose={() => {
          setEditingSection(null);
          setUseSameHours(false);
          setTasksData({
            ...tasksData,
            availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
          });
        }}
        title="Edit Availability"
      >
        <ScrollView style={styles.bottomSheetContent} contentContainerStyle={{ paddingBottom: 20 }}>
          {/* Toggle for same hours */}
          <View style={[styles.sameHoursToggle, isDark && styles.sameHoursToggleDark]}>
            <Text style={[styles.sameHoursLabel, labelStyle]}>Use same hours for all days</Text>
            <Pressable
              onPress={() => {
                const newValue = !useSameHours;
                setUseSameHours(newValue);
                if (newValue) {
                  // When enabling, use the first day's hours as default
                  const firstDay = tasksData.availability.monday;
                  setSameHoursRange({
                    start: firstDay.start,
                    end: firstDay.end,
                  });
                  // Apply to all days immediately
                  const newAvailability = { ...tasksData.availability };
                  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach((day) => {
                    newAvailability[day as keyof typeof newAvailability] = {
                      start: firstDay.start,
                      end: firstDay.end,
                    };
                  });
                  setTasksData({
                    ...tasksData,
                    availability: newAvailability,
                  });
                }
              }}
              style={[
                styles.toggle,
                useSameHours ? styles.toggleEnabled : styles.toggleDisabled,
              ]}
            >
              <View
                style={[
                  styles.pill,
                  useSameHours ? styles.pillEnabled : styles.pillDisabled,
                ]}
              />
            </Pressable>
          </View>

          {useSameHours ? (
            <View style={styles.sameHoursContainer}>
              <Text style={[styles.subsectionTitle, titleStyle, { marginTop: 16 }]}>Time Range</Text>
              <TimeRangePicker
                startValue={sameHoursRange.start}
                endValue={sameHoursRange.end}
                onChange={(start24, end24) => {
                  setSameHoursRange({ start: start24, end: end24 });
                  // Apply to all days
                  const newAvailability = { ...tasksData.availability };
                  ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach((day) => {
                    newAvailability[day as keyof typeof newAvailability] = {
                      start: start24,
                      end: end24,
                    };
                  });
                  setTasksData({
                    ...tasksData,
                    availability: newAvailability,
                  });
                }}
              />
            </View>
          ) : (
            <>
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                const dayData = tasksData.availability[day as keyof typeof tasksData.availability];
                return (
                  <View key={day} style={styles.availabilityRow}>
                    <Text style={[styles.dayLabel, textStyle]}>{dayName}</Text>
                    <TimeRangePicker
                      startValue={dayData.start}
                      endValue={dayData.end}
                      onChange={(start24, end24) => {
                        setTasksData({
                          ...tasksData,
                          availability: {
                            ...tasksData.availability,
                            [day]: {
                              start: start24,
                              end: end24,
                            },
                          },
                        });
                      }}
                    />
                  </View>
                );
              })}
            </>
          )}

          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setEditingSection(null);
                setUseSameHours(false);
                setTasksData({
                  ...tasksData,
                  availability: (user?.availability as typeof defaultAvailability) || defaultAvailability,
                });
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isSavingAvailability ? 'Saving...' : 'Save Changes'}
              onPress={async () => {
                setIsSavingAvailability(true);
                try {
                  const updatedProfile = await updateProfile({
                    availability: tasksData.availability,
                  });
                  setUser(updatedProfile);
                  setEditingSection(null);
                  Alert.alert('Success', 'Availability updated successfully!');
                } catch (error: any) {
                  console.error('Error updating availability:', error);
                  Alert.alert('Error', error.message || 'Failed to update availability');
                } finally {
                  setIsSavingAvailability(false);
                }
              }}
              loading={isSavingAvailability}
              disabled={isSavingAvailability}
              style={styles.savePasswordButton}
            />
          </View>
        </ScrollView>
      </BottomSheet>
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
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 0,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  profileHeaderLightGreen: {
    backgroundColor: '#F0F9E8',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  profileHeaderLightGreenDark: {
    backgroundColor: '#1F3A1F',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#73af17',
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#73af17',
  },
  photoPlaceholderDark: {
    backgroundColor: '#374151',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#73af17',
  },
  photoButtonTextDark: {
    color: '#73af17',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  email: {
    fontSize: 14,
    marginBottom: 12,
    color: '#6B7280',
  },
  textDark: {
    color: '#9CA3AF',
  },
  textLight: {
    color: '#6B7280',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    lineHeight: 20,
    paddingTop: 2,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  cancelButtonTextDark: {
    color: '#9CA3AF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  infoRowNoMargin: {
    marginBottom: 0,
    marginTop: -16,
    paddingLeft: 32,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoLabelBold: {
    fontWeight: 'bold',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  labelLight: {
    color: '#000000',
  },
  infoValue: {
    fontSize: 16,
  },
  textAreaContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
  textAreaDark: {
    backgroundColor: '#111111',
    borderColor: '#1F2937',
  },
  textAreaInput: {
    fontSize: 16,
    color: '#000000',
  },
  textAreaInputDark: {
    color: '#FFFFFF',
  },
  skillsSection: {
    marginBottom: 16,
  },
  skillsHint: {
    fontSize: 12,
    marginBottom: 8,
    color: '#6B7280',
  },
  skillsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  skillTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillTagDark: {
    backgroundColor: '#1E3A8A',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#93C5FD',
  },
  uploadingText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  locationRowLeft: {
    flex: 1,
  },
  locationRowRight: {
    flex: 1,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  skillBubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  skillBubbleDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
  },
  skillBubbleSelected: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillBubbleSelectedDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillBubbleDisplay: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  skillTextDark: {
    color: '#D1D5DB',
  },
  skillTextSelected: {
    color: '#FFFFFF',
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: 16,
    minWidth: 100,
  },
  availabilityDayFixed: {
    width: 105,
    flexShrink: 0,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  timeSeparator: {
    fontSize: 16,
    marginHorizontal: 4,
  },
  bottomSheetContent: {
    paddingBottom: 20,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    justifyContent: 'space-between',
  },
  cancelPasswordButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPasswordButtonDark: {
    borderColor: '#4B5563',
  },
  cancelPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  cancelPasswordTextDark: {
    color: '#9CA3AF',
  },
  savePasswordButton: {
    flex: 1,
  },
  sameHoursToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 16,
  },
  sameHoursToggleDark: {
    borderBottomColor: '#374151',
  },
  sameHoursLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  toggleEnabled: {
    backgroundColor: '#73af17',
  },
  toggleDisabled: {
    backgroundColor: '#D1D5DB',
  },
  pill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  pillEnabled: {
    alignSelf: 'flex-end',
  },
  pillDisabled: {
    alignSelf: 'flex-start',
  },
  sameHoursContainer: {
    marginTop: 8,
  },
});
