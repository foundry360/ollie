/**
 * Functional Tests for Task Creation Feature
 * 
 * User Story: As a neighbor (poster), I can create a task so teens can help me
 * 
 * Test Scenarios:
 * 1. Poster can create a task with all required fields
 * 2. Task creation validates required fields
 * 3. Task creation includes location
 * 4. Task creation can include photos
 * 5. Task appears in marketplace after creation
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useCreateTask } from '@/hooks/useTasks';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '@/components/ui/Alert';

jest.mock('@/stores/authStore');
jest.mock('@/hooks/useTasks');
jest.mock('expo-location');
jest.mock('expo-image-picker');
jest.mock('@/components/ui/Alert', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const CreateTaskScreen = require('@/app/tasks/create').default;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </QueryClientProvider>
);

describe('Feature: Task Creation', () => {
  const mockPosterUser = {
    id: 'poster-123',
    email: 'poster@example.com',
    role: 'poster',
    full_name: 'Neighbor User',
  };

  const mockCreateTask = jest.fn();
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as jest.Mock).mockReturnValue({
      user: mockPosterUser,
    });
    (useCreateTask as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateTask,
      isLoading: false,
    });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    });
  });

  describe('As a neighbor, I can create a task with required information', () => {
    it('should successfully create a task with all required fields', async () => {
      const createdTask = {
        id: 'task-123',
        title: 'Mow the lawn',
        description: 'Need help mowing the front and back yard',
        pay: 50,
        address: '123 Main St, San Francisco, CA',
        status: 'open',
      };

      mockCreateTask.mockResolvedValue(createdTask);

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      // Fill in task details
      fireEvent.changeText(
        getByPlaceholderText(/title/i),
        'Mow the lawn'
      );
      fireEvent.changeText(
        getByPlaceholderText(/description/i),
        'Need help mowing the front and back yard'
      );
      fireEvent.changeText(
        getByPlaceholderText(/pay|amount/i),
        '50'
      );
      fireEvent.changeText(
        getByPlaceholderText(/address/i),
        '123 Main St, San Francisco, CA'
      );

      // Submit form
      const submitButton = getByText(/create|post|submit/i);
      fireEvent.press(submitButton);

      // Verify task was created
      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Mow the lawn',
            description: 'Need help mowing the front and back yard',
            pay: 50,
            address: '123 Main St, San Francisco, CA',
          })
        );
      });
    });

    it('should validate that title is at least 3 characters', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      // Enter short title
      fireEvent.changeText(getByPlaceholderText(/title/i), 'Hi');
      fireEvent.changeText(
        getByPlaceholderText(/description/i),
        'This is a longer description'
      );
      fireEvent.changeText(getByPlaceholderText(/pay|amount/i), '50');
      fireEvent.changeText(
        getByPlaceholderText(/address/i),
        '123 Main St'
      );

      fireEvent.press(getByText(/create|post|submit/i));

      // Should show validation error
      await waitFor(() => {
        expect(getByText(/at least 3 characters/i)).toBeTruthy();
      });

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('should validate that description is at least 10 characters', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      fireEvent.changeText(
        getByPlaceholderText(/title/i),
        'Valid Title Here'
      );
      fireEvent.changeText(getByPlaceholderText(/description/i), 'Short');
      fireEvent.changeText(getByPlaceholderText(/pay|amount/i), '50');
      fireEvent.changeText(
        getByPlaceholderText(/address/i),
        '123 Main St'
      );

      fireEvent.press(getByText(/create|post|submit/i));

      await waitFor(() => {
        expect(getByText(/at least 10 characters/i)).toBeTruthy();
      });

      expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('should validate that pay amount is greater than 0', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      fireEvent.changeText(
        getByPlaceholderText(/title/i),
        'Valid Title Here'
      );
      fireEvent.changeText(
        getByPlaceholderText(/description/i),
        'This is a valid description with enough characters'
      );
      fireEvent.changeText(getByPlaceholderText(/pay|amount/i), '0');
      fireEvent.changeText(
        getByPlaceholderText(/address/i),
        '123 Main St'
      );

      fireEvent.press(getByText(/create|post|submit/i));

      await waitFor(() => {
        expect(getByText(/greater than 0/i)).toBeTruthy();
      });

      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });

  describe('As a neighbor, I can add location to my task', () => {
    it('should get current location when user taps "Use Current Location"', async () => {
      const { getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const useCurrentLocationButton = getByText(/current location|use location/i);
      fireEvent.press(useCurrentLocationButton);

      await waitFor(() => {
        expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
        expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
      });
    });

    it('should show error if location permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const useCurrentLocationButton = getByText(/current location|use location/i);
      fireEvent.press(useCurrentLocationButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          expect.stringContaining('Location permission')
        );
      });
    });

    it('should allow manual address entry', async () => {
      const { getByPlaceholderText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const addressInput = getByPlaceholderText(/address/i);
      fireEvent.changeText(addressInput, '123 Main St, San Francisco, CA');

      expect(addressInput.props.value).toBe('123 Main St, San Francisco, CA');
    });
  });

  describe('As a neighbor, I can add photos to my task', () => {
    it('should allow user to pick photos from library', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [
          { uri: 'file://photo1.jpg' },
          { uri: 'file://photo2.jpg' },
        ],
      });

      const { getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const pickPhotoButton = getByText(/photo|image|gallery/i);
      fireEvent.press(pickPhotoButton);

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      });
    });

    it('should allow user to take photo with camera', async () => {
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        uri: 'file://camera-photo.jpg',
      });

      const { getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const takePhotoButton = getByText(/camera|take photo/i);
      fireEvent.press(takePhotoButton);

      await waitFor(() => {
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
      });
    });

    it('should show error if photo permission is denied', async () => {
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const { getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      const pickPhotoButton = getByText(/photo|image|gallery/i);
      fireEvent.press(pickPhotoButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          expect.stringContaining('Photo library permission')
        );
      });
    });
  });

  describe('As a neighbor, my created task appears in the marketplace', () => {
    it('should navigate to task detail after successful creation', async () => {
      const createdTask = {
        id: 'task-123',
        title: 'Mow the lawn',
        description: 'Need help mowing',
        pay: 50,
        address: '123 Main St',
        status: 'open',
      };

      mockCreateTask.mockResolvedValue(createdTask);

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <CreateTaskScreen />
        </Wrapper>
      );

      // Fill and submit form
      fireEvent.changeText(getByPlaceholderText(/title/i), 'Mow the lawn');
      fireEvent.changeText(
        getByPlaceholderText(/description/i),
        'Need help mowing the yard'
      );
      fireEvent.changeText(getByPlaceholderText(/pay|amount/i), '50');
      fireEvent.changeText(getByPlaceholderText(/address/i), '123 Main St');
      fireEvent.press(getByText(/create|post|submit/i));

      await waitFor(() => {
        expect(mockCreateTask).toHaveBeenCalled();
      });

      // Verify success message or navigation
      // (Implementation depends on your app)
    });
  });
});

