import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { useUserTasks } from '@/hooks/useTasks';
import { Task } from '@/types';
import { formatTimeAgo } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { GigDetailModal } from '@/components/tasks/GigDetailModal';
import { CreateGigModal } from '@/components/tasks/CreateGigModal';
import { useState, useMemo } from 'react';
import { usePendingApplicationsForNeighbor } from '@/hooks/useGigApplications';

export function NeighborActiveGigs() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Get active gigs (open, accepted, in_progress)
  const { data: activeGigs = [], isLoading } = useUserTasks({
    role: 'poster',
  });

  // Get pending applications for neighbor's gigs
  const { data: pendingApplications = [] } = usePendingApplicationsForNeighbor();
  
  // Create a map of gig_id to application count
  const applicationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    pendingApplications.forEach(app => {
      const current = counts.get(app.gig_id) || 0;
      counts.set(app.gig_id, current + 1);
    });
    return counts;
  }, [pendingApplications]);

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

  const handleCreateGig = () => {
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  if (filteredGigs.length === 0) {
    const containerStyle = isDark ? styles.containerDark : styles.containerLight;
    const titleStyle = isDark ? styles.titleDark : undefined;
    const cardStyle = isDark ? styles.emptyCardDark : styles.emptyCard;
    
    return (
      <>
        <View style={[styles.container, containerStyle]}>
          <View style={styles.header}>
            <Text style={[styles.sectionTitle, titleStyle]}>Active Gigs</Text>
          </View>
          <Pressable
            style={[styles.emptyCard, cardStyle]}
            onPress={handleCreateGig}
            android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
          >
            <View style={styles.emptyCardContent}>
              <View style={[styles.plusIconContainer, isDark && styles.plusIconContainerDark]}>
                <Ionicons name="add" size={32} color="#FFFFFF" />
              </View>
              <Text style={[styles.emptyCardText, isDark && styles.emptyCardTextDark]}>
                Ready to get started?
              </Text>
            </View>
          </Pressable>
        </View>
        <CreateGigModal
          visible={showCreateModal}
          onClose={handleCloseCreateModal}
        />
      </>
    );
  }

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : undefined;
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
                <View style={styles.imageContainer}>
                  {item.photos && item.photos.length > 0 ? (
                    <Image 
                      source={{ uri: item.photos[0] }} 
                      style={styles.image}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.imagePlaceholder, isDark && styles.imagePlaceholderDark]}>
                      <Ionicons name="aperture-outline" size={32} color={isDark ? '#D1D5DB' : '#D1D5DB'} />
                    </View>
                  )}
                </View>
              </View>

              {/* Right side: Title, status, and details */}
              <View style={styles.content}>
                <View style={styles.postedRow}>
                  <Text style={styles.postedText} allowFontScaling={false}>
                    Posted {formatTimeAgo(new Date(item.created_at))}
                  </Text>
                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {getStatusLabel(item.status)}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.gigTitle, titleStyle]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[styles.description, textStyle]} numberOfLines={1}>
                  {item.description}
                </Text>
                {item.teen_id && (
                  <View style={styles.assignedRow}>
                    <Ionicons name="person" size={14} color="#F97316" />
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
      <CreateGigModal
        visible={showCreateModal}
        onClose={handleCloseCreateModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
  titleDark: {
    color: '#000000',
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
    backgroundColor: 'transparent',
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cardDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  leftSection: {
    width: 100,
    flexDirection: 'column',
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  leftSectionDark: {
    backgroundColor: '#FFFFFF',
  },
  imageContainer: {
    padding: 8,
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  imagePlaceholderDark: {
    backgroundColor: '#FFFFFF',
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
    color: '#000000',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  gigTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  description: {
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 16,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
  },
  applicationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  postedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  postedText: {
    fontSize: 11,
    color: '#6B7280',
  },
  applicationsText: {
    fontSize: 10,
    color: '#73af17',
    fontWeight: '500',
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  assignedText: {
    fontSize: 14,
    color: '#F97316',
    fontWeight: '500',
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  statusText: {
    fontSize: 10,
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
  emptyCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardDark: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  emptyCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  plusIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  plusIconContainerDark: {
    backgroundColor: '#73af17',
  },
  emptyCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyCardTextDark: {
    color: '#6B7280',
  },
});














