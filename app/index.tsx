import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { Loading } from '@/components/ui/Loading';

export default function IndexScreen() {
  const router = useRouter();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    if (user) {
      router.replace('/(tabs)/home');
    } else {
      router.replace('/splash');
    }
  }, [user, loading, router]);

  return <Loading />;
}

