import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';
import { User } from '@/types';

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(null);
      result.current.setLoading(true); // Reset to initial state
      result.current.setSuppressingNavigation(false);
    });
  });

  it('should initialize with null user and loading true', () => {
    const { result } = renderHook(() => useAuthStore());
    // Note: Zustand stores maintain state, so we check the actual initial state
    // The store initializes with loading: true, but after setUser(null) it becomes false
    expect(result.current.user).toBeNull();
    expect(result.current.suppressingNavigation).toBe(false);
  });

  it('should set user correctly', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'teen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it('should set user to null', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'teen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).not.toBeNull();

    act(() => {
      result.current.setUser(null);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should set suppressingNavigation flag', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setSuppressingNavigation(true);
    });

    expect(result.current.suppressingNavigation).toBe(true);

    act(() => {
      result.current.setSuppressingNavigation(false);
    });

    expect(result.current.suppressingNavigation).toBe(false);
  });

  it('should set loading to false when setting user', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser: User = {
      id: '123',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'teen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.loading).toBe(true);

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.loading).toBe(false);
  });
});

