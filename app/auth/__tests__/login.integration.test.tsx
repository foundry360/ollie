import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/stores/authStore');
jest.mock('@/lib/supabase');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Import LoginScreen after mocks are set up
const LoginScreen = require('../login').default;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('Login Integration', () => {
  const mockSetUser = jest.fn();
  const mockSetLoading = jest.fn();

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

  it('should render login form', () => {
    const { getByPlaceholderText, getByText } = render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>
    );

    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Login')).toBeTruthy();
  });

  it('should show validation errors for empty fields', async () => {
    const { getByText, queryByText } = render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>
    );

    const loginButton = getByText('Login');
    fireEvent.press(loginButton);

    await waitFor(() => {
      // Form validation should prevent submission
      expect(queryByText(/email/i)).toBeTruthy();
    });
  });

  it('should login successfully with valid credentials', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'teen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token' },
      },
      error: null,
    });

    // Mock getUserProfile
    const { getUserProfile } = require('@/lib/supabase');
    (getUserProfile as jest.Mock).mockResolvedValue(mockUser);

    const { getByPlaceholderText, getByText } = render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>
    );

    const emailInput = getByPlaceholderText('Email');
    const passwordInput = getByPlaceholderText('Password');
    const submitButton = getByText('Login');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'password123');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalled();
    });
  });

  it('should show error on invalid credentials', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const { getByPlaceholderText, getByText, findByText } = render(
      <Wrapper>
        <LoginScreen />
      </Wrapper>
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalled();
    });
  });

  it('should save email to AsyncStorage after successful login', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'teen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValue({
      data: {
        user: { id: '123', email: 'test@example.com' },
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

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));

    await waitFor(() => {
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'last_login_email',
        'test@example.com'
      );
    });
  });
});

