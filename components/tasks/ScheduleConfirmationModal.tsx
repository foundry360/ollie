import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, Platform, Dimensions } from 'react-native';
import { Alert } from '@/components/ui/Alert';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { TimeRangePicker } from '@/components/ui/TimeRangePicker';
import { Task } from '@/types';
import { useConfirmSchedule, useProposeSchedule } from '@/hooks/useTasks';

interface ScheduleConfirmationModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
}

export function ScheduleConfirmationModal({
  visible,
  task,
  onClose,
}: ScheduleConfirmationModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [action, setAction] = useState<'confirm' | 'propose' | null>(null);
  const [proposedDate, setProposedDate] = useState<Date | null>(null);
  const [proposedStartTime, setProposedStartTime] = useState<string>('09:00');
  const [proposedEndTime, setProposedEndTime] = useState<string>('17:00');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const confirmScheduleMutation = useConfirmSchedule();
  const proposeScheduleMutation = useProposeSchedule();

  // Reset state when modal opens/closes
  const handleClose = () => {
    setAction(null);
    setProposedDate(null);
    setProposedStartTime('09:00');
    setProposedEndTime('17:00');
    setShowDatePicker(false);
    onClose();
  };

  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleConfirmSchedule = async () => {
    if (!task) return;

    try {
      await confirmScheduleMutation.mutateAsync(task.id);
      Alert.alert('Success', 'Schedule confirmed!');
      handleClose();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to confirm schedule');
    }
  };

  const handleProposeSchedule = async () => {
    if (!task || !proposedDate) {
      Alert.alert('Error', 'Please select a date for your proposed schedule');
      return;
    }

    try {
      await proposeScheduleMutation.mutateAsync({
        taskId: task.id,
        schedule: {
          proposed_scheduled_date: proposedDate.toISOString().split('T')[0],
          proposed_scheduled_start_time: proposedStartTime,
          proposed_scheduled_end_time: proposedEndTime,
        },
      });
      Alert.alert('Success', 'Schedule proposal sent to the neighbor!');
      handleClose();
      // The mutation hook should invalidate queries, but we'll also refresh the parent
      // by closing the modal which should trigger a refetch
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to propose schedule');
    }
  };

  if (!task) return null;

  const hasSchedule = task.scheduled_date;
  const isConfirmed = task.schedule_confirmed;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.overlayPressable} onPress={handleClose} />
        <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
          <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                Schedule Confirmation
              </Text>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
              </Pressable>
            </View>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Current Schedule Display */}
            {hasSchedule && (
              <View style={[styles.section, isDark && styles.sectionDark]}>
                <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                  Proposed Schedule
                </Text>
                <View style={styles.scheduleDisplay}>
                  <View style={styles.scheduleRow}>
                    <Ionicons name="calendar-outline" size={20} color="#73af17" />
                    <Text style={[styles.scheduleText, isDark && styles.scheduleTextDark]}>
                      {formatDate(task.scheduled_date!)}
                    </Text>
                  </View>
                  {task.scheduled_start_time && task.scheduled_end_time && (
                    <View style={styles.scheduleRow}>
                      <Ionicons name="time-outline" size={20} color="#73af17" />
                      <Text style={[styles.scheduleText, isDark && styles.scheduleTextDark]}>
                        {formatTime12Hour(task.scheduled_start_time)} - {formatTime12Hour(task.scheduled_end_time)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Confirmation Status */}
            {hasSchedule && isConfirmed && (
              <View style={[styles.section, styles.confirmedSection, isDark && styles.sectionDark]}>
                <View style={styles.confirmedRow}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={[styles.confirmedText, isDark && styles.confirmedTextDark]}>
                    Schedule Confirmed
                  </Text>
                </View>
              </View>
            )}

            {/* Action Buttons */}
            {hasSchedule && !isConfirmed && (
              <View style={styles.actions}>
                {action === null && (
                  <>
                    <Button
                      title="Confirm Schedule"
                      onPress={() => setAction('confirm')}
                      fullWidth
                      style={styles.confirmButton}
                    />
                    <Button
                      title="Propose Different Time"
                      onPress={() => setAction('propose')}
                      variant="secondary"
                      fullWidth
                      style={styles.proposeButton}
                    />
                  </>
                )}

                {action === 'confirm' && (
                  <View style={styles.confirmAction}>
                    <Text style={[styles.actionTitle, isDark && styles.actionTitleDark]}>
                      Confirm this schedule?
                    </Text>
                    <Text style={[styles.actionDescription, isDark && styles.actionDescriptionDark]}>
                      This will confirm the proposed schedule with the neighbor.
                    </Text>
                    <View style={styles.actionButtons}>
                      <Button
                        title="Cancel"
                        onPress={() => setAction(null)}
                        variant="secondary"
                        style={styles.cancelActionButton}
                      />
                      <Button
                        title="Confirm"
                        onPress={handleConfirmSchedule}
                        loading={confirmScheduleMutation.isPending}
                        style={styles.submitActionButton}
                      />
                    </View>
                  </View>
                )}

                {action === 'propose' && (
                  <View style={styles.proposeAction}>
                    <Text style={[styles.actionTitle, isDark && styles.actionTitleDark]}>
                      Propose Alternative Schedule
                    </Text>
                    <Text style={[styles.actionDescription, isDark && styles.actionDescriptionDark]}>
                      Suggest a different date and time that works better for you.
                    </Text>

                    {/* Date Picker */}
                    <View style={styles.datePickerContainer}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>Date</Text>
                      <Pressable
                        style={[styles.dateButton, isDark && styles.dateButtonDark]}
                        onPress={() => setShowDatePicker(true)}
                      >
                        <Text style={[styles.dateButtonText, isDark && styles.dateButtonTextDark]}>
                          {proposedDate ? proposedDate.toLocaleDateString() : 'Select Date'}
                        </Text>
                        <Ionicons name="calendar-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </Pressable>
                    </View>

                    {/* Date Picker Modal (iOS) */}
                    {Platform.OS === 'ios' && showDatePicker && (
                      <Modal
                        visible={showDatePicker}
                        transparent
                        animationType="slide"
                        onRequestClose={() => setShowDatePicker(false)}
                      >
                        <Pressable 
                          style={styles.datePickerOverlay} 
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Pressable onPress={(e) => e.stopPropagation()}>
                            <View style={[styles.datePickerModal, isDark && styles.datePickerModalDark]}>
                              <View style={[styles.datePickerModalHeader, isDark && styles.datePickerModalHeaderDark]}>
                                <Pressable onPress={() => setShowDatePicker(false)}>
                                  <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
                                </Pressable>
                                <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>Select Date</Text>
                                <Pressable
                                  onPress={() => {
                                    if (proposedDate) {
                                      setShowDatePicker(false);
                                    }
                                  }}
                                >
                                  <Text style={styles.doneText}>Done</Text>
                                </Pressable>
                              </View>
                              <DateTimePicker
                                value={proposedDate || new Date()}
                                mode="date"
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                  if (selectedDate) {
                                    setProposedDate(selectedDate);
                                  }
                                }}
                                minimumDate={new Date()}
                                textColor={isDark ? '#FFFFFF' : '#000000'}
                              />
                            </View>
                          </Pressable>
                        </Pressable>
                      </Modal>
                    )}

                    {/* Date Picker (Android) */}
                    {Platform.OS === 'android' && showDatePicker && (
                      <DateTimePicker
                        value={proposedDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                          setShowDatePicker(false);
                          if (selectedDate) {
                            setProposedDate(selectedDate);
                          }
                        }}
                        minimumDate={new Date()}
                      />
                    )}

                    {/* Time Range Picker */}
                    {proposedDate && (
                      <View style={styles.timePickerContainer}>
                        <Text style={[styles.label, isDark && styles.labelDark]}>Time Range</Text>
                        <TimeRangePicker
                          startValue={proposedStartTime}
                          endValue={proposedEndTime}
                          onChange={(start, end) => {
                            setProposedStartTime(start);
                            setProposedEndTime(end);
                          }}
                        />
                      </View>
                    )}

                    <View style={styles.actionButtons}>
                      <Button
                        title="Cancel"
                        onPress={() => setAction(null)}
                        variant="secondary"
                        style={styles.cancelActionButton}
                      />
                      <Button
                        title="Send Proposal"
                        onPress={handleProposeSchedule}
                        loading={proposeScheduleMutation.isPending}
                        disabled={!proposedDate}
                        style={styles.submitActionButton}
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* No Schedule Set */}
            {!hasSchedule && (
              <View style={[styles.section, isDark && styles.sectionDark]}>
                <Text style={[styles.noScheduleText, isDark && styles.noScheduleTextDark]}>
                  No schedule has been set for this gig yet. You can start working whenever you're ready.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: Dimensions.get('window').height * 0.8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  modalContentDark: {
    backgroundColor: '#111827',
  },
  modalHeader: {
    paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
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
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
  },
  sectionTitleDark: {
    color: '#FFFFFF',
  },
  scheduleDisplay: {
    gap: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleText: {
    fontSize: 16,
    color: '#374151',
  },
  scheduleTextDark: {
    color: '#D1D5DB',
  },
  confirmedSection: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
  },
  confirmedTextDark: {
    color: '#10B981',
  },
  actions: {
    gap: 12,
  },
  confirmButton: {
    marginBottom: 0,
  },
  proposeButton: {
    marginBottom: 0,
  },
  confirmAction: {
    gap: 16,
  },
  proposeAction: {
    gap: 16,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  actionTitleDark: {
    color: '#FFFFFF',
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionDescriptionDark: {
    color: '#9CA3AF',
  },
  datePickerContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  labelDark: {
    color: '#D1D5DB',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  dateButtonDark: {
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  dateButtonTextDark: {
    color: '#FFFFFF',
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  datePickerModalDark: {
    backgroundColor: '#111827',
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerModalHeaderDark: {
    borderBottomColor: '#374151',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  cancelTextDark: {
    color: '#9CA3AF',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
  },
  timePickerContainer: {
    gap: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelActionButton: {
    flex: 1,
  },
  submitActionButton: {
    flex: 1,
  },
  noScheduleText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  noScheduleTextDark: {
    color: '#9CA3AF',
  },
});

