import { create } from 'zustand';
import { User } from '@/types';

interface AuthState {
  user: User | null;
  loading: boolean;
  suppressingNavigation: boolean; // Flag to temporarily suppress navigation during OTP verification
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSuppressingNavigation: (suppressing: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  suppressingNavigation: false,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setSuppressingNavigation: (suppressing) => set({ suppressingNavigation: suppressing })
}));

