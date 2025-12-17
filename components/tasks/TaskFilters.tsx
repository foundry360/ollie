import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';

interface TaskFiltersProps {
  filters: {
    minPay?: number;
    maxPay?: number;
    skills?: string[];
  };
  onFiltersChange: (filters: {
    minPay?: number;
    maxPay?: number;
    skills?: string[];
  }) => void;
}

const COMMON_SKILLS = [
  'Yard Work',
  'Pet Care',
  'Babysitting',
  'Tutoring',
  'Cleaning',
  'Moving',
  'Tech Help',
  'Cooking',
  'Delivery',
  'Other',
];

export function TaskFilters({ filters, onFiltersChange }: TaskFiltersProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showModal, setShowModal] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setShowModal(false);
  };

  const clearFilters = () => {
    const cleared = { minPay: undefined, maxPay: undefined, skills: [] };
    setLocalFilters(cleared);
    onFiltersChange(cleared);
    setShowModal(false);
  };

  const toggleSkill = (skill: string) => {
    const currentSkills = localFilters.skills || [];
    const newSkills = currentSkills.includes(skill)
      ? currentSkills.filter(s => s !== skill)
      : [...currentSkills, skill];
    setLocalFilters({ ...localFilters, skills: newSkills });
  };

  const hasActiveFilters = filters.minPay || filters.maxPay || (filters.skills && filters.skills.length > 0);

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const buttonStyle = isDark ? styles.buttonDark : styles.buttonLight;
  const buttonTextStyle = isDark ? styles.buttonTextDark : styles.buttonTextLight;
  const modalStyle = isDark ? styles.modalDark : styles.modalLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;

  return (
    <>
      <Pressable
        style={[styles.filterButton, buttonStyle, hasActiveFilters && styles.filterButtonActive]}
        onPress={() => setShowModal(true)}
      >
        <Ionicons
          name="filter"
          size={20}
          color={hasActiveFilters ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151')}
        />
        <Text style={[styles.filterButtonText, hasActiveFilters && styles.filterButtonTextActive]}>
          Filters
        </Text>
        {hasActiveFilters && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {(filters.skills?.length || 0) + (filters.minPay ? 1 : 0) + (filters.maxPay ? 1 : 0)}
            </Text>
          </View>
        )}
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, modalStyle]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, titleStyle]}>Filter Gigs</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, titleStyle]}>Pay Range</Text>
                <View style={styles.payRange}>
                  <View style={styles.payInput}>
                    <Input
                      label="Min Pay ($)"
                      value={localFilters.minPay?.toString() || ''}
                      onChangeText={(text) => {
                        const num = text ? parseFloat(text) : undefined;
                        setLocalFilters({ ...localFilters, minPay: num });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="0"
                    />
                  </View>
                  <View style={styles.payInput}>
                    <Input
                      label="Max Pay ($)"
                      value={localFilters.maxPay?.toString() || ''}
                      onChangeText={(text) => {
                        const num = text ? parseFloat(text) : undefined;
                        setLocalFilters({ ...localFilters, maxPay: num });
                      }}
                      keyboardType="decimal-pad"
                      placeholder="1000"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, titleStyle]}>Skills</Text>
                <View style={styles.skillsGrid}>
                  {COMMON_SKILLS.map((skill) => {
                    const isSelected = localFilters.skills?.includes(skill);
                    return (
                      <Pressable
                        key={skill}
                        style={[
                          styles.skillChip,
                          isSelected && styles.skillChipSelected,
                          isDark && styles.skillChipDark,
                          isSelected && isDark && styles.skillChipSelectedDark,
                        ]}
                        onPress={() => toggleSkill(skill)}
                      >
                        <Text
                          style={[
                            styles.skillChipText,
                            isSelected && styles.skillChipTextSelected,
                            isDark && !isSelected && styles.skillChipTextDark,
                          ]}
                        >
                          {skill}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.footerButton, styles.clearButton]}
                onPress={clearFilters}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.footerButton, styles.applyButton]}
                onPress={applyFilters}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
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
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterButtonActive: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  buttonLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#D1D5DB',
  },
  buttonDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#73af17',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  payRange: {
    flexDirection: 'row',
    gap: 12,
  },
  payInput: {
    flex: 1,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  skillChipSelected: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillChipDark: {
    backgroundColor: '#374151',
    borderColor: '#4B5563',
  },
  skillChipSelectedDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  skillChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  skillChipTextSelected: {
    color: '#FFFFFF',
  },
  skillChipTextDark: {
    color: '#D1D5DB',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#F3F4F6',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  applyButton: {
    backgroundColor: '#73af17',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

