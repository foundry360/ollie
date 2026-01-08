import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Image, Pressable, Modal, Platform, Dimensions, StatusBar } from 'react-native';
import { Alert } from '@/components/ui/Alert';
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
import { getTeenlancers, TeenlancerProfile } from '@/lib/api/users';
import { TeenlancerCard } from '@/components/teenlancers/TeenlancerCard';
import { getUserTasks } from '@/lib/api/tasks';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { ProfileModal } from '@/components/profile/ProfileModal';

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
  teen_id: z.string().optional(), // Optional teenlancer selection
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
  const { user } = useAuthStore();
  const isDark = colorScheme === 'dark';
  const isEditMode = !!taskId;
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const { data: existingTask } = useTask(taskId || '');
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [selectedTeenlancer, setSelectedTeenlancer] = useState<TeenlancerProfile | null>(null);
  const [showTeenlancerPicker, setShowTeenlancerPicker] = useState(false);
  const [teenlancers, setTeenlancers] = useState<TeenlancerProfile[]>([]);
  const [isLoadingTeenlancers, setIsLoadingTeenlancers] = useState(false);
  const [postToMarketplace, setPostToMarketplace] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const hasClearedTeenlancerRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const [previousGigLocation, setPreviousGigLocation] = useState<{
    location: { latitude: number; longitude: number };
    address: string;
  } | null>(null);
  const [usePreviousLocation, setUsePreviousLocation] = useState(false);

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

  // Load previous gig location when step 2 is reached
  useEffect(() => {
    if (currentStep === 2 && !previousGigLocation && !isEditMode && visible) {
      const loadPreviousGigLocation = async () => {
        if (!user) return;
        try {
          const previousGigs = await getUserTasks({ role: 'poster' });
          if (previousGigs && previousGigs.length > 0) {
            const mostRecentGig = previousGigs[0];
            if (mostRecentGig.location && mostRecentGig.address) {
              const gigLocation = mostRecentGig.location as { latitude: number; longitude: number };
              if (gigLocation.latitude && gigLocation.longitude) {
                setPreviousGigLocation({
                  location: gigLocation,
                  address: mostRecentGig.address,
                });
              }
            }
          }
        } catch (error) {
          console.log('Could not load previous gig location:', error);
        }
      };
      loadPreviousGigLocation();
    }
  }, [currentStep, isEditMode, visible, user]);

  // Load teenlancers when picker is opened or step 3 is reached
  useEffect(() => {
    if (showTeenlancerPicker && teenlancers.length === 0) {
      loadTeenlancers();
    }
  }, [showTeenlancerPicker]);

  // Load teenlancers when step 4 is reached
  useEffect(() => {
    if (currentStep === 4 && !isEditMode && teenlancers.length === 0) {
      loadTeenlancers();
    }
  }, [currentStep, isEditMode]);

  const loadTeenlancers = async () => {
    setIsLoadingTeenlancers(true);
    try {
      const list = await getTeenlancers();
      setTeenlancers(list);
      return list;
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load teenlancers');
      return [];
    } finally {
      setIsLoadingTeenlancers(false);
    }
  };

  const handleSelectTeenlancer = (teenlancer: TeenlancerProfile, isStep4: boolean = false) => {
    // Toggle selection: if already selected, deselect; otherwise select
    if (selectedTeenlancer?.id === teenlancer.id) {
      setSelectedTeenlancer(null);
      setValue('teen_id', undefined);
    } else {
      setSelectedTeenlancer(teenlancer);
      setValue('teen_id', teenlancer.id);
      hasClearedTeenlancerRef.current = false; // Reset flag when selecting a teenlancer
    }
    // Only close picker if it's open (for edit mode modal picker), not for Step 4
    if (showTeenlancerPicker && !isStep4) {
      setShowTeenlancerPicker(false);
    }
  };

  const handleSelectTeenlancerFromProfile = (userId: string) => {
    const teenlancer = teenlancers.find(t => t.id === userId);
    if (teenlancer) {
      handleSelectTeenlancer(teenlancer, false);
      setShowProfileModal(false);
      setProfileModalUserId(null);
    }
  };

  const handleClearTeenlancer = () => {
    hasClearedTeenlancerRef.current = true;
    setSelectedTeenlancer(null);
    setValue('teen_id', undefined);
  };

  // Step navigation functions
  const handleNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as 1 | 2 | 3 | 4);
    }
  };

  // Step validation
  const validateStep1 = async (): Promise<boolean> => {
    const values = watch();
    if (!values.title || values.title.length < 3) {
      Alert.alert('Validation Error', 'Title must be at least 3 characters');
      return false;
    }
    if (!values.description || values.description.length < 10) {
      Alert.alert('Validation Error', 'Description must be at least 10 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = async (): Promise<boolean> => {
    const values = watch();
    if (!selectedSkills || selectedSkills.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one skill');
      return false;
    }
    if (!values.pay || values.pay <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid pay amount');
      return false;
    }
    return true;
  };

  const validateStep3 = async (): Promise<boolean> => {
    if (usePreviousLocation && previousGigLocation) {
      setLocation(previousGigLocation.location);
      setValue('location', previousGigLocation.location);
      setValue('address', previousGigLocation.address);
      return true;
    }
    if (!location) {
      Alert.alert('Validation Error', 'Please get your location first');
      return false;
    }
    const address = watch('address');
    if (!address || address.length < 5) {
      Alert.alert('Validation Error', 'Please enter a valid address');
      return false;
    }
    return true;
  };

  const handleStepNext = async () => {
    if (currentStep === 1) {
      const isValid = await validateStep1();
      if (isValid) {
        handleNextStep();
      }
    } else if (currentStep === 2) {
      const isValid = await validateStep2();
      if (isValid) {
        handleNextStep();
      }
    } else if (currentStep === 3) {
      const isValid = await validateStep3();
      if (isValid) {
        handleNextStep();
      }
    }
  };

  // Reset or populate form when modal opens
  useEffect(() => {
    if (visible && !initialLoadDoneRef.current) {
      if (isEditMode && existingTask) {
        initialLoadDoneRef.current = true;
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
        
        // Load teenlancer if assigned
        if (existingTask.teen_id) {
          setValue('teen_id', existingTask.teen_id);
          // Load teenlancer profile
          loadTeenlancers().then((list) => {
            // Only set if user hasn't cleared it
            if (!hasClearedTeenlancerRef.current) {
              const teen = list.find(t => t.id === existingTask.teen_id);
              if (teen) {
                setSelectedTeenlancer(teen);
              }
            }
          });
        } else {
          setSelectedTeenlancer(null);
          setValue('teen_id', undefined);
        }
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
        setSelectedTeenlancer(null);
        setValue('teen_id', undefined);
        setCurrentStep(1);
        setUsePreviousLocation(false);
        setPreviousGigLocation(null);
        hasClearedTeenlancerRef.current = false;
        initialLoadDoneRef.current = false;
      }
    } else {
      // Reset flags when modal closes
      hasClearedTeenlancerRef.current = false;
      initialLoadDoneRef.current = false;
    }
  }, [visible, isEditMode, existingTask?.id, setValue, reset]); // Only depend on task ID, not the whole task object

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
        // If no teen_id is set, it will post to marketplace (teen_id = null)
        // API expects null (not undefined) to unassign the teenlancer
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
            teen_id: selectedTeenlancer?.id ?? null, // Use selectedTeenlancer state - if null, posts to marketplace (API requires null, not undefined)
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
          teen_id: data.teen_id, // Include teen_id if selected
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
        setSelectedTeenlancer(null);
        setValue('teen_id', undefined);
        setCurrentStep(1);
        setUsePreviousLocation(false);
        setPreviousGigLocation(null);
        
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
    setSelectedTeenlancer(null);
    setValue('teen_id', undefined);
    setCurrentStep(1);
    setUsePreviousLocation(false);
    setPreviousGigLocation(null);
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
      <StatusBar barStyle="light-content" />
      <View style={styles.modalOverlay}>
        <Pressable style={styles.overlayPressable} onPress={handleClose} />
        <View style={[styles.modalContent, modalStyle]}>
          <View style={[styles.modalHeader, headerStyle]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, titleStyle]}>
                {isEditMode ? 'Edit Gig' : `Create Gig (Step ${currentStep} of 4)`}
              </Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
            <Text style={[styles.subtitle, subtitleStyle]}>
              {isEditMode 
                ? 'Update your gig details'
                : currentStep === 1 
                  ? 'Enter gig title and description'
                  : currentStep === 2
                    ? 'Set gig details'
                    : currentStep === 3
                      ? 'Set location'
                      : 'Select teenlancer'}
            </Text>
            {/* Step indicator dots */}
            {!isEditMode && (
              <View style={styles.stepIndicator}>
                <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]} />
                <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]} />
                <View style={[styles.stepDot, currentStep >= 3 && styles.stepDotActive]} />
                <View style={[styles.stepDot, currentStep >= 4 && styles.stepDotActive]} />
              </View>
            )}
          </View>

          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={currentStep === 2 && !isEditMode ? styles.scrollContentStep2 : styles.scrollContent}
            showsVerticalScrollIndicator={currentStep !== 2 || isEditMode}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* Step 1: Title and Description */}
            {currentStep === 1 && !isEditMode && (
              <>
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

                <Button
                  title="Next Step"
                  onPress={handleStepNext}
                  fullWidth
                />
              </>
            )}

            {/* Edit Mode: All Fields */}
            {isEditMode && (
              <>
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

                {/* Required Skills for Edit Mode */}
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
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#6B7280'} />
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
                            <Ionicons name="close-circle" size={18} color={isDark ? '#FFFFFF' : '#6B7280'} />
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

                {/* Scheduling */}
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

                {/* Photos with icon buttons */}
                <View style={[styles.photosSection, { marginBottom: 12 }]}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Photos (optional)</Text>
                  <View style={styles.photoIconButtons}>
                    <Pressable
                      style={[styles.photoIconButton, isDark && styles.photoIconButtonDark]}
                      onPress={pickImage}
                    >
                      <Ionicons name="images-outline" size={24} color={isDark ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.photoIconButtonText, isDark && styles.photoIconButtonTextDark]}>Library</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.photoIconButton, isDark && styles.photoIconButtonDark]}
                      onPress={takePhoto}
                    >
                      <Ionicons name="camera-outline" size={24} color={isDark ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.photoIconButtonText, isDark && styles.photoIconButtonTextDark]}>Camera</Text>
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
                            <Ionicons name="close-circle" size={24} color="#F97316" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Location Section for Edit Mode */}
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

                    {/* Teenlancer Selection Section for Edit Mode */}
                    <View style={styles.teenlancerSection}>
                  <Text style={[styles.teenlancerHint, isDark && styles.teenlancerHintDark, { marginBottom: 12 }]}>
                    Leave blank to post in marketplace
                  </Text>
                      {selectedTeenlancer ? (
                        <View style={[styles.selectedTeenlancer, isDark && styles.selectedTeenlancerDark]}>
                          <View style={styles.selectedTeenlancerInfo}>
                            {selectedTeenlancer.profile_photo_url && (
                              <Image 
                                source={{ uri: selectedTeenlancer.profile_photo_url }} 
                                style={styles.teenlancerPhoto}
                              />
                            )}
                            {!selectedTeenlancer.profile_photo_url && (
                              <View style={[styles.teenlancerPhotoPlaceholder, isDark && styles.teenlancerPhotoPlaceholderDark]}>
                                <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              </View>
                            )}
                            <View style={styles.teenlancerDetails}>
                              <Text style={[styles.teenlancerName, isDark && styles.teenlancerNameDark]}>
                                {selectedTeenlancer.full_name}
                              </Text>
                              {selectedTeenlancer.rating > 0 && (
                                <Text style={[styles.teenlancerRating, subtitleStyle]}>
                                  ⭐ {selectedTeenlancer.rating.toFixed(1)} ({selectedTeenlancer.reviewCount} reviews)
                                </Text>
                              )}
                            </View>
                          </View>
                          <Pressable 
                            onPress={handleClearTeenlancer}
                            style={styles.clearButton}
                          >
                            <Ionicons name="close-circle" size={24} color="#F97316" />
                          </Pressable>
                        </View>
                      ) : (
                        <Pressable
                          style={[styles.selectTeenlancerButton, isDark && styles.selectTeenlancerButtonDark]}
                          onPress={() => setShowTeenlancerPicker(true)}
                        >
                          <Text style={[styles.selectTeenlancerButtonText, isDark && styles.selectTeenlancerButtonTextDark]}>
                            Select Teenlancer
                          </Text>
                          <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#6B7280'} />
                        </Pressable>
                      )}
                    </View>

                <Button
                  title="Update Gig"
                  onPress={handleSubmit(onSubmit)}
                  loading={updateTaskMutation.isPending}
                  disabled={updateTaskMutation.isPending || !location || selectedSkills.length === 0}
                  fullWidth
                />
              </>
            )}

            {/* Step 2: Gig Details (Skills, Pay, Hours, Date, Photos) */}
            {currentStep === 2 && !isEditMode && (
              <>
                {/* Required Skills */}
                <View style={[styles.skillsSection, { marginBottom: 12 }]}>
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
                    <Ionicons name="chevron-forward" size={20} color={isDark ? '#FFFFFF' : '#6B7280'} />
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
                            <Ionicons name="close-circle" size={18} color={isDark ? '#FFFFFF' : '#6B7280'} />
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

                {/* Scheduling */}
                <View style={[styles.schedulingSection, { marginBottom: 12 }]}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    Scheduling (optional)
                  </Text>
                  
                  <View style={[styles.datePickerContainer, { marginBottom: 8 }]}>
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

                {/* Photos with icon buttons */}
                <View style={[styles.photosSection, { marginBottom: 12 }]}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>Photos (optional)</Text>
                  <View style={styles.photoIconButtons}>
                    <Pressable
                      style={[styles.photoIconButton, isDark && styles.photoIconButtonDark]}
                      onPress={pickImage}
                    >
                      <Ionicons name="images-outline" size={24} color={isDark ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.photoIconButtonText, isDark && styles.photoIconButtonTextDark]}>Library</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.photoIconButton, isDark && styles.photoIconButtonDark]}
                      onPress={takePhoto}
                    >
                      <Ionicons name="camera-outline" size={24} color={isDark ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.photoIconButtonText, isDark && styles.photoIconButtonTextDark]}>Camera</Text>
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
                            <Ionicons name="close-circle" size={24} color="#F97316" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                <View style={[styles.stepButtons, { marginTop: 16 }]}>
                  <View style={styles.stepButton}>
                    <View style={[styles.backButton, isDark && styles.backButtonDark]}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButtonPressable,
                          pressed && styles.backButtonPressed
                        ]}
                        onPress={handlePreviousStep}
                      >
                        <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.stepButton}>
                    <Button
                      title="Next Step"
                      onPress={handleStepNext}
                      fullWidth
                    />
                  </View>
                </View>
              </>
            )}

            {/* Step 3: Location */}
            {currentStep === 3 && !isEditMode && (
              <>
                <View style={styles.locationSection}>
                  <Text style={[styles.label, isDark && styles.labelDark]}>
                    Location <Text style={styles.required}>*</Text>
                  </Text>
                  
                  {previousGigLocation && (
                    <View style={styles.previousLocationOption}>
                      <Pressable
                        style={[styles.locationOptionCard, isDark && styles.locationOptionCardDark]}
                        onPress={() => {
                          setUsePreviousLocation(true);
                          setLocation(previousGigLocation.location);
                          setValue('location', previousGigLocation.location);
                          setValue('address', previousGigLocation.address);
                        }}
                      >
                        <View style={styles.locationOptionContent}>
                          <Ionicons name={usePreviousLocation ? "checkmark-circle" : "ellipse-outline"} size={24} color={usePreviousLocation ? '#73af17' : (isDark ? '#6B7280' : '#9CA3AF')} />
                          <View style={styles.locationOptionText}>
                            <Text style={[styles.locationOptionTitle, isDark && styles.locationOptionTitleDark]}>
                              Use previous location
                            </Text>
                            <Text style={[styles.locationOptionAddress, isDark && styles.locationOptionAddressDark]} numberOfLines={2}>
                              {previousGigLocation.address}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>
                  )}

                  {previousGigLocation && (
                    <View style={styles.locationDivider}>
                      <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
                      <Text style={[styles.dividerText, subtitleStyle]}>OR</Text>
                      <View style={[styles.dividerLine, isDark && styles.dividerLineDark]} />
                    </View>
                  )}

                  <View style={styles.newLocationOption}>
                    <Button
                      title={location && !usePreviousLocation ? "Update Location" : "Get Current Location"}
                      onPress={() => {
                        setUsePreviousLocation(false);
                        getCurrentLocation();
                      }}
                      loading={isGettingLocation}
                      variant="primary"
                    />
                    {location && !usePreviousLocation && (
                      <Text style={[styles.locationText, subtitleStyle]}>
                        Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Text>
                    )}
                  </View>
                </View>

                <Controller
                  control={control}
                  name="address"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input
                      label="Address"
                      value={value}
                      onChangeText={(text) => {
                        setUsePreviousLocation(false);
                        onChange(text);
                      }}
                      onBlur={onBlur}
                      error={errors.address?.message}
                      required
                      placeholder="123 Main St, City, State"
                      editable={!usePreviousLocation}
                    />
                  )}
                />

                <View style={styles.stepButtons}>
                  <View style={styles.stepButton}>
                    <View style={[styles.backButton, isDark && styles.backButtonDark]}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButtonPressable,
                          pressed && styles.backButtonPressed
                        ]}
                        onPress={handlePreviousStep}
                      >
                        <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.stepButton}>
                    <Button
                      title="Next Step"
                      onPress={handleStepNext}
                      fullWidth
                    />
                  </View>
                </View>
              </>
            )}

            {/* Step 4: Teenlancer Selection */}
            {currentStep === 4 && !isEditMode && (
              <>
                <View style={styles.teenlancerSection}>
                  {/* Helper text explaining options - only visible when no teenlancer selected */}
                  {!selectedTeenlancer && (
                    <View style={styles.teenlancerOptionsHeader}>
                      <Text style={[styles.teenlancerOptionsTitle, isDark && styles.teenlancerOptionsTitleDark]}>
                        Choose how to assign this gig:
                      </Text>
                      <Text style={[styles.teenlancerOptionsDescription, isDark && styles.teenlancerOptionsDescriptionDark]}>
                        Post to marketplace for all teenlancers to see, or select a specific teenlancer
                      </Text>
                    </View>
                  )}

                  {/* Post to Marketplace Toggle - moved above list */}
                  {!selectedTeenlancer && (
                    <View style={styles.marketplaceToggleContainer}>
                      <Pressable
                        style={[
                          styles.pillToggle,
                          isDark && styles.pillToggleDark,
                          postToMarketplace && styles.pillToggleActive,
                          postToMarketplace && isDark && styles.pillToggleActiveDark
                        ]}
                        onPress={() => {
                          setPostToMarketplace(!postToMarketplace);
                        }}
                      >
                        <Text style={[
                          styles.pillToggleText,
                          isDark && styles.pillToggleTextDark,
                          postToMarketplace && styles.pillToggleTextActive,
                          postToMarketplace && isDark && styles.pillToggleTextActiveDark
                        ]}>
                          Post to marketplace
                        </Text>
                      </Pressable>
                    </View>
                  )}

                  {/* Separator between toggle and list */}
                  {!selectedTeenlancer && !postToMarketplace && (
                    <View style={styles.teenlancerOptionsSeparator}>
                      <View style={[styles.separatorLine, isDark && styles.separatorLineDark]} />
                      <Text style={[styles.separatorText, isDark && styles.separatorTextDark]}>OR</Text>
                      <View style={[styles.separatorLine, isDark && styles.separatorLineDark]} />
                    </View>
                  )}

                  {selectedTeenlancer ? (
                    <View style={[styles.selectedTeenlancer, isDark && styles.selectedTeenlancerDark]}>
                      <View style={styles.selectedTeenlancerInfo}>
                        {selectedTeenlancer.profile_photo_url && (
                          <Image 
                            source={{ uri: selectedTeenlancer.profile_photo_url }} 
                            style={styles.teenlancerPhoto}
                          />
                        )}
                        {!selectedTeenlancer.profile_photo_url && (
                          <View style={[styles.teenlancerPhotoPlaceholder, isDark && styles.teenlancerPhotoPlaceholderDark]}>
                            <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          </View>
                        )}
                        <View style={styles.teenlancerDetails}>
                          <Text style={[styles.teenlancerName, isDark && styles.teenlancerNameDark]}>
                            {selectedTeenlancer.full_name}
                          </Text>
                          {selectedTeenlancer.rating > 0 && (
                            <Text style={[styles.teenlancerRating, subtitleStyle]}>
                              ⭐ {selectedTeenlancer.rating.toFixed(1)} ({selectedTeenlancer.reviewCount} reviews)
                            </Text>
                          )}
                        </View>
                      </View>
                      <Pressable onPress={handleClearTeenlancer} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={24} color="#F97316" />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      {isLoadingTeenlancers ? (
                        <View style={styles.loadingContainer}>
                          <Text style={[styles.loadingText, subtitleStyle]}>Loading teenlancers...</Text>
                        </View>
                      ) : !postToMarketplace && (
                        <ScrollView 
                          style={styles.teenlancerStepList} 
                          contentContainerStyle={styles.teenlancerStepListContent}
                          nestedScrollEnabled={true}
                        >
                          {teenlancers.map((teenlancer) => (
                            <Pressable
                              key={teenlancer.id}
                              style={[styles.teenlancerStepItem, isDark && styles.teenlancerStepItemDark]}
                              onPress={() => {
                                setProfileModalUserId(teenlancer.id);
                                setShowProfileModal(true);
                              }}
                            >
                              <TeenlancerCard
                                teenlancer={teenlancer}
                                onPress={() => {
                                  setProfileModalUserId(teenlancer.id);
                                  setShowProfileModal(true);
                                }}
                              />
                            </Pressable>
                          ))}
                          {teenlancers.length === 0 && (
                            <View style={styles.emptyContainer}>
                              <Text style={[styles.emptyText, subtitleStyle]}>
                                No teenlancers found
                              </Text>
                            </View>
                          )}
                        </ScrollView>
                      )}
                    </>
                  )}
                </View>

                <View style={styles.stepButtons}>
                  <View style={styles.stepButton}>
                    <View style={[styles.backButton, isDark && styles.backButtonDark]}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.backButtonPressable,
                          pressed && styles.backButtonPressed
                        ]}
                        onPress={handlePreviousStep}
                      >
                        <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.stepButton}>
                    <Button
                      title="Create Gig"
                      onPress={handleSubmit(onSubmit)}
                      loading={createTaskMutation.isPending}
                      disabled={createTaskMutation.isPending || !location || selectedSkills.length === 0 || (!selectedTeenlancer && !postToMarketplace)}
                      fullWidth
                    />
                  </View>
                </View>
              </>
            )}
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
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
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

      {/* Profile Modal for selecting teenlancer */}
      {showProfileModal && profileModalUserId && (
        <ProfileModal
          visible={showProfileModal}
          userId={profileModalUserId}
          onClose={() => {
            setShowProfileModal(false);
            setProfileModalUserId(null);
          }}
          onSelect={(teenlancerId) => {
            const teen = teenlancers.find(t => t.id === teenlancerId);
            if (teen) {
              setSelectedTeenlancer(teen);
              setValue('teen_id', teen.id);
              setPostToMarketplace(false); // Clear marketplace checkbox when teenlancer is selected
            }
            setShowProfileModal(false);
            setProfileModalUserId(null);
          }}
          showSelectButton={true}
        />
      )}

      {/* Teenlancer Picker Modal */}
      <Modal
        visible={showTeenlancerPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTeenlancerPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.overlayPressable} 
            onPress={() => setShowTeenlancerPicker(false)} 
          />
          <View style={[styles.modalContent, modalStyle]}>
            <View style={[styles.modalHeader, headerStyle]}>
              <View style={styles.headerRow}>
                <Text style={[styles.title, titleStyle]}>Select Teenlancer</Text>
                <Pressable onPress={() => setShowTeenlancerPicker(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={[styles.subtitle, subtitleStyle]}>
                Choose a teenlancer to assign this gig to
              </Text>
            </View>
            {isLoadingTeenlancers ? (
              <View style={styles.loadingContainer}>
                <Text style={[styles.loadingText, subtitleStyle]}>Loading teenlancers...</Text>
              </View>
            ) : (
              <ScrollView style={styles.teenlancerList} contentContainerStyle={styles.teenlancerListContent}>
                {teenlancers.map((teenlancer) => (
                  <View
                    key={teenlancer.id}
                    style={[styles.teenlancerItem, isDark && styles.teenlancerItemDark]}
                  >
                    <TeenlancerCard
                      teenlancer={teenlancer}
                      // Don't pass onPress so clicking card opens profile modal
                    />
                    <View style={styles.selectButtonContainer}>
                      <Pressable
                        style={[styles.selectButton, isDark && styles.selectButtonDark]}
                        onPress={() => handleSelectTeenlancer(teenlancer)}
                      >
                        <Text style={styles.selectButtonText}>Select</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {teenlancers.length === 0 && (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, subtitleStyle]}>
                      No teenlancers found
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
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
    overflow: 'hidden',
  },
  modalDark: {
    backgroundColor: '#111827',
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    backgroundColor: '#73af17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeaderLight: {
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#73af17',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
    backgroundColor: '#73af17',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  titleLight: {
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  subtitleDark: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  scrollContentStep2: {
    padding: 16,
    flexGrow: 1,
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
    backgroundColor: '#111827',
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
    backgroundColor: '#111827',
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
    backgroundColor: '#111827',
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillChipTextDark: {
    color: '#FFFFFF',
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
    backgroundColor: '#73af17',
    borderColor: '#73af17',
    borderWidth: 2,
  },
  skillOptionChipDark: {
    backgroundColor: '#1F2937',
    borderColor: '#4B5563',
  },
  skillOptionChipSelectedDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    flex: 1,
  },
  skillOptionTextSelected: {
    color: '#FFFFFF',
  },
  skillOptionTextDark: {
    color: '#D1D5DB',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
  },
  stepButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  stepButton: {
    flex: 1,
  },
  backButton: {
    borderRadius: 8,
    minHeight: 48,
    minWidth: 120,
    width: '100%',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonDark: {
    borderColor: '#6B7280',
  },
  backButtonPressable: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonText: {
    fontWeight: '600',
    fontSize: 16,
    color: '#111827',
    textAlign: 'center',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  previousLocationOption: {
    marginBottom: 16,
  },
  locationOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  locationOptionCardDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
  },
  locationOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  locationOptionText: {
    flex: 1,
  },
  locationOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  locationOptionTitleDark: {
    color: '#FFFFFF',
  },
  locationOptionAddress: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationOptionAddressDark: {
    color: '#9CA3AF',
  },
  locationDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerLineDark: {
    backgroundColor: '#4B5563',
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  newLocationOption: {
    marginBottom: 16,
  },
  photoIconButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    justifyContent: 'flex-start',
  },
  photoIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  photoIconButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: '#1F2937',
  },
  photoIconButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  photoIconButtonTextDark: {
    color: '#FFFFFF',
  },
  teenlancerSection: {
    marginBottom: 16,
  },
  selectedTeenlancer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
  },
  selectedTeenlancerDark: {
    backgroundColor: '#1F2937',
    borderColor: '#4B5563',
  },
  selectedTeenlancerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  teenlancerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  teenlancerPhotoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teenlancerPhotoPlaceholderDark: {
    backgroundColor: '#374151',
  },
  teenlancerDetails: {
    flex: 1,
  },
  teenlancerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  teenlancerNameDark: {
    color: '#FFFFFF',
  },
  teenlancerRating: {
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
  },
  selectTeenlancerButton: {
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
  selectTeenlancerButtonDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
  },
  selectTeenlancerButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  selectTeenlancerButtonTextDark: {
    color: '#FFFFFF',
  },
  teenlancerList: {
    flex: 1,
  },
  teenlancerListContent: {
    padding: 16,
  },
  teenlancerStepList: {
    maxHeight: 250,
  },
  teenlancerStepListContent: {
    gap: 12,
  },
  teenlancerStepItem: {
    position: 'relative',
    borderRadius: 12,
    borderWidth: 0,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  teenlancerStepItemDark: {
    backgroundColor: 'transparent',
  },
  teenlancerOptionsHeader: {
    marginBottom: 16,
  },
  teenlancerOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  teenlancerOptionsTitleDark: {
    color: '#F9FAFB',
  },
  teenlancerOptionsDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  teenlancerOptionsDescriptionDark: {
    color: '#9CA3AF',
  },
  marketplaceToggleContainer: {
    marginBottom: 16,
  },
  teenlancerOptionsSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  separatorLineDark: {
    backgroundColor: '#374151',
  },
  separatorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  separatorTextDark: {
    color: '#9CA3AF',
  },
  teenlancerListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  teenlancerListTitleDark: {
    color: '#F9FAFB',
  },
  pillToggle: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#73af17',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillToggleDark: {
    borderColor: '#73af17',
  },
  pillToggleActive: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  pillToggleActiveDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  pillToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
  },
  pillToggleTextDark: {
    color: '#73af17',
  },
  pillToggleTextActive: {
    color: '#FFFFFF',
  },
  pillToggleTextActiveDark: {
    color: '#FFFFFF',
  },
  teenlancerHint: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  teenlancerHintDark: {
    color: '#9CA3AF',
  },
  teenlancerItem: {
    marginBottom: 12,
    position: 'relative',
  },
  teenlancerItemDark: {
    // Dark styles handled by TeenlancerCard
  },
  selectButtonContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  selectButton: {
    backgroundColor: '#73af17',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectButtonDark: {
    backgroundColor: '#73af17',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
  },
});





