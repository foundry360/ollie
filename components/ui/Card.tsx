import { View, Pressable } from 'react-native';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export function Card({ children, onPress, className }: CardProps) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={clsx('bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 shadow-sm border border-gray-200 dark:border-gray-700', className)} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={clsx('bg-white dark:bg-gray-800 rounded-lg p-4 mb-3 shadow-sm border border-gray-200 dark:border-gray-700', className)}>
      {children}
    </View>
  );
}

