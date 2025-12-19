import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUserTasks } from '@/hooks/useTasks';
import { Task } from '@/types';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { useState } from 'react';

export function NeighborActiveGigs() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Get active gigs (open, accepted, in_progress)
  const { data: activeGigs = [], isLoading } = useUserTasks({
    role: 'poster',
  });

  const filteredGigs = activeGigs.filter(
    gig => ['open', 'accepted', 'in_progress'].includes(gig.status)
  ).slice(0, 5);

  const handleGigPress = (taskId: string) => {
    setSelectedTaskId(taskId);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedTaskId(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#73af17';
      case 'accepted':
        return '#F97316';
      case 'in_progress':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'accepted':
        return 'Accepted';
      case 'in_progress':
        return 'In Progress';
      default:
        return status;
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, isDark && styles.containerDark]}>
        <Text style={[styles.sectionTitle, isDark && styles.titleDark]}>Active Gigs</Text>
        <Text style={[styles.loadingText, isDark && styles.textDark]}>Loading...</Text>
      </View>
    );
  }

  if (filteredGigs.length === 0) {
    return null;
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.gigTitle;
  const cardStyle = isDark ? styles.cardDark : styles.gigCard;
  const textStyle = isDark ? styles.textDark : styles.metaText;

  return (
    <>
      <View style={[styles.container, containerStyle]}>
        <View style={styles.header}>
          <Text style={[styles.sectionTitle, titleStyle]}>Active Gigs</Text>
          <Pressable onPress={() => router.push('/(tabs)/tasks')}>
            <Text style={styles.viewAllText}>View All</Text>
          </Pressable>
        </View>
        <View style={styles.gigsList}>
          {filteredGigs.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.gigCard, cardStyle]}
              onPress={() => handleGigPress(item.id)}
              android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
            >
              {/* Left side: Image with info below */}
              <View style={[styles.leftSection, isDark && styles.leftSectionDark]}>
                {item.photos && item.photos.length > 0 ? (
                  <Image 
                    source={{ uri: item.photos[0] }} 
                    style={styles.image}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
                  </View>
                )}
                
              </View>

              {/* Right side: Title, status, and details */}
              <View style={styles.content}>
                <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.headerRow}>
                  <View style={styles.leftInfo}>
                    {item.estimated_hours && (
                      <View style={styles.metaItem}>
                        <Ionicons name="time" size={14} color="#73af17" />
                        <Text style={[styles.metaText, textStyle]}>{item.estimated_hours}h</Text>
                      </View>
                    )}
                    <View style={styles.metaItem}>
                      <Ionicons name="cash" size={14} color="#73af17" />
                      <Text style={[styles.metaText, textStyle]}>${item.pay.toFixed(2)}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(item.status)}20` }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                {item.teen_id && (
                  <View style={styles.assignedRow}>
                    <Ionicons name="person" size={14} color="#73af17" />
                    <Text style={[styles.assignedText, textStyle]}>Assigned</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <GigDetailModal
        visible={showDetailModal}
        taskId={selectedTaskId}
        onClose={handleCloseModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingVertical: 8,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '600',
  },
  gigsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  gigCard: {
    flexDirection: 'row',
    padding: 0,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  leftSection: {
    width: 100,
    flexDirection: 'column',
    backgroundColor: '#F0F9E8',
  },
  leftSectionDark: {
    backgroundColor: '#111827',
  },
  image: {
    width: 100,
    height: 100,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  gigTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000000',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  leftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '500',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gigDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  loadingText: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});



