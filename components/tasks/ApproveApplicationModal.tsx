import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Pressable, Platform, Image, Alert, Dimensions } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { TimeRangePicker } from '@/components/ui/TimeRangePicker';
import { GigApplication } from '@/lib/api/gigApplications';
import { Task } from '@/types';
import { formatAddress } from '@/lib/utils';

interface ApproveApplicationModalProps {
  visible: boolean;
  application: GigApplication | null;
  gig: Task | null;
  onClose: () => void;
  onConfirm: (schedulingData: {
    scheduled_date?: string;
    scheduled_start_time?: string;
    scheduled_end_time?: string;
  }) => Promise<void>;
  isApproving?: boolean;
}

export function ApproveApplicationModal({
  visible,
  application,
  gig,
  onClose,
  onConfirm,
  isApproving = false,
}: ApproveApplicationModalProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledStartTime, setScheduledStartTime] = useState<string>('09:00');
  const [scheduledEndTime, setScheduledEndTime] = useState<string>('17:00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [includeScheduling, setIncludeScheduling] = useState(false);

  // Reset state when modal opens/closes
  const handleClose = () => {
    setScheduledDate(null);
    setScheduledStartTime('09:00');
    setScheduledEndTime('17:00');
    setShowDatePicker(false);
    setIncludeScheduling(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!application || !gig) return;

    const schedulingData: {
      scheduled_date?: string;
      scheduled_start_time?: string;
      scheduled_end_time?: string;
    } = {};

    if (includeScheduling && scheduledDate) {
      schedulingData.scheduled_date = scheduledDate.toISOString().split('T')[0];
      if (scheduledStartTime && scheduledEndTime) {
        schedulingData.scheduled_start_time = scheduledStartTime;
        schedulingData.scheduled_end_time = scheduledEndTime;
      }
    }

    try {
      await onConfirm(schedulingData);
      handleClose();
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  const formatTime12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  if (!application || !gig) return null;

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
                Approve Application
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
            nestedScrollEnabled={true}
          >
            {/* Teenlancer Summary */}
            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.teenSummary}>
                {application.teen_photo ? (
                  <Image
                    source={{ uri: application.teen_photo }}
                    style={styles.teenAvatar}
                  />
                ) : (
                  <View style={[styles.teenAvatarPlaceholder, isDark && styles.teenAvatarPlaceholderDark]}>
                    <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                  </View>
                )}
                <View style={styles.teenInfo}>
                  <Text style={[styles.teenName, isDark && styles.teenNameDark]}>
                    {application.teen_name || 'Unknown'}
                  </Text>
                  {application.teen_age && (
                    <Text style={[styles.teenAge, isDark && styles.teenAgeDark]}>
                      Age {application.teen_age}
                    </Text>
                  )}
                  <View style={styles.ratingRow}>
                    <View style={styles.ratingStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= Math.round(application.teen_rating || 0) ? 'star' : 'star-outline'}
                          size={16}
                          color="#FBBF24"
                        />
                      ))}
                    </View>
                    <Text style={[styles.ratingText, isDark && styles.ratingTextDark]}>
                      {(application.teen_rating || 0).toFixed(1)} ({application.teen_review_count || 0} {application.teen_review_count === 1 ? 'review' : 'reviews'})
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Gig Details */}
            <View style={[styles.section, isDark && styles.sectionDark]}>
              <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                Gig Details
              </Text>
              <View style={styles.gigDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="document-text-outline" size={20} color="#73af17" />
                  <Text style={[styles.detailText, isDark && styles.detailTextDark]}>
                    {gig.title}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="cash-outline" size={20} color="#73af17" />
                  <Text style={[styles.detailText, isDark && styles.detailTextDark]}>
                    ${gig.pay.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={20} color="#73af17" />
                  <View style={styles.addressContainer}>
                    {(() => {
                      const { street, cityStateZip } = formatAddress(gig.address);
                      return (
                        <View>
                          <Text style={[styles.detailText, isDark && styles.detailTextDark]}>
                            {street || gig.address}
                          </Text>
                          {cityStateZip && (
                            <Text style={[styles.detailText, isDark && styles.detailTextDark, styles.addressSecondLine]}>
                              {cityStateZip}
                            </Text>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              </View>
            </View>

            {/* Scheduling Section */}
            <View style={[styles.section, isDark && styles.sectionDark]}>
              <View style={styles.schedulingHeader}>
                <Text style={[styles.sectionTitle, isDark && styles.sectionTitleDark]}>
                  Schedule (Optional)
                </Text>
                <Pressable
                  style={styles.toggleButton}
                  onPress={() => setIncludeScheduling(!includeScheduling)}
                >
                  <View style={[styles.toggle, includeScheduling && styles.toggleActive]}>
                    <View style={[styles.toggleThumb, includeScheduling && styles.toggleThumbActive]} />
                  </View>
                </Pressable>
              </View>

              {includeScheduling && (
                <View style={styles.schedulingContent}>
                  {/* Date Picker */}
                  <View style={styles.datePickerContainer}>
                    <Text style={[styles.label, isDark && styles.labelDark]}>Date</Text>
                    <Pressable
                      style={[styles.dateButton, isDark && styles.dateButtonDark]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Text style={[styles.dateButtonText, isDark && styles.dateButtonTextDark]}>
                        {scheduledDate ? scheduledDate.toLocaleDateString() : 'Select Date'}
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
                                  if (scheduledDate) {
                                    setShowDatePicker(false);
                                  }
                                }}
                              >
                                <Text style={styles.doneText}>Done</Text>
                              </Pressable>
                            </View>
                            <DateTimePicker
                              value={scheduledDate || new Date()}
                              mode="date"
                              display="spinner"
                              onChange={(event, selectedDate) => {
                                if (selectedDate) {
                                  setScheduledDate(selectedDate);
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
                      value={scheduledDate || new Date()}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                          setScheduledDate(selectedDate);
                        }
                      }}
                      minimumDate={new Date()}
                    />
                  )}

                  {/* Time Range Picker */}
                  {scheduledDate && (
                    <View style={styles.timePickerContainer}>
                      <Text style={[styles.label, isDark && styles.labelDark]}>Time Range</Text>
                      <TimeRangePicker
                        startValue={scheduledStartTime}
                        endValue={scheduledEndTime}
                        onChange={(start, end) => {
                          setScheduledStartTime(start);
                          setScheduledEndTime(end);
                        }}
                      />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <Button
                title="Cancel"
                onPress={handleClose}
                variant="secondary"
                fullWidth
                style={styles.cancelButton}
              />
              <Button
                title="Confirm Assignment"
                onPress={handleConfirm}
                loading={isApproving}
                fullWidth
                style={styles.confirmButton}
              />
            </View>
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
    height: Dimensions.get('window').height * 0.9,
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
  teenSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  teenAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#73af17',
  },
  teenAvatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#73af17',
  },
  teenAvatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  teenInfo: {
    flex: 1,
  },
  teenName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  teenNameDark: {
    color: '#FFFFFF',
  },
  teenAge: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  teenAgeDark: {
    color: '#9CA3AF',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  ratingTextDark: {
    color: '#9CA3AF',
  },
  gigDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  detailTextDark: {
    color: '#D1D5DB',
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  addressSecondLine: {
    marginTop: 2,
  },
  schedulingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleButton: {
    padding: 4,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleActive: {
    backgroundColor: '#73af17',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  schedulingContent: {
    gap: 16,
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
  actions: {
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    marginBottom: 0,
  },
  confirmButton: {
    marginBottom: 0,
  },
});

