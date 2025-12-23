import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

interface TimeRangePickerProps {
  startValue: string; // 24-hour format "HH:MM"
  endValue: string; // 24-hour format "HH:MM"
  onChange: (start: string, end: string) => void; // Returns both times in 24-hour format
  label?: string;
}

// Helper to convert 24-hour to Date object
const timeToDate = (time24: string): Date => {
  const [hours, minutes] = time24.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
};

// Helper to convert Date to 24-hour string
const dateToTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Helper to convert 24-hour to 12-hour display
const convertTo12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export function TimeRangePicker({ startValue, endValue, onChange, label }: TimeRangePickerProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showPicker, setShowPicker] = useState(false);
  const [isSelectingStart, setIsSelectingStart] = useState(true);
  const [tempStartDate, setTempStartDate] = useState(timeToDate(startValue || '09:00'));
  const [tempEndDate, setTempEndDate] = useState(timeToDate(endValue || '17:00'));

  const handleConfirm = () => {
    const start24 = dateToTime(tempStartDate);
    const end24 = dateToTime(tempEndDate);
    
    // Ensure end time is after start time
    if (tempEndDate <= tempStartDate) {
      // If end is before or equal to start, set end to 1 hour after start
      const adjustedEnd = new Date(tempStartDate);
      adjustedEnd.setHours(adjustedEnd.getHours() + 1);
      onChange(start24, dateToTime(adjustedEnd));
    } else {
      onChange(start24, end24);
    }
    setShowPicker(false);
  };

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (selectedDate) {
        if (isSelectingStart) {
          setTempStartDate(selectedDate);
          setIsSelectingStart(false);
        } else {
          setTempEndDate(selectedDate);
          setShowPicker(false);
          handleConfirm();
        }
      }
    } else {
      if (selectedDate) {
        if (isSelectingStart) {
          setTempStartDate(selectedDate);
        } else {
          setTempEndDate(selectedDate);
        }
      }
    }
  };

  const handleStartPress = () => {
    setIsSelectingStart(true);
    setShowPicker(true);
  };

  const handleEndPress = () => {
    setIsSelectingStart(false);
    setShowPicker(true);
  };

  const displayValue = `${convertTo12Hour(startValue || '09:00')} - ${convertTo12Hour(endValue || '17:00')}`;

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, isDark && styles.labelDark]}>{label}</Text>}
      <Pressable
        style={[styles.timeButton, isDark && styles.timeButtonDark]}
        onPress={() => {
          setIsSelectingStart(true);
          setShowPicker(true);
        }}
      >
        <Text style={[styles.timeText, isDark && styles.timeTextDark]}>
          {displayValue}
        </Text>
        <Ionicons name="time-outline" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
      </Pressable>

      {Platform.OS === 'ios' && showPicker && (
        <Modal
          visible={showPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContent, isDark && styles.modalContentDark]}>
                <View style={styles.modalHeader}>
                  <Pressable onPress={() => setShowPicker(false)}>
                    <Text style={[styles.cancelText, isDark && styles.cancelTextDark]}>Cancel</Text>
                  </Pressable>
                  <Text style={[styles.modalTitle, isDark && styles.modalTitleDark]}>
                    {isSelectingStart ? 'Select Start Time' : 'Select End Time'}
                  </Text>
                  <Pressable onPress={() => {
                    if (isSelectingStart) {
                      setIsSelectingStart(false);
                    } else {
                      handleConfirm();
                    }
                  }}>
                    <Text style={styles.doneText}>{isSelectingStart ? 'Next' : 'Done'}</Text>
                  </Pressable>
                </View>
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={isSelectingStart ? tempStartDate : tempEndDate}
                    mode="time"
                    display="spinner"
                    onChange={handleChange}
                    textColor={isDark ? '#FFFFFF' : '#000000'}
                  />
                </View>
                {!isSelectingStart && (
                  <View style={styles.timeDisplay}>
                    <Text style={[styles.timeDisplayLabel, isDark && styles.timeDisplayLabelDark]}>
                      Start: {convertTo12Hour(dateToTime(tempStartDate))}
                    </Text>
                    <Pressable 
                      style={styles.changeButton}
                      onPress={() => setIsSelectingStart(true)}
                    >
                      <Text style={styles.changeButtonText}>Change Start</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={isSelectingStart ? tempStartDate : tempEndDate}
          mode="time"
          display="default"
          onChange={handleChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 220,
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
  timeButton: {
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
  timeButtonDark: {
    borderColor: '#374151',
    backgroundColor: '#111827',
  },
  timeText: {
    fontSize: 16,
    color: '#111827',
  },
  timeTextDark: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalContentDark: {
    backgroundColor: '#111111',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cancelText: {
    fontSize: 16,
    color: '#6B7280',
  },
  cancelTextDark: {
    color: '#9CA3AF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalTitleDark: {
    color: '#FFFFFF',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#73af17',
  },
  pickerContainer: {
    paddingVertical: 20,
  },
  timeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  timeDisplayLabel: {
    fontSize: 16,
    color: '#374151',
  },
  timeDisplayLabelDark: {
    color: '#D1D5DB',
  },
  changeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  changeButtonText: {
    fontSize: 14,
    color: '#73af17',
    fontWeight: '500',
  },
});
















