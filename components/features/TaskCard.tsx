import { View, Text } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Task } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface TaskCardProps {
  task: Task;
  onPress?: () => void;
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  return (
    <Card onPress={onPress}>
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-semibold flex-1 mr-2 text-gray-900 dark:text-white">{task.title}</Text>
        <Text className="text-lg font-bold text-blue-600 dark:text-blue-400">${task.pay}</Text>
      </View>
      <Text className="text-gray-600 dark:text-gray-400 mb-2" numberOfLines={2}>{task.description}</Text>
      <View className="flex-row items-center justify-between mt-2">
        <Text className="text-xs text-gray-500 dark:text-gray-400">{task.address}</Text>
        <Text className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</Text>
      </View>
    </Card>
  );
}

