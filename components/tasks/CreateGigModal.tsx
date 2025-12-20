import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, Image, Pressable, Modal, Platform, Dimensions } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCreateTask, useUpdateTask, useTask } from '@/hooks/useTasks';
import { Task } from '@/types';
import { normalizeAddress } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TimeRangePicker } from '@/components/ui/TimeRangePicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';

const COMMON_SKILLS = [
  'Yard Work',
  'Pet Care',
  'Babysitting',
  'Tutoring',
  'Cleaning',
  'Moving',
  'Tech Help',
  'Cooking',
  'Delivery',
  'Other',
];

const createTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  pay: z.number().min(0.01, 'Pay must be greater than 0'),
  address: z.string().min(5, 'Please enter a valid address'),
  estimated_hours: z.number().min(0.5).optional(),
  required_skills: z.array(z.string()).min(1, 'At least one skill is required'),
  scheduled_date: z.date().optional(),
  scheduled_start_time: z.string().optional(),
  scheduled_end_time: z.string().optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskSchema> & {
  location?: { latitude: number; longitude: number };
  photos?: string[];
};

interface CreateGigModalProps {
  visible: boolean;
  onClose: () => void;
  taskId?: string | null; // If provided, we're in edit mode
}

export function CreateGigModal({ visible, onClose, taskId }: CreateGigModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const isEditMode = !!taskId;
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const { data: existingTask } = useTask(taskId || '');
  const queryClient = useQueryClient();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [payDisplayValue, setPayDisplayValue] = useState('');
  const [hoursDisplayValue, setHoursDisplayValue] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('');
  const [scheduledEndTime, setScheduledEndTime] = useState<string>('');
  const [showSkillsModal, setShowSkillsModal] = useState(false);

  const { control, handleSubmit, formState: { errors }, setValue, reset, watch } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      pay: 0,
      address: '',
      estimated_hours: undefined,
      required_skills: [],
      scheduled_date: undefined,
      scheduled_start_time: undefined,
      scheduled_end_time: undefined,
    },
  });

  const selectedSkills = watch('required_skills') || [];

  // Reset or populate form when modal opens
  useEffect(() => {
    if (visible) {
      if (isEditMode && existingTask) {
        // Pre-populate form with existing task data
        setValue('title', existingTask.title);
        setValue('description', existingTask.description);
        setValue('pay', parseFloat(existingTask.pay.toString()));
        setPayDisplayValue(existingTask.pay.toString());
        setValue('address', existingTask.address);
        setValue('estimated_hours', existingTask.estimated_hours);
        setHoursDisplayValue(existingTask.estimated_hours ? existingTask.estimated_hours.toString() : '');
        setValue('required_skills', existingTask.required_skills || []);
        setLocation(existingTask.location as { latitude: number; longitude: number });
        setPhotos(existingTask.photos || []);
        
        if (existingTask.scheduled_date) {
          const date = new Date(existingTask.scheduled_date);
          setScheduledDate(date);
          setValue('scheduled_date', date);
        } else {
          setScheduledDate(null);
          setValue('scheduled_date', undefined);
        }
        
        setScheduledStartTime(existingTask.scheduled_start_time || '');
        setScheduledEndTime(existingTask.scheduled_end_time || '');
        setValue('scheduled_start_time', existingTask.scheduled_start_time || undefined);
        setValue('scheduled_end_time', existingTask.scheduled_end_time || undefined);
      } else {
        // Reset form for create mode
        reset();
        setPayDisplayValue('');
        setHoursDisplayValue('');
        setScheduledDate(null);
        setScheduledStartTime('');
        setScheduledEndTime('');
        setLocation(null);
        setPhotos([]);
      }
    }
  }, [visible, isEditMode, existingTask, setValue, reset]);

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to create a gig.');
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      const loc = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(loc);
      setValue('location', loc);

      // Reverse geocode to get address
      const [address] = await Location.reverseGeocodeAsync(loc);
      if (address) {
        // Format address with proper commas: "Street, City, State Zip"
        // Combine street number and street name if available
        const streetNumber = address.streetNumber || address.subThoroughfare || '';
        const streetName = address.street || address.thoroughfare || '';
        const street = streetNumber && streetName 
          ? `${streetNumber} ${streetName}`.trim()
          : streetName || streetNumber || '';
        
        const city = address.city || address.locality || '';
        const state = address.region || address.administrativeArea || '';
        const zip = address.postalCode || '';
        
        let addressString = '';
        
        // If we have a formatted name, use it (but still normalize)
        if (address.name && !street) {
          addressString = normalizeAddress(address.name);
        } else if (street && city && state) {
          addressString = `${street}, ${city}, ${state} ${zip}`.trim();
        } else if (street && city) {
          addressString = `${street}, ${city} ${state} ${zip}`.trim();
        } else if (city && state) {
          // If no street, use city and state
          addressString = `${city}, ${state} ${zip}`.trim();
        } else {
          // Fallback: construct from available parts
          const parts = [street, city, state, zip].filter(p => p).join(' ');
          addressString = normalizeAddress(parts) || address.name || '';
        }
        
        setValue('address', addressString);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to get location');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library permission is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos([...photos, result.assets[0].uri]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CreateTaskFormData) => {
    if (!location) {
      Alert.alert('Location Required', 'Please get your current location first.');
      return;
    }

    // Check if editing and task is in a state that can't be edited
    if (isEditMode && existingTask) {
      if (['accepted', 'in_progress'].includes(existingTask.status)) {
        Alert.alert('Cannot Edit', 'This gig cannot be edited because it has been accepted or is in progress.');
        return;
      }
    }

    try {
      if (isEditMode && taskId) {
        // Update existing task
        await updateTaskMutation.mutateAsync({
          taskId,
          data: {
            title: data.title,
            description: data.description,
            pay: data.pay,
            location,
            address: normalizeAddress(data.address),
            estimated_hours: data.estimated_hours,
            required_skills: data.required_skills,
            photos: photos.length > 0 ? photos : undefined,
            scheduled_date: scheduledDate ? scheduledDate.toISOString().split('T')[0] : undefined,
            scheduled_start_time: scheduledStartTime || undefined,
            scheduled_end_time: scheduledEndTime || undefined,
          },
        });

        Alert.alert('Success', 'Gig updated successfully!', [
          { text: 'OK', onPress: onClose }
        ]);
      } else {
        // Create new task
        await createTaskMutation.mutateAsync({
          title: data.title,
          description: data.description,
          pay: data.pay,
          location,
          address: normalizeAddress(data.address),
          estimated_hours: data.estimated_hours,
          required_skills: data.required_skills,
          photos: photos.length > 0 ? photos : undefined,
          scheduled_date: scheduledDate ? scheduledDate.toISOString().split('T')[0] : undefined,
          scheduled_start_time: scheduledStartTime || undefined,
          scheduled_end_time: scheduledEndTime || undefined,
        });

        // Reset form and close modal
        reset();
        setLocation(null);
        setPhotos([]);
        setPayDisplayValue('');
        setHoursDisplayValue('');
        setScheduledDate(null);
        setScheduledStartTime('');
        setScheduledEndTime('');
        
        Alert.alert('Success', 'Gig created successfully!', [
          { text: 'OK', onPress: onClose }
        ]);
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to ${isEditMode ? 'update' : 'create'} task`);
    }
  };

  const handleClose = () => {
    reset();
    setLocation(null);
    setPhotos([]);
    setPayDisplayValue('');
    setHoursDisplayValue('');
    setScheduledDate(null);
    setScheduledStartTime('');
    setScheduledEndTime('');
    onClose();
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const modalStyle = isDark ? styles.modalDark : styles.modalLight;
  const headerStyle = isDark ? styles.modalHeaderDark : styles.modalHeaderLight;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.overlayPressable} onPress={handleClose} />
        <View style={[styles.modalContent, modalStyle]}>
          <View style={[styles.modalHeader, headerStyle]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, titleStyle]}>
                {isEditMode ? 'Edit Gig' : 'Create New Gig'}
              </Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, subtitleStyle]}>
              {isEditMode ? 'Update your gig details' : 'Post a gig for teens in your neighborhood'}
            </Text>
          </View>

          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Gig Title"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.title?.message}
                  required
                  placeholder="e.g., Mow the lawn"
                />
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <View style={styles.textAreaContainer}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    Description <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={[styles.textArea, isDark && styles.textAreaDark]}>
                    <TextInput
                      style={[styles.textAreaInput, isDark && styles.textAreaInputDark]}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Describe the gig in detail..."
                      placeholderTextColor={isDark ? '#9CA3AF' : '#9CA3AF'}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                  </View>
                  {errors.description && (
                    <Text style={styles.errorText}>{errors.description.message}</Text>
                  )}
                </View>
              )}
            />

            {/* Required Skills */}
            <View style={styles.skillsSection}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                Required Skills <Text style={styles.required}>*</Text>
              </Text>
              <Pressable
                style={[styles.skillsButton, isDark && styles.skillsButtonDark]}
                onPress={() => setShowSkillsModal(true)}
              >
                <Text style={[styles.skillsButtonText, isDark && styles.skillsButtonTextDark]}>
                  {selectedSkills.length > 0 
                    ? `${selectedSkills.length} skill${selectedSkills.length > 1 ? 's' : ''} selected`
                    : 'Select skills'}
                </Text>
                <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
              </Pressable>
              {selectedSkills.length > 0 && (
                <View style={styles.selectedSkillsContainer}>
                  {selectedSkills.map((skill, index) => (
                    <View key={index} style={[styles.skillChip, isDark && styles.skillChipDark]}>
                      <Text style={[styles.skillChipText, isDark && styles.skillChipTextDark]}>
                        {skill}
                      </Text>
                      <Pressable
                        onPress={() => {
                          const newSkills = selectedSkills.filter((_, i) => i !== index);
                          setValue('required_skills', newSkills);
                        }}
                        style={styles.removeSkillButton}
                      >
                        <Ionicons name="close-circle" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {errors.required_skills && (
                <Text style={styles.errorText}>{errors.required_skills.message}</Text>
              )}
            </View>

            <Controller
              control={control}
              name="pay"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Pay Amount ($)"
                  value={payDisplayValue || (value > 0 ? value.toString() : '')}
                  onChangeText={(text) => {
                    // Allow empty string or valid number input
                    if (text === '' || text === '.') {
                      setPayDisplayValue(text);
                      onChange(0);
                    } else if (/^\d*\.?\d*$/.test(text)) {
                      setPayDisplayValue(text);
                      const num = parseFloat(text);
                      if (!isNaN(num)) {
                        onChange(num);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure we have a valid number on blur
                    const num = parseFloat(payDisplayValue);
                    if (isNaN(num) || num <= 0) {
                      setPayDisplayValue('');
                      onChange(0);
                    } else {
                      setPayDisplayValue(num.toString());
                      onChange(num);
                    }
                    onBlur();
                  }}
                  error={errors.pay?.message}
                  required
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                />
              )}
            />

            <Controller
              control={control}
              name="estimated_hours"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Estimated Hours (optional)"
                  value={hoursDisplayValue || (value ? value.toString() : '')}
                  onChangeText={(text) => {
                    // Allow empty string, decimal point, or valid number input
                    if (text === '' || text === '.' || /^\d*\.?\d*$/.test(text)) {
                      setHoursDisplayValue(text);
                      if (text === '' || text === '.') {
                        onChange(undefined);
                      } else {
                        const num = parseFloat(text);
                        if (!isNaN(num)) {
                          onChange(num);
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure we have a valid number on blur, or clear if invalid
                    if (hoursDisplayValue === '' || hoursDisplayValue === '.') {
                      setHoursDisplayValue('');
                      onChange(undefined);
                    } else {
                      const num = parseFloat(hoursDisplayValue);
                      if (isNaN(num) || num <= 0) {
                        setHoursDisplayValue('');
                        onChange(undefined);
                      } else {
                        setHoursDisplayValue(num.toString());
                        onChange(num);
                      }
                    }
                    onBlur();
                  }}
                  error={errors.estimated_hours?.message}
                  keyboardType="decimal-pad"
                  placeholder="2.5"
                />
              )}
            />

            <View style={styles.schedulingSection}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                Scheduling (optional)
              </Text>
              
              <View style={styles.datePickerContainer}>
                <Text style={[styles.sublabel, isDark && styles.sublabelDark]}>Date</Text>
                {Platform.OS === 'android' && (
                  <Pressable
                    style={[styles.dateButton, isDark && styles.dateButtonDark]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.dateButtonText, isDark && styles.dateButtonTextDark]}>
                      {scheduledDate ? scheduledDate.toLocaleDateString() : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>
                )}
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={[styles.dateButton, isDark && styles.dateButtonDark]}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={[styles.dateButtonText, isDark && styles.dateButtonTextDark]}>
                      {scheduledDate ? scheduledDate.toLocaleDateString() : 'Select Date'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </Pressable>
                )}
                {Platform.OS === 'ios' && showDatePicker && (
                  <Modal
                    visible={showDatePicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                  >
                    <Pressable 
                      style={styles.modalOverlay} 
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={[styles.datePickerModal, isDark && styles.datePickerModalDark]}>
                          <View style={[styles.datePickerModalHeader, isDark && styles.datePickerModalHeaderDark]}>
                            <Pressable onPress={() => setShowDatePicker(false)}>
                              <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
                            </Pressable>
                            <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Select Date</Text>
                            <Pressable
                              onPress={() => {
                                if (scheduledDate) {
                                  setValue('scheduled_date', scheduledDate);
                                }
                                setShowDatePicker(false);
                              }}
                            >
                              <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                          </View>
                          <DateTimePicker
                            value={scheduledDate || new Date()}
                            mode="date"
                            display="spinner"
                            onChange={(event, selectedDate) => {
                              if (selectedDate) {
                                setScheduledDate(selectedDate);
                              }
                            }}
                            minimumDate={new Date()}
                            textColor={isDark ? '#FFFFFF' : '#000000'}
                          />
                        </View>
                      </Pressable>
                    </Pressable>
                  </Modal>
                )}
                {Platform.OS === 'android' && showDatePicker && (
                  <DateTimePicker
                    value={scheduledDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setScheduledDate(selectedDate);
                        setValue('scheduled_date', selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              {scheduledDate && (
                <View style={styles.timePickerContainer}>
                  <Text style={[styles.sublabel, isDark && styles.sublabelDark]}>Time Range</Text>
                  <TimeRangePicker
                    startValue={scheduledStartTime}
                    endValue={scheduledEndTime}
                    onChange={(start, end) => {
                      setScheduledStartTime(start);
                      setScheduledEndTime(end);
                      setValue('scheduled_start_time', start);
                      setValue('scheduled_end_time', end);
                    }}
                  />
                </View>
              )}
            </View>

            <View style={styles.locationSection}>
              <Text style={[styles.label, isDark && styles.labelDark]}>
                Location <Text style={styles.required}>*</Text>
              </Text>
              <Button
                title={location ? "Update Location" : "Get Current Location"}
                onPress={getCurrentLocation}
                loading={isGettingLocation}
                variant="primary"
              />
              {location && (
                <Text style={[styles.locationText, subtitleStyle]}>
                  Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              )}
            </View>

            <Controller
              control={control}
              name="address"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.address?.message}
                  required
                  placeholder="123 Main St, City, State"
                />
              )}
            />

            <View style={styles.photosSection}>
              <Text style={[styles.label, isDark && styles.labelDark]}>Photos (optional)</Text>
              <View style={styles.photoButtons}>
                <Pressable
                  style={[styles.photoButton, isDark && styles.photoButtonDark]}
                  onPress={pickImage}
                >
                  <Text style={styles.photoButtonText}>Pick from Library</Text>
                </Pressable>
                <Pressable
                  style={[styles.photoButton, isDark && styles.photoButtonDark]}
                  onPress={takePhoto}
                >
                  <Text style={styles.photoButtonText}>Take Photo</Text>
                </Pressable>
              </View>
              {photos.length > 0 && (
                <View style={styles.photosGrid}>
                  {photos.map((uri, index) => (
                    <View key={index} style={styles.photoContainer}>
                      <Image source={{ uri }} style={styles.photo} />
                      <Pressable
                        style={styles.removePhotoButton}
                        onPress={() => removePhoto(index)}
                      >
                        <Ionicons name="close-circle" size={24} color="#DC2626" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Button
              title={isEditMode ? "Update Gig" : "Create Gig"}
              onPress={handleSubmit(onSubmit)}
              loading={isEditMode ? updateTaskMutation.isPending : createTaskMutation.isPending}
              disabled={(isEditMode ? updateTaskMutation.isPending : createTaskMutation.isPending) || !location || selectedSkills.length === 0}
              fullWidth
            />
          </ScrollView>
        </View>
      </View>

      {/* Skills Selection Bottom Modal */}
      <BottomSheet
        visible={showSkillsModal}
        onClose={() => setShowSkillsModal(false)}
        title="Select Required Skills"
      >
        <View style={styles.skillsModalContent}>
          <Text style={[styles.skillsModalDescription, isDark && styles.skillsModalDescriptionDark]}>
            Select at least one skill required for this gig
          </Text>
          <View style={styles.skillsGrid}>
            {COMMON_SKILLS.map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <Pressable
                  key={skill}
                  style={[
                    styles.skillOptionChip,
                    isSelected && styles.skillOptionChipSelected,
                    isDark && styles.skillOptionChipDark,
                    isSelected && isDark && styles.skillOptionChipSelectedDark,
                  ]}
                  onPress={() => {
                    const newSkills = isSelected
                      ? selectedSkills.filter(s => s !== skill)
                      : [...selectedSkills, skill];
                    setValue('required_skills', newSkills);
                  }}
                >
                  <Text
                    style={[
                      styles.skillOptionText,
                      isSelected && styles.skillOptionTextSelected,
                      isDark && !isSelected && styles.skillOptionTextDark,
                    ]}
                  >
                    {skill}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#73af17" />
                  )}
                </Pressable>
              );
            })}
          </View>
          <Button
            title="Done"
            onPress={() => {
              if (selectedSkills.length === 0) {
                Alert.alert('Skills Required', 'Please select at least one skill');
                return;
              }
              setShowSkillsModal(false);
            }}
            fullWidth
          />
        </View>
      </BottomSheet>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Dimensions.get('window').height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalDark: {
    backgroundColor: '#000000',
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLight: {
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  labelDark: {
    color: '#D1D5DB',
  },
  required: {
    color: '#DC2626',
  },
  textAreaContainer: {
    marginBottom: 16,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    minHeight: 100,
  },
  textAreaDark: {
    backgroundColor: '#000000',
    borderColor: '#4B5563',
  },
  textAreaInput: {
    fontSize: 16,
    color: '#000000',
  },
  textAreaInputDark: {
    color: '#FFFFFF',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  schedulingSection: {
    marginBottom: 16,
  },
  datePickerContainer: {
    marginBottom: 16,
  },
  sublabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  sublabelDark: {
    color: '#D1D5DB',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  dateButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  dateButtonTextDark: {
    color: '#FFFFFF',
  },
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerModalDark: {
    backgroundColor: '#111111',
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalHeaderDark: {
    borderBottomColor: '#374151',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  cancelTextDark: {
    color: '#9CA3AF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
  },
  timePickerContainer: {
    marginTop: 8,
  },
  locationSection: {
    marginBottom: 16,
  },
  locationText: {
    fontSize: 12,
    marginTop: 8,
  },
  photosSection: {
    marginBottom: 24,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'center',
  },
  photoButton: {
    backgroundColor: '#73af17',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    maxWidth: '48%',
  },
  photoButtonDark: {
    backgroundColor: '#73af17',
  },
  photoButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  skillsSection: {
    marginBottom: 16,
  },
  skillsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  skillsButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
  },
  skillsButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  skillsButtonTextDark: {
    color: '#FFFFFF',
  },
  selectedSkillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillChipDark: {
    backgroundColor: '#1E3A8A',
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillChipTextDark: {
    color: '#93C5FD',
  },
  removeSkillButton: {
    marginLeft: 2,
  },
  skillsModalContent: {
    gap: 16,
  },
  skillsModalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  skillsModalDescriptionDark: {
    color: '#9CA3AF',
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  skillOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    minWidth: '45%',
  },
  skillOptionChipSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#73af17',
    borderWidth: 2,
  },
  skillOptionChipDark: {
    backgroundColor: '#1F2937',
    borderColor: '#4B5563',
  },
  skillOptionChipSelectedDark: {
    backgroundColor: '#1F2937',
    borderColor: '#73af17',
  },
  skillOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  skillOptionTextSelected: {
    color: '#73af17',
  },
  skillOptionTextDark: {
    color: '#D1D5DB',
  },
});





