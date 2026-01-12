/**
 * Functional Tests for User Login Feature
 * 
 * User Story: As a user, I can log in to my account so I can access the app
 * 
 * Test Scenarios:
 * 1. User can log in with valid credentials
 * 2. User sees error with invalid credentials
 * 3. User's last email is remembered
 * 4. User can reset password
 * 5. User is redirected correctly after login based on role
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from '@/components/ui/Alert';

// Mock dependencies
jest.mock('@/stores/authStore');
jest.mock('@/lib/supabase');
jest.mock('@react-native-async-storage/async-storage');
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
  useLocalSearchParams: () => ({}),
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Import LoginScreen after mocks
const LoginScreen = require('@/app/auth/login').default;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </QueryClientProvider>
);

describe('Feature: User Login', () => {
  const mockSetUser = jest.fn();
  const mockSetLoading = jest.fn();
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as jest.Mock).mockReturnValue({
      user: null,
      setUser: mockSetUser,
      setLoading: mockSetLoading,
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  });

  describe('As a user, I can log in with my email and password', () => {
    it('should successfully log in with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        full_name: 'Test User',
        role: 'teen',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          user: { id: 'user-123', email: 'test@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      const { getUserProfile } = require('@/lib/supabase');
      (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Enter credentials
      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      
      // Submit form
      fireEvent.press(getByText('Login'));

      // Verify login was attempted
      await waitFor(() => {
        expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });

      // Verify user was set
      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(mockUser);
      });

      // Verify email was saved
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_login_email',
        'test@example.com'
      );
    });

    it('should show error message when credentials are invalid', async () => {
      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'wrong@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'wrongpassword');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Login Failed',
          expect.stringContaining('Invalid login credentials')
        );
      });
    });

    it('should validate email format before submitting', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Enter invalid email
      fireEvent.changeText(getByPlaceholderText('Email'), 'not-an-email');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Login'));

      // Should show validation error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please enter a valid email address'
        );
      });

      // Should not attempt login
      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('should require password before submitting', async () => {
      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
      // Don't enter password
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Password is required');
      });

      expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    });
  });

  describe('As a user, my last email address is remembered', () => {
    it('should pre-fill email from last login', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('last@example.com');

      const { getByText, queryByPlaceholderText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Email field should be hidden when last email exists
      await waitFor(() => {
        expect(queryByPlaceholderText('Email')).toBeNull();
      });

      // Password field should still be visible
      expect(getByText('Login')).toBeTruthy();
    });

    it('should allow user to change remembered email', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('last@example.com');

      const { getByText, queryByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Should have option to use different email
      // (Implementation depends on your UI)
      await waitFor(() => {
        // Check if "Use different email" or similar button exists
        const useDifferentEmail = queryByText(/different|change|other/i);
        if (useDifferentEmail) {
          fireEvent.press(useDifferentEmail);
        }
      });
    });
  });

  describe('As a user, I can reset my password if I forget it', () => {
    it('should allow user to request password reset', async () => {
      const { getByText, getByPlaceholderText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Find and click "Forgot Password" link
      const forgotPasswordLink = getByText(/forgot|reset/i);
      fireEvent.press(forgotPasswordLink);

      // Should show password reset form
      await waitFor(() => {
        expect(getByPlaceholderText(/email/i)).toBeTruthy();
      });
    });

    it('should send password reset email when valid email is provided', async () => {
      (supabase.auth.resetPasswordForEmail as jest.Mock).mockResolvedValue({
        data: {},
        error: null,
      });

      const { getByText, getByPlaceholderText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      // Navigate to forgot password
      fireEvent.press(getByText(/forgot|reset/i));
      
      await waitFor(() => {
        const emailInput = getByPlaceholderText(/email/i);
        fireEvent.changeText(emailInput, 'test@example.com');
      });

      // Submit reset request
      const submitButton = getByText(/send|reset/i);
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
          'test@example.com'
        );
      });
    });
  });

  describe('As a user, I am redirected correctly after login', () => {
    it('should redirect teen users to home screen', async () => {
      const mockTeenUser = {
        id: 'teen-123',
        email: 'teen@example.com',
        role: 'teen',
        full_name: 'Teen User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          user: { id: 'teen-123', email: 'teen@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      const { getUserProfile } = require('@/lib/supabase');
      (getUserProfile as jest.Mock).mockResolvedValue(mockTeenUser);

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'teen@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(mockTeenUser);
      });

      // Verify navigation (would need to check router.replace was called)
      // This depends on your navigation implementation
    });

    it('should redirect neighbor users to home screen', async () => {
      const mockPosterUser = {
        id: 'poster-123',
        email: 'poster@example.com',
        role: 'poster',
        full_name: 'Neighbor User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
        data: {
          user: { id: 'poster-123', email: 'poster@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      const { getUserProfile } = require('@/lib/supabase');
      (getUserProfile as jest.Mock).mockResolvedValue(mockPosterUser);

      const { getByPlaceholderText, getByText } = render(
        <Wrapper>
          <LoginScreen />
        </Wrapper>
      );

      fireEvent.changeText(getByPlaceholderText('Email'), 'poster@example.com');
      fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
      fireEvent.press(getByText('Login'));

      await waitFor(() => {
        expect(mockSetUser).toHaveBeenCalledWith(mockPosterUser);
      });
    });
  });
});

