import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, Pressable, Linking, Platform, Modal, Dimensions, ActivityIndicator } from 'react-native';
import { useTask, useStartTask, useCompleteTask, useIsGigSaved, useSaveGig, useUnsaveGig } from '@/hooks/useTasks';
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
import { getPublicUserProfile } from '@/lib/api/users';
import { useGigApplications, useHasAppliedForGig, useApproveGigApplication, useRejectGigApplication } from '@/hooks/useGigApplications';

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedTeenId, setSelectedTeenId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  
  // Check if gig is saved (only for teenlancers)
  const { data: isSaved = false } = useIsGigSaved(taskId);
  const saveGigMutation = useSaveGig();
  const unsaveGigMutation = useUnsaveGig();
  
  // Check if teen has already applied
  const { data: hasApplied = false } = useHasAppliedForGig(taskId);
  
  // Get applications for this gig (for neighbors)
  const { data: applications = [] } = useGigApplications(isNeighbor ? taskId : null);
  const approveMutation = useApproveGigApplication();
  const rejectMutation = useRejectGigApplication();

  // Fetch teenlancer profile if gig is assigned
  const { data: teenProfile } = useQuery({
    queryKey: ['teenProfile', task?.teen_id],
    queryFn: () => getPublicUserProfile(task!.teen_id!),
    enabled: !!task?.teen_id,
    staleTime: 300000, // 5 minutes
  });

  const isPoster = task ? user?.id === task.poster_id : false;
  const isTeen = task ? (task.teen_id ? user?.id === task.teen_id : false) : false;
  const isTeenlancer = user?.role === 'teen';
  const isNeighbor = user?.role === 'poster';
  const isOpen = task?.status === 'open';
  const canApply = task && isOpen && !isPoster && !isTeen && isTeenlancer && !hasApplied;
  const canStart = task && isTeen && task.status === 'accepted';
  const canComplete = task && isTeen && task.status === 'in_progress';
  const canEdit = task && isPoster && isNeighbor && ['open', 'cancelled'].includes(task.status);
  const canSave = task && isOpen && isTeenlancer && !isPoster && !isTeen;
  const pendingApplications = applications.filter(app => app.status === 'pending');

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
          onPress: async (reason) => {
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
    onClose();
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
            <View style={styles.loadingContainer}>
              <Loading />
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
            >
              {task.photos && task.photos.length > 0 && (
                <View style={styles.imageContainer}>
                  <Image 
                    source={{ uri: task.photos[0] }} 
                    style={styles.image}
                    resizeMode="cover"
                  />
                </View>
              )}

              <View style={styles.content}>
                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, titleStyle]}>{task.title}</Text>
                    {canEdit && (
                      <Pressable 
                        style={styles.editButton}
                        onPress={() => setShowEditModal(true)}
                      >
                        <Ionicons name="create-outline" size={18} color="#73af17" />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>
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
                        Applicants ({pendingApplications.length})
                      </Text>
                    </View>
                  )}
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Description</Text>
                  <Text style={[styles.description, textStyle]}>{task.description}</Text>
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Details</Text>
                  {task.estimated_hours && (
                    <View style={styles.detailRow}>
                      <Ionicons name="time" size={20} color="#73af17" />
                      <Text style={[styles.detailText, textStyle]}>
                        Estimated: {task.estimated_hours} hours
                      </Text>
                    </View>
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
                          <Text style={[styles.teenLabel, labelStyle]}>Assigned Teenlancer</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                    </View>
                  )}
                  {task.required_skills && task.required_skills.length > 0 && (
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
                  )}
                </View>

                <View style={[styles.section, sectionStyle]}>
                  <Text style={[styles.sectionTitle, titleStyle]}>Location</Text>
                  <View style={[styles.locationContainer, isDark && styles.locationContainerDark]}>
                    <View style={styles.locationInfo}>
                      <Ionicons name="location" size={24} color="#73af17" />
                      <View style={styles.locationTextContainer}>
                        {(() => {
                          const { street, cityStateZip } = formatAddress(task.address);
                          return (
                            <View>
                              <Text style={[styles.locationAddress, textStyle]}>{street || task.address}</Text>
                              {cityStateZip ? (
                                <Text style={[styles.locationAddress, textStyle]}>{cityStateZip}</Text>
                              ) : null}
                            </View>
                          );
                        })()}
                        <Text style={[styles.locationCoords, labelStyle]}>
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

                {isNeighbor && isOpen && pendingApplications.length > 0 && (
                  <View style={[styles.section, sectionStyle]}>
                    <Text style={[styles.sectionTitle, titleStyle]}>Applications ({pendingApplications.length})</Text>
                    {pendingApplications.map((application) => (
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
                              {application.teen_age && (
                                <Text style={[styles.applicationTeenAge, labelStyle]}>
                                  Age {application.teen_age}
                                </Text>
                              )}
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                        </Pressable>
                        <View style={styles.applicationActions}>
                          <Pressable
                            style={[styles.approveButton, isDark && styles.approveButtonDark]}
                            onPress={() => handleApproveApplication(application.id)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <ActivityIndicator size="small" color="#73af17" />
                            ) : (
                              <Text style={styles.approveButtonText}>Approve</Text>
                            )}
                          </Pressable>
                          <Pressable
                            style={[styles.rejectButton, isDark && styles.rejectButtonDark]}
                            onPress={() => handleRejectApplication(application.id)}
                            disabled={rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? (
                              <ActivityIndicator size="small" color="#EF4444" />
                            ) : (
                              <Text style={[styles.rejectButtonText, isDark && styles.rejectButtonTextDark]}>Reject</Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.actions}>
                  {(canSave || canApply || hasApplied) && (
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
                  {(isPoster || isTeen) && task.status !== 'completed' && task.status !== 'cancelled' && (
                    <Button
                      title="Chat"
                      onPress={handleChat}
                      variant="primary"
                      fullWidth
                    />
                  )}
                </View>
              </View>
            </ScrollView>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    backgroundColor: '#000000',
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
    zIndex: 0,
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    position: 'relative',
    zIndex: 1,
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
    fontSize: 20,
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
  },
  scrollContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
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
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
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
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(115, 175, 23, 0.1)',
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
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#73af17',
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
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  payAmount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  sectionDark: {
    backgroundColor: '#1F2937',
  },
  sectionTitle: {
    fontSize: 16,
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
    marginBottom: 8,
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
    backgroundColor: '#1E3A8A',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#73af17',
  },
  skillTextDark: {
    color: '#93C5FD',
  },
  locationContainer: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  locationContainerDark: {
    backgroundColor: '#374151',
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
  locationAddress: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
    color: '#000000',
  },
  locationCoords: {
    fontSize: 12,
    color: '#6B7280',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#73af17',
    backgroundColor: 'transparent',
    minHeight: 48, // Match Button component default height
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
    backgroundColor: '#000000',
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
    marginBottom: 2,
    color: '#374151',
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
    backgroundColor: '#111827',
    borderColor: '#374151',
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
  },
  applicationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#73af17',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  approveButtonDark: {
    backgroundColor: '#73af17',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  rejectButtonDark: {
    backgroundColor: 'transparent',
    borderColor: '#EF4444',
  },
  rejectButtonText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectButtonTextDark: {
    color: '#EF4444',
  },
});





