import { FlatList, View, Text } from 'react-native';
import { TaskCard } from './TaskCard';
import { Task } from '@/types';
import { Loading } from '@/components/ui/Loading';

interface TaskListProps {
  tasks: Task[];
  loading?: boolean;
  onTaskPress?: (task: Task) => void;
}

export function TaskList({ tasks, loading, onTaskPress }: TaskListProps) {
  if (loading) {
    return <Loading />;
  }

  if (tasks.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Text className="text-gray-500 text-center">No tasks available</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tasks}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <TaskCard task={item} onPress={() => onTaskPress?.(item)} />}
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
    />
  );
}

