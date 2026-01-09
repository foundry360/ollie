import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  colorScheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  initializeTheme: () => void;
}

const getSystemColorScheme = (): 'light' | 'dark' => {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
};

export const useThemeStore = create<ThemeState>((set, get) => {
  // Load theme from storage on initialization - wrapped in try-catch for safety
  try {
    AsyncStorage.getItem('theme-storage')
      .then((stored) => {
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const theme = parsed.theme || 'system';
            const colorScheme = theme === 'system' ? getSystemColorScheme() : theme;
            set({ theme, colorScheme });
          } catch (error) {
            console.error('Error parsing theme:', error);
            // Use defaults if parsing fails
            set({ theme: 'system', colorScheme: getSystemColorScheme() });
          }
        }
      })
      .catch((error) => {
        console.error('Error loading theme from storage:', error);
        // Use defaults if storage access fails
        set({ theme: 'system', colorScheme: getSystemColorScheme() });
      });
  } catch (error) {
    console.error('Error initializing theme store:', error);
  }

  return {
    theme: 'system',
    colorScheme: getSystemColorScheme(),
    
    setTheme: (theme: Theme) => {
      const colorScheme = theme === 'system' 
        ? getSystemColorScheme() 
        : theme;
      set({ theme, colorScheme });
      // Save to storage
      AsyncStorage.setItem('theme-storage', JSON.stringify({ theme })).catch((error) => {
        console.error('Error saving theme:', error);
      });
    },
    
    initializeTheme: () => {
      const { theme } = get();
      const colorScheme = theme === 'system' 
        ? getSystemColorScheme() 
        : theme;
      set({ colorScheme });
      
      // Listen for system theme changes
      const subscription = Appearance.addChangeListener(({ colorScheme }) => {
        if (get().theme === 'system') {
          set({ colorScheme: colorScheme === 'dark' ? 'dark' : 'light' });
        }
      });
      
      return () => subscription.remove();
    },
  };
});

