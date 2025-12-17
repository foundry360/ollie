import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, Image, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useCreateTask } from '@/hooks/useTasks';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

const createTaskSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  pay: z.number().min(0.01, 'Pay must be greater than 0'),
  address: z.string().min(5, 'Please enter a valid address'),
  estimated_hours: z.number().min(0.5).optional(),
  required_skills: z.array(z.string()).optional(),
});

type CreateTaskFormData = z.infer<typeof createTaskSchema> & {
  location?: { latitude: number; longitude: number };
  photos?: string[];
};

export default function CreateTaskScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const createTaskMutation = useCreateTask();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const { control, handleSubmit, formState: { errors }, setValue, watch } = useForm<CreateTaskFormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      pay: 0,
      address: '',
      estimated_hours: undefined,
      required_skills: [],
    },
  });

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to create a task.');
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
        const addressString = `${address.street || ''} ${address.city || ''}, ${address.region || ''} ${address.postalCode || ''}`.trim();
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

    try {
      // In production, upload photos to Supabase Storage first
      // For now, we'll just store the URIs
      await createTaskMutation.mutateAsync({
        title: data.title,
        description: data.description,
        pay: data.pay,
        location,
        address: data.address,
        estimated_hours: data.estimated_hours,
        required_skills: data.required_skills,
        photos: photos.length > 0 ? photos : undefined,
      });

      Alert.alert('Success', 'Task created successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create task');
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, titleStyle]}>Create New Task</Text>
        <Text style={[styles.subtitle, subtitleStyle]}>
          Post a task for teens in your neighborhood
        </Text>

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Task Title"
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
                  placeholder="Describe the task in detail..."
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

        <Controller
          control={control}
          name="pay"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Pay Amount ($)"
              value={value.toString()}
              onChangeText={(text) => {
                const num = parseFloat(text) || 0;
                onChange(num);
              }}
              onBlur={onBlur}
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
              value={value?.toString() || ''}
              onChangeText={(text) => {
                const num = text ? parseFloat(text) : undefined;
                onChange(num);
              }}
              onBlur={onBlur}
              error={errors.estimated_hours?.message}
              keyboardType="decimal-pad"
              placeholder="2.5"
            />
          )}
        />

        <View style={styles.locationSection}>
          <Text style={[styles.label, isDark && styles.labelDark]}>
            Location <Text style={styles.required}>*</Text>
          </Text>
          <Button
            title={location ? "Update Location" : "Get Current Location"}
            onPress={getCurrentLocation}
            loading={isGettingLocation}
            variant="secondary"
            fullWidth
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
            <Button
              title="Pick from Library"
              onPress={pickImage}
              variant="secondary"
            />
            <Button
              title="Take Photo"
              onPress={takePhoto}
              variant="secondary"
            />
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
          title="Create Task"
          onPress={handleSubmit(onSubmit)}
          loading={createTaskMutation.isPending}
          disabled={createTaskMutation.isPending || !location}
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
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    lineHeight: 24,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
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
});
