import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Ionicons } from '@expo/vector-icons';

export type DateFilterOption = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'last-6-months' | 'last-year' | 'all-time';

interface DateFilterProps {
  value: DateFilterOption;
  onChange: (value: DateFilterOption) => void;
}

const DATE_OPTIONS: { value: DateFilterOption; label: string }[] = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'last-6-months', label: 'Last 6 Months' },
  { value: 'last-year', label: 'Last Year' },
  { value: 'all-time', label: 'All Time' },
];

export function DateFilter({ value, onChange }: DateFilterProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showModal, setShowModal] = useState(false);

  const selectedLabel = DATE_OPTIONS.find(opt => opt.value === value)?.label || 'All Time';
  const isActive = value !== 'all-time';

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const buttonStyle = isDark ? styles.buttonDark : styles.buttonLight;
  const buttonTextStyle = isDark ? styles.buttonTextDark : styles.buttonTextLight;
  const modalStyle = isDark ? styles.modalDark : styles.modalLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const optionTextStyle = isDark ? styles.optionTextDark : styles.optionTextLight;

  const handleSelect = (option: DateFilterOption) => {
    onChange(option);
    setShowModal(false);
  };

  return (
    <>
      <Pressable
        style={[styles.filterButton, buttonStyle, isActive && styles.filterButtonActive]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons
          name="options"
          size={18}
          color={isActive ? '#73af17' : (isDark ? '#D1D5DB' : '#374151')}
        />
        <Text style={[styles.filterButtonText, isActive && { color: '#73af17' }, !isActive && buttonTextStyle]}>
          {selectedLabel}
        </Text>
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, modalStyle]}>
            <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, titleStyle]}>Select Time Range</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              {DATE_OPTIONS.map((option) => {
                const isSelected = value === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.optionItem,
                      isSelected && styles.optionItemSelected,
                      isDark && styles.optionItemDark,
                      isSelected && isDark && styles.optionItemSelectedDark,
                    ]}
                    onPress={() => handleSelect(option.value)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSelected && styles.optionTextSelected,
                        !isSelected && optionTextStyle,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  filterButtonActive: {
    // No background or border when active
  },
  buttonLight: {
    // No background or border
  },
  buttonDark: {
    // No background or border
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  buttonTextLight: {
    color: '#374151',
  },
  buttonTextDark: {
    color: '#D1D5DB',
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#1F2937',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  modalLight: {
    backgroundColor: '#FFFFFF',
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderDark: {
    borderBottomColor: '#374151',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  titleLight: {
    color: '#111827',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  modalBody: {
    padding: 20,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F3F4F6',
  },
  optionItemSelected: {
    backgroundColor: '#73af17',
  },
  optionItemDark: {
    backgroundColor: '#374151',
  },
  optionItemSelectedDark: {
    backgroundColor: '#73af17',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  optionTextLight: {
    color: '#374151',
  },
  optionTextDark: {
    color: '#D1D5DB',
  },
});
