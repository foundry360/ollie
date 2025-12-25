import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, Pressable, Linking, Platform, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { useTask, useStartTask, useCompleteTask, useIsGigSaved, useSaveGig, useUnsaveGig, useDeleteTask, taskKeys } from '@/hooks/useTasks';
import { applyForGig } from '@/lib/api/tasks';
import { useAuthStore } from '@/stores/authStore';
import { TaskStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '@/components/ui/Loading';
import { useRouter } from 'expo-router';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { formatAddress } from '@/lib/utils';
import { format } from 'date-fns';
import { CreateGigModal } from '@/components/tasks/CreateGigModal';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { getPublicUserProfile, getUserProfileForChat } from '@/lib/api/users';
import { useGigApplications, useHasAppliedForGig, useApproveGigApplication, useRejectGigApplication } from '@/hooks/useGigApplications';
import { AddReviewModal } from '@/components/reviews/AddReviewModal';
import { canReviewGig, getAverageRating } from '@/lib/api/reviews';
import { teenStatsKeys } from '@/hooks/useTeenStats';

interface GigDetailModalProps {
  visible: boolean;
  taskId: string | null;
  onClose: () => void;
}

export function GigDetailModal({ visible, taskId, onClose }: GigDetailModalProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();
  const { data: task, isLoading } = useTask(taskId || '');
  const startTaskMutation = useStartTask();
  const completeTaskMutation = useCompleteTask();
  const deleteTaskMutation = useDeleteTask();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedTeenId, setSelectedTeenId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [canReview, setCanReview] = useState<{ canReview: boolean; reason?: string }>({ canReview: false });
  const [selectedTeenForReview, setSelectedTeenForReview] = useState<string | null>(null);
  
  // Check if gig is saved (only for teenlancers)
  const { data: isSaved = false } = useIsGigSaved(taskId);
  const saveGigMutation = useSaveGig();
  const unsaveGigMutation = useUnsaveGig();
  
  // Check if teen has already applied
  const { data: hasApplied = false } = useHasAppliedForGig(taskId);
  
  // Determine user roles and relationships
  const isPoster = task ? user?.id === task.poster_id : false;
  const isTeen = task ? (task.teen_id ? user?.id === task.teen_id : false) : false;
  const isTeenlancer = user?.role === 'teen';
  const isNeighbor = user?.role === 'poster';
  const isOpen = task?.status === 'open';
  
  // Get applications for this gig (for neighbors and teenlancers viewing open gigs)
  // Neighbors need full details, teenlancers just need the count
  const shouldFetchApplications = isNeighbor || (isOpen && isTeenlancer && !isPoster && !isTeen);
  const { data: applications = [] } = useGigApplications(shouldFetchApplications ? taskId : null);
  
  const approveMutation = useApproveGigApplication();
  const rejectMutation = useRejectGigApplication();

  // Fetch teenlancer profile if gig is assigned
  const { data: teenProfile } = useQuery({
    queryKey: ['teenProfile', task?.teen_id],
    queryFn: () => getPublicUserProfile(task!.teen_id!),
    enabled: !!task?.teen_id,
    staleTime: 300000, // 5 minutes
  });
  
  // Fetch teenlancer rating
  const { data: teenRatingData } = useQuery({
    queryKey: ['teenRating', task?.teen_id],
    queryFn: () => getAverageRating(task!.teen_id!),
    enabled: !!task?.teen_id,
    staleTime: 300000, // 5 minutes
  });
  
  const teenRating = teenRatingData?.averageRating || 0;
  const teenReviewCount = teenRatingData?.reviewCount || 0;
  
  // Fetch neighbor/poster profile for teenlancers viewing open gigs
  const shouldFetchNeighborProfile = !!task?.poster_id && isOpen && isTeenlancer && !isPoster && !isTeen;
  const { data: neighborProfile, isLoading: isLoadingNeighborProfile, error: neighborProfileError, status: queryStatus, fetchStatus } = useQuery({
    queryKey: ['neighborProfile', task?.poster_id],
    queryFn: async () => {
      try {
        const profile = await getUserProfileForChat(task!.poster_id!);
        console.log('getUserProfileForChat result:', {
          posterId: task!.poster_id,
          profile,
          hasPhoto: !!profile?.profile_photo_url,
          photoUrl: profile?.profile_photo_url,
        });
        return profile;
      } catch (error) {
        console.error('Error fetching neighbor profile:', error);
        throw error;
      }
    },
    enabled: shouldFetchNeighborProfile,
    staleTime: 300000, // 5 minutes
    retry: 1,
  });
  
  // Debug logging
  useEffect(() => {
    if (shouldFetchNeighborProfile) {
      console.log('Floating message bubble - Neighbor profile query state:', {
        posterId: task?.poster_id,
        shouldFetch: shouldFetchNeighborProfile,
        neighborProfile,
        isLoadingNeighborProfile,
        error: neighborProfileError,
        hasPhoto: !!neighborProfile?.profile_photo_url,
        photoUrl: neighborProfile?.profile_photo_url,
        isOpen,
        isTeenlancer,
        isPoster,
        isTeen,
      });
    }
  }, [neighborProfile, isLoadingNeighborProfile, neighborProfileError, shouldFetchNeighborProfile, task?.poster_id, isOpen, isTeenlancer, isPoster, isTeen]);
  const canApply = task && isOpen && !isPoster && !isTeen && isTeenlancer && !hasApplied;
  const canStart = task && isTeen && task.status === 'accepted';
  const canComplete = task && isTeen && task.status === 'in_progress';
  const canEdit = task && isPoster && isNeighbor && ['open', 'cancelled'].includes(task.status);
  const canDelete = task && isPoster && isNeighbor && ['open', 'accepted'].includes(task.status);
  const canSave = task && isOpen && isTeenlancer && !isPoster && !isTeen;
  const pendingApplications = applications.filter(app => app.status === 'pending');
  
  // Get applicant count from pending applications
  const applicantCount = pendingApplications.length;
  
  // Check if teenlancer can review neighbor for completed gigs
  const isCompleted = task?.status === 'completed';
  const canReviewNeighbor = task && isCompleted && isTeen && task.poster_id;
  
  // Check review eligibility when task changes
  useEffect(() => {
    if (canReviewNeighbor && task?.id) {
      canReviewGig(task.id)
        .then((data) => {
          setCanReview(data);
        })
        .catch((error) => {
          console.error('Error checking review eligibility:', error);
          setCanReview({ canReview: false });
        });
    } else {
      setCanReview({ canReview: false });
    }
  }, [canReviewNeighbor, task?.id]);

  const handleApply = async () => {
    if (!task) return;
    
    Alert.alert(
      'Apply for Gig',
      `Are you sure you want to apply for "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            try {
              setIsApplying(true);
              await applyForGig(task.id);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['gigApplications'] });
              Alert.alert('Success', 'Application submitted! The neighbor will review your application.', [
                { text: 'OK', onPress: onClose }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to apply for gig');
            } finally {
              setIsApplying(false);
            }
          },
        },
      ]
    );
  };

  const handleApproveApplication = async (applicationId: string) => {
    Alert.alert(
      'Approve Application',
      'Are you sure you want to approve this teenlancer for this gig?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              await approveMutation.mutateAsync(applicationId);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['gigApplications'] });
              Alert.alert('Success', 'Application approved! The teenlancer has been assigned to this gig.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to approve application');
            }
          },
        },
      ]
    );
  };

  const handleRejectApplication = async (applicationId: string) => {
    Alert.prompt(
      'Reject Application',
      'Enter a reason for rejection (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason: string | undefined) => {
            try {
              await rejectMutation.mutateAsync({ applicationId, reason });
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['gigApplications'] });
              Alert.alert('Success', 'Application rejected.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to reject application');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleDelete = () => {
    if (!task) return;
    
    Alert.alert(
      'Delete Gig',
      'Are you sure you want to delete this gig? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Attempting to delete gig:', task.id);
              await deleteTaskMutation.mutateAsync(task.id);
              console.log('Gig deleted successfully, invalidating queries');
              // Invalidate all task-related queries to refresh the UI
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              queryClient.invalidateQueries({ queryKey: ['gigApplications'] });
              queryClient.invalidateQueries({ queryKey: ['savedGigs'] });
              queryClient.invalidateQueries({ queryKey: taskKeys.open() });
              queryClient.invalidateQueries({ queryKey: taskKeys.user() });
              // Close the modal and show success message
              onClose();
              Alert.alert('Success', 'Gig deleted successfully.');
            } catch (error: any) {
              console.error('Error deleting gig:', error);
              Alert.alert('Error', error.message || 'Failed to delete gig');
            }
          },
        },
      ]
    );
  };

  const handleOpenMap = () => {
    if (!task) return;
    const { latitude, longitude } = task.location;
    let url: string;
    
    if (Platform.OS === 'ios') {
      // iOS Maps - use daddr for destination in directions, or ll for location
      // Using ll with q to show the location
      url = `maps://maps.apple.com/?ll=${latitude},${longitude}&q=${encodeURIComponent(task.address)}`;
    } else {
      // Android - try google.navigation first, fallback to geo
      // Using geo with coordinates and address query
      url = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(task.address)})`;
    }
    
    Linking.openURL(url).catch(() => {
      // Fallback to web-based Google Maps
      const fallbackUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      Linking.openURL(fallbackUrl).catch(() => {
        Alert.alert('Error', 'Could not open maps app');
      });
    });
  };

  const handleStart = async () => {
    if (!task) return;
    
    Alert.alert(
      'Start Gig',
      `Are you ready to start "${task.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              await startTaskMutation.mutateAsync(task.id);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              Alert.alert('Success', 'Gig started!', [
                { text: 'OK', onPress: onClose }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to start gig');
            }
          },
        },
      ]
    );
  };

  const handleSaveGig = async () => {
    if (!task) return;
    
    try {
      if (isSaved) {
        await unsaveGigMutation.mutateAsync(task.id);
        Alert.alert('Success', 'Gig removed from saved');
      } else {
        await saveGigMutation.mutateAsync(task.id);
        Alert.alert('Success', 'Gig saved!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save gig');
    }
  };

  const handleComplete = async () => {
    if (!task) return;
    
    Alert.alert(
      'Complete Gig',
      `Mark "${task.title}" as completed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              await completeTaskMutation.mutateAsync(task.id);
              queryClient.invalidateQueries({ queryKey: ['tasks'] });
              Alert.alert('Success', 'Gig completed! Earnings will be processed.', [
                { text: 'OK', onPress: onClose }
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to complete gig');
            }
          },
        },
      ]
    );
  };

  const handleChat = () => {
    if (!task) return;
    console.log('GigDetailModal handleChat:', {
      taskId: task.id,
      taskStatus: task.status,
      taskTeenId: task.teen_id,
      taskPosterId: task.poster_id,
      isNeighbor,
      isTeenlancer,
      isOpen,
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/tasks/GigDetailModal.tsx:330',message:'handleChat called',data:{taskId:task.id,taskStatus:task.status,taskTeenId:task.teen_id,taskPosterId:task.poster_id,isNeighbor,isTeenlancer,isOpen},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    
    onClose();
    
    // For neighbors on open gigs, they need to select an applicant first
    // Don't navigate to chat - show message or do nothing (they should use Message button on applicant)
    if (isNeighbor && isOpen && !task.teen_id) {
      console.log('GigDetailModal: Neighbor on open gig - cannot chat without selecting applicant');
      // Don't navigate - they should click Message on an applicant card
      return;
    }
    
    router.push(`/chat/${task.id}`);
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'open':
        return '#73af17';
      case 'accepted':
        return '#F97316';
      case 'in_progress':
        return '#F59E0B';
      case 'completed':
        return '#6366F1';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  // Helper to convert 24-hour time to 12-hour format
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper to format date
  const formatScheduledDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return format(date, 'EEEE, MMMM d, yyyy'); // e.g., "Monday, January 15, 2024"
    } catch {
      return dateString;
    }
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const titleStyle = isDark ? styles.titleDark : styles.title;
  const textStyle = isDark ? styles.textDark : styles.description;
  const labelStyle = isDark ? styles.labelDark : styles.label;
  const sectionStyle = isDark ? styles.sectionDark : styles.section;
  const modalStyle = isDark ? styles.modalDark : styles.modalContent;
  const headerStyle = isDark ? styles.modalHeaderDark : styles.modalHeaderLight;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
        <View style={[styles.modalContent, modalStyle]}>
          <View style={styles.greenHeaderBackground} />
          <View style={[styles.modalHeader, headerStyle, styles.modalHeaderWithGreen]}>
            <View style={[styles.handle, styles.handleOnGreen]} />
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, titleStyle, styles.modalTitleOnGreen]}>Gig Details</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <View style={[styles.loadingContainer, isDark && styles.loadingContainerDark]}>
              <View style={styles.loadingWrapper}>
                <Loading />
              </View>
            </View>
          ) : !task ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, isDark && styles.errorTextDark]}>
                Gig not found
              </Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.scrollView} 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              contentInsetAdjustmentBehavior="never"
            >
              <View style={styles.imageContainer}>
                {task.photos && task.photos.length > 0 ? (
                  (() => {
                    const imageUrl = task.photos[0];
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GigDetailModal.tsx:438',message:'Rendering gig image',data:{hasPhotos:!!task.photos,photoCount:task.photos?.length,imageUrl,isValidUrl:imageUrl?.startsWith('http')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                    // #endregion
                    return (
                      <Image 
                        source={{ uri: imageUrl }} 
                        style={styles.image}
                        resizeMode="cover"
                        onError={(e) => {
                          // #region agent log
                          fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GigDetailModal.tsx:446',message:'Gig image onError',data:{imageUrl,error:e.nativeEvent?.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                          // #endregion
                          console.log('Gig image load error:', e.nativeEvent.error, 'URL:', imageUrl);
                        }}
                        onLoad={() => {
                          // #region agent log
                          fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'GigDetailModal.tsx:451',message:'Gig image onLoad',data:{imageUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                          // #endregion
                          console.log('Gig image loaded successfully:', imageUrl);
                        }}
                      />
                    );
                  })()
                ) : (
                  <View style={[styles.imagePlaceholder, isDark && styles.imagePlaceholderDark]}>
                    <Ionicons name="aperture-outline" size={48} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    <Text style={[styles.imagePlaceholderText, isDark ? styles.imagePlaceholderTextDark : styles.imagePlaceholderTextLight]}>
                      No image available
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, titleStyle]}>{task.title}</Text>
                    {(canEdit || canDelete) && (
                      <View style={styles.actionButtons}>
                        {canEdit && (
                          <Pressable 
                            style={styles.editButton}
                            onPress={() => setShowEditModal(true)}
                          >
                            <Ionicons name="create-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          </Pressable>
                        )}
                        {canDelete && (
                          <Pressable 
                            style={styles.deleteButton}
                            onPress={handleDelete}
                          >
                            <Ionicons name="trash-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.payRow}>
                    <View style={styles.payLeft}>
                      <Ionicons name="cash" size={24} color="#73af17" />
                      <Text style={[styles.payAmount, titleStyle]}>${task.pay.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />
                      <Text 
                        style={[
                          styles.statusText, 
                          isDark ? styles.statusTextDark : styles.statusTextLight
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {task.status ? task.status.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                      </Text>
                    </View>
                  </View>
                  {isOpen && (
                    <View style={styles.applicantsRow}>
                      <Text style={[styles.applicantsText, textStyle]}>
                        Applicants ({applicantCount})
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[titleStyle, styles.sectionTitle]}>Description</Text>
                  <Text style={[styles.description, textStyle]}>{task.description}</Text>
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[titleStyle, styles.sectionTitle]}>Details</Text>
                  {task.estimated_hours && (
                    <>
                      <View style={styles.detailRow}>
                        <Ionicons name="time" size={20} color="#73af17" />
                        <Text style={[styles.detailText, textStyle]}>
                          Estimated: {task.estimated_hours} hours
                        </Text>
                      </View>
                      <View style={[styles.detailDivider, isDark && styles.detailDividerDark]} />
                    </>
                  )}
                  <View style={styles.detailRow}>
                    <Ionicons name="location" size={20} color="#73af17" />
                    <View style={styles.addressContainer}>
                      {(() => {
                        const { street, cityStateZip } = formatAddress(task.address);
                        return (
                          <View>
                            <Text style={[styles.detailText, textStyle]}>{street || task.address}</Text>
                            {cityStateZip ? (
                              <Text style={[styles.detailText, textStyle]}>{cityStateZip}</Text>
                            ) : null}
                          </View>
                        );
                      })()}
                    </View>
                  </View>
                  {(task.scheduled_date || (task.teen_id && isNeighbor) || (task.required_skills && task.required_skills.length > 0)) && (
                    <View style={[styles.detailDivider, isDark && styles.detailDividerDark]} />
                  )}
                  {task.scheduled_date && (
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar" size={20} color="#73af17" />
                      <View style={styles.schedulingContainer}>
                        <Text style={[styles.detailText, textStyle]}>
                          {formatScheduledDate(task.scheduled_date)}
                        </Text>
                        {task.scheduled_start_time && task.scheduled_end_time && (
                          <Text style={[styles.detailText, textStyle]}>
                            {formatTime12Hour(task.scheduled_start_time)} - {formatTime12Hour(task.scheduled_end_time)}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                  {task.teen_id && isNeighbor && (
                    <>
                      <View style={[styles.detailDivider, isDark && styles.detailDividerDark]} />
                      <View style={styles.detailRow}>
                        <Pressable 
                          style={styles.teenInfoContainer}
                          onPress={() => setShowProfileModal(true)}
                        >
                          <View style={styles.teenAvatarContainer}>
                            {teenProfile?.profile_photo_url ? (
                              <Image
                                source={{ uri: teenProfile.profile_photo_url }}
                                style={styles.teenAvatar}
                              />
                            ) : (
                              <View style={[styles.teenAvatarPlaceholder, isDark && styles.teenAvatarPlaceholderDark]}>
                                <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                              </View>
                            )}
                          </View>
                          <View style={styles.teenInfo}>
                            <Text style={[styles.teenName, textStyle]}>
                              {teenProfile?.full_name || 'Loading...'}
                            </Text>
                            <View style={styles.teenRatingRow}>
                              <View style={styles.teenRatingStars}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Ionicons
                                    key={star}
                                    name={star <= Math.round(teenRating) ? 'star' : 'star-outline'}
                                    size={14}
                                    color="#FBBF24"
                                  />
                                ))}
                              </View>
                              <Text style={[styles.teenRatingText, labelStyle]}>
                                {teenRating > 0 ? teenRating.toFixed(1) : '0.0'} ({teenReviewCount} {teenReviewCount === 1 ? 'review' : 'reviews'})
                              </Text>
                            </View>
                            <Text style={[styles.teenLabel, labelStyle]}>Assigned Teenlancer</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                        {isNeighbor && (
                          <Pressable
                            style={[styles.addReviewButton, isDark && styles.addReviewButtonDark]}
                            onPress={() => {
                              setSelectedTeenForReview(task?.teen_id || null);
                              setShowReviewModal(true);
                            }}
                          >
                            <Ionicons name="star-outline" size={16} color="#73af17" />
                            <Text style={styles.addReviewButtonText}>Review</Text>
                          </Pressable>
                        )}
                      </View>
                    </>
                  )}
                  {task.required_skills && task.required_skills.length > 0 && (
                    <>
                      <View style={[styles.detailDivider, isDark && styles.detailDividerDark]} />
                      <View style={styles.skillsContainer}>
                        <Text style={[styles.label, labelStyle]}>Required Skills:</Text>
                        <View style={styles.skills}>
                        {task.required_skills.map((skill, index) => (
                          <View key={index} style={[styles.skillTag, isDark && styles.skillTagDark]}>
                            <Text style={[styles.skillText, isDark && styles.skillTextDark]}>{skill}</Text>
                          </View>
                        ))}
                        </View>
                      </View>
                    </>
                  )}
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[titleStyle, styles.sectionTitle]}>Location</Text>
                  <View style={[styles.locationContainer, isDark && styles.locationContainerDark]}>
                    <View style={styles.locationInfo}>
                      <Ionicons name="location" size={24} color="#73af17" />
                      <View style={styles.locationTextContainer}>
                        {(() => {
                          const { street, cityStateZip } = formatAddress(task.address);
                          return (
                            <View style={styles.locationAddressContainer}>
                              <Text style={[textStyle, styles.locationAddress]}>{street || task.address}</Text>
                              {cityStateZip ? (
                                <Text style={[textStyle, styles.locationAddress, styles.locationAddressSecondLine]}>{cityStateZip}</Text>
                              ) : null}
                            </View>
                          );
                        })()}
                        <Text style={[labelStyle, styles.locationCoords]}>
                          {task.location.latitude.toFixed(6)}, {task.location.longitude.toFixed(6)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Pressable style={styles.mapButton} onPress={handleOpenMap}>
                    <Ionicons name="navigate" size={20} color="#73af17" />
                    <Text style={[styles.mapButtonText, isDark && styles.mapButtonTextDark]}>
                      Open in Maps
                    </Text>
                  </Pressable>
                </View>

                {isNeighbor && isOpen && (
                  <View style={[styles.section, sectionStyle]}>
                    <Text style={[titleStyle, styles.sectionTitle]}>Applicants ({applicantCount})</Text>
                    {pendingApplications.length > 0 ? (
                      pendingApplications.map((application) => (
                        <View key={application.id} style={[styles.applicationCard, isDark && styles.applicationCardDark]}>
                          <Pressable
                            style={styles.applicationHeader}
                            onPress={() => {
                              setSelectedTeenId(application.teen_id);
                              setShowProfileModal(true);
                            }}
                          >
                            <View style={styles.applicationTeenInfo}>
                              {application.teen_photo ? (
                                <Image
                                  source={{ uri: application.teen_photo }}
                                  style={styles.applicationAvatar}
                                />
                              ) : (
                                <View style={[styles.applicationAvatarPlaceholder, isDark && styles.applicationAvatarPlaceholderDark]}>
                                  <Ionicons name="person" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                                </View>
                              )}
                              <View style={styles.applicationTeenDetails}>
                                <Text style={[styles.applicationTeenName, textStyle]}>
                                  {application.teen_name || 'Unknown'}
                                </Text>
                                <View style={styles.applicationTeenMeta}>
                                  {application.teen_age && (
                                    <Text style={[styles.applicationTeenAge, labelStyle]}>
                                      Age {application.teen_age}
                                    </Text>
                                  )}
                                  <View style={styles.ratingContainer}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <Ionicons
                                        key={star}
                                        name={star <= Math.round(application.teen_rating || 0) ? 'star' : 'star-outline'}
                                        size={14}
                                        color="#F59E0B"
                                        style={styles.starIcon}
                                      />
                                    ))}
                                    <Text style={[styles.applicationTeenRating, labelStyle]}>
                                      {(application.teen_rating || 0).toFixed(1)} ({application.teen_review_count || 0} {application.teen_review_count === 1 ? 'review' : 'reviews'})
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                          </Pressable>
                          {/* Message button for neighbors to message applicants */}
                          {isNeighbor && isOpen && (
                            <View style={[styles.applicationActions, isDark && styles.applicationActionsDark]}>
                              <Button
                                title="Message"
                                onPress={() => router.push(`/chat/${taskId}?recipientId=${application.teen_id}`)}
                                variant="secondary"
                                style={styles.messageButton}
                              />
                            </View>
                          )}
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyApplicationsContainer}>
                        <Text style={[styles.emptyApplicationsText, textStyle]}>
                          No applicants yet. Teenlancers will appear here when they apply.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                <View style={styles.actions}>
                  {(canSave || canApply || hasApplied || (isOpen && isTeenlancer && !isPoster && !isTeen)) && (
                    <View style={styles.actionRow}>
                      {canApply && (
                        <View style={styles.acceptButtonContainer}>
                          <View style={styles.acceptButtonWrapper}>
                            <Button
                              title="Apply"
                              onPress={handleApply}
                              loading={isApplying}
                              fullWidth
                            />
                          </View>
                        </View>
                      )}
                      {hasApplied && (
                        <View style={styles.acceptButtonContainer}>
                          <View style={styles.acceptButtonWrapper}>
                            <Button
                              title="Applied"
                              onPress={() => {}}
                              disabled
                              fullWidth
                            />
                          </View>
                        </View>
                      )}
                      {canSave && (
                        <View style={styles.saveButtonContainer}>
                          <Pressable
                            style={[styles.saveButton, isSaved && styles.saveButtonSaved]}
                            onPress={handleSaveGig}
                            disabled={saveGigMutation.isPending || unsaveGigMutation.isPending}
                          >
                            {saveGigMutation.isPending || unsaveGigMutation.isPending ? (
                              <ActivityIndicator size="small" color="#73af17" />
                            ) : (
                              <>
                                <Ionicons 
                                  name={isSaved ? "heart" : "heart-outline"} 
                                  size={16} 
                                  color="#73af17" 
                                />
                                <Text style={styles.saveButtonText}>
                                  {isSaved ? "Saved" : "Save"}
                                </Text>
                              </>
                            )}
                          </Pressable>
                        </View>
                      )}
                    </View>
                  )}
                  {canStart && (
                    <Button
                      title="Start Gig"
                      onPress={handleStart}
                      loading={startTaskMutation.isPending}
                      fullWidth
                    />
                  )}
                  {canComplete && (
                    <Button
                      title="Mark as Complete"
                      onPress={handleComplete}
                      loading={completeTaskMutation.isPending}
                      fullWidth
                    />
                  )}
                  {/* Chat button for assigned gigs */}
                  {(isPoster || isTeen) && task.teen_id && task.status !== 'completed' && task.status !== 'cancelled' && (
                    <Button
                      title="Chat"
                      onPress={handleChat}
                      variant="primary"
                      fullWidth
                    />
                  )}
                  {/* Leave Review button for teenlancers on completed gigs */}
                  {canReviewNeighbor && canReview.canReview && (
                    <Button
                      title="Leave Review"
                      onPress={() => setShowReviewModal(true)}
                      variant="secondary"
                      fullWidth
                    />
                  )}
                </View>
              </View>
            </ScrollView>
          )}
          
          {/* Floating message bubble for teenlancers viewing open gigs */}
          {isOpen && isTeenlancer && !isPoster && !isTeen && (
            <Pressable 
              style={styles.floatingMessageBubble}
              onPress={handleChat}
            >
              <View style={[styles.floatingMessageContent, isDark && styles.floatingMessageContentDark]}>
                {(() => {
                  if (isLoadingNeighborProfile) {
                    return (
                      <View style={[styles.floatingAvatarPlaceholder, isDark && styles.floatingAvatarPlaceholderDark]}>
                        <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </View>
                    );
                  }
                  if (neighborProfile?.profile_photo_url) {
                    return (
                      <Image
                        source={{ uri: neighborProfile.profile_photo_url }}
                        style={styles.floatingAvatar}
                        onError={(e) => {
                          console.log('Floating avatar load error:', e.nativeEvent.error, 'URL:', neighborProfile.profile_photo_url);
                        }}
                        onLoad={() => {
                          console.log('Floating avatar loaded successfully:', neighborProfile.profile_photo_url);
                        }}
                      />
                    );
                  }
                  return (
                    <View style={[styles.floatingAvatarPlaceholder, isDark && styles.floatingAvatarPlaceholderDark]}>
                      <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                    </View>
                  );
                })()}
                <View style={styles.floatingMessageIcon}>
                  <Ionicons name="chatbubble" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}
          
          {/* Floating message bubble for neighbors viewing assigned gigs (not completed or cancelled) */}
          {isNeighbor && task?.teen_id && task.status !== 'completed' && task.status !== 'cancelled' && (
            <Pressable 
              style={styles.floatingMessageBubble}
              onPress={handleChat}
            >
              <View style={[styles.floatingMessageContent, isDark && styles.floatingMessageContentDark]}>
                {teenProfile?.profile_photo_url ? (
                  <Image
                    source={{ uri: teenProfile.profile_photo_url }}
                    style={styles.floatingAvatar}
                  />
                ) : (
                  <View style={[styles.floatingAvatarPlaceholder, isDark && styles.floatingAvatarPlaceholderDark]}>
                    <Ionicons name="person" size={16} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </View>
                )}
                <View style={styles.floatingMessageIcon}>
                  <Ionicons name="chatbubble" size={16} color="#FFFFFF" />
                </View>
              </View>
            </Pressable>
          )}
        </View>
      </View>
      <CreateGigModal
        visible={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }}
        taskId={taskId}
      />
      <ProfileModal
        visible={showProfileModal}
        userId={selectedTeenId || task?.teen_id || null}
        onClose={() => {
          setShowProfileModal(false);
          setSelectedTeenId(null);
        }}
      />
      <AddReviewModal
        visible={showReviewModal}
        teenlancerId={selectedTeenForReview || (canReviewNeighbor ? undefined : (task?.teen_id || undefined))}
        neighborId={canReviewNeighbor ? task?.poster_id : undefined}
        onClose={() => {
          setShowReviewModal(false);
          setSelectedTeenForReview(null);
          queryClient.invalidateQueries({ queryKey: ['canReviewGig'] });
        }}
        onReviewAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['reviews'] });
          queryClient.invalidateQueries({ queryKey: ['canReviewGig'] });
          queryClient.invalidateQueries({ queryKey: teenStatsKeys.all });
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
    maxHeight: Dimensions.get('window').height,
  },
  overlayPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Dimensions.get('window').height * 0.9,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    flexDirection: 'column',
  },
  modalDark: {
    backgroundColor: '#111827',
  },
  greenHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#73af17',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 5,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 10,
  },
  modalHeaderWithGreen: {
    borderBottomWidth: 0,
  },
  modalHeaderLight: {
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  handleOnGreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalTitleOnGreen: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    flexGrow: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
    paddingVertical: 40,
  },
  loadingContainerDark: {
    backgroundColor: '#111827',
  },
  loadingWrapper: {
    backgroundColor: 'transparent',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    minHeight: 200,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
  },
  errorTextDark: {
    color: '#9CA3AF',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    marginTop: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderDark: {
    backgroundColor: '#1F2937',
  },
  imagePlaceholderText: {
    marginTop: 8,
    fontSize: 14,
  },
  imagePlaceholderTextLight: {
    color: '#6B7280',
  },
  imagePlaceholderTextDark: {
    color: '#9CA3AF',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  editButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    flexShrink: 0,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    flexShrink: 0,
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: 12,
  },
  payLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    flexShrink: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    minWidth: 60,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    minWidth: 50,
    opacity: 1,
  },
  statusTextLight: {
    color: '#000000',
  },
  statusTextDark: {
    color: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  payAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  sectionDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  textDark: {
    color: '#D1D5DB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginTop: 4,
    marginBottom: 12,
  },
  detailDividerDark: {
    backgroundColor: '#374151',
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  schedulingContainer: {
    flex: 1,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  applicantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 0,
  },
  applicantsText: {
    fontSize: 14,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  skillsContainer: {
    marginTop: 12,
  },
  skills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillTagDark: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#FFFFFF',
  },
  locationContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  locationContainerDark: {
    backgroundColor: 'transparent',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  locationAddressContainer: {
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 0,
    lineHeight: 16,
  },
  locationAddressSecondLine: {
    marginTop: 2,
  },
  locationCoords: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  mapButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#73af17',
  },
  mapButtonTextDark: {
    color: '#73af17',
  },
  actions: {
    gap: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    width: '100%',
  },
  acceptButtonContainer: {
    flex: 1,
    minWidth: 0, // Allow flex to work properly
  },
  acceptButtonWrapper: {
    width: '100%',
    minWidth: 0,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#73af17',
    padding: 2, // Inner padding to account for border
    backgroundColor: '#73af17', // Fill the border area
    justifyContent: 'center',
    height: 52, // Fixed height: 48 (button minHeight) + 4 (2px padding top + 2px padding bottom)
  },
  saveButtonContainer: {
    flex: 1,
    minWidth: 0, // Allow flex to work properly
  },
  saveButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#73af17',
    backgroundColor: 'transparent',
    height: 52, // Fixed height to match Apply/Applied buttons (wrapper is 52px: 48px button + 4px padding)
  },
  saveButtonSaved: {
    borderColor: '#73af17',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
    marginLeft: 4,
  },
  containerDark: {
    backgroundColor: '#111827',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  teenInfoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  teenAvatarContainer: {
    marginRight: 0,
  },
  teenAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  teenAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  teenAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  teenInfo: {
    flex: 1,
  },
  teenName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    color: '#374151',
  },
  teenRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  teenRatingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  teenRatingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  teenLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  applicationCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  applicationCardDark: {
    backgroundColor: 'transparent',
    borderColor: '#1F2937',
  },
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  applicationTeenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  applicationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  applicationAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#73af17',
  },
  applicationAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  applicationTeenDetails: {
    flex: 1,
  },
  applicationTeenName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  applicationTeenAge: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 14,
  },
  applicationTeenMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  applicationTeenMetaSeparator: {
    fontSize: 14,
    color: '#6B7280',
    marginHorizontal: 4,
    lineHeight: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 0,
    marginLeft: 0,
    marginTop: 4,
    width: '100%',
  },
  starIcon: {
    marginRight: 2,
  },
  applicationTeenRating: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 14,
    includeFontPadding: false,
  },
  applicationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  applicationActionsDark: {
    borderTopColor: '#374151',
  },
  messageButton: {
    flex: 1,
  },
  thumbsUpButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#73af17',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
  },
  thumbsUpButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#73af17',
  },
  thumbsDownButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
  },
  thumbsDownButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#EF4444',
  },
  thumbsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyApplicationsContainer: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#73af17',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  addReviewButtonDark: {
    backgroundColor: '#1F2937',
    borderColor: '#73af17',
  },
  addReviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#73af17',
  },
  emptyApplicationsText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 20,
  },
  floatingMessageBubble: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 100,
  },
  floatingMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#73af17',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingMessageContentDark: {
    backgroundColor: '#1F2937',
    borderColor: '#73af17',
  },
  floatingAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#73af17',
  },
  floatingAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#73af17',
  },
  floatingAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  floatingMessageIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#73af17',
    alignItems: 'center',
    justifyContent: 'center',
  },
});






