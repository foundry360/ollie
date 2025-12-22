import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { useState } from 'react';
import { useThemeStore } from '@/stores/themeStore';
import { Input } from '@/components/ui/Input';
import { Ionicons } from '@expo/vector-icons';
import { TeenlancerFilters as TeenlancerFiltersType } from '@/lib/api/users';

const renderStar = (rating: number) => {
  return (
    <Ionicons
      name="star"
      size={12}
      color="#F59E0B"
    />
  );
};

interface TeenlancerFiltersProps {
  filters: TeenlancerFiltersType;
  onFiltersChange: (filters: TeenlancerFiltersType) => void;
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

const RADIUS_OPTIONS = [25, 50, 75, 100, 150, 200];
const RATING_OPTIONS = [3.0, 3.5, 4.0, 4.5, 5.0];

export function TeenlancerFilters({ filters, onFiltersChange }: TeenlancerFiltersProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showModal, setShowModal] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  const applyFilters = () => {
    onFiltersChange(localFilters);
    setShowModal(false);
  };

  const clearFilters = () => {
    const cleared = {
      minRating: undefined,
      skills: [],
      radius: undefined,
      searchTerm: undefined,
    };
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

  const hasActiveFilters =
    filters.minRating ||
    (filters.skills && filters.skills.length > 0) ||
    filters.radius ||
    filters.searchTerm;

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
          name="options"
          size={18}
          color={hasActiveFilters ? '#73af17' : (isDark ? '#D1D5DB' : '#374151')}
        />
        {hasActiveFilters ? (
          <Text style={[styles.filterButtonText, { color: '#73af17' }]}>
            {(() => {
              const filterCount =
                (filters.skills?.length || 0) +
                (filters.minRating ? 1 : 0) +
                (filters.radius ? 1 : 0) +
                (filters.searchTerm ? 1 : 0);
              return `${filterCount} ${filterCount === 1 ? 'filter' : 'filters'}`;
            })()}
          </Text>
        ) : (
          <Text style={[styles.filterButtonText, buttonTextStyle]}>
            All
          </Text>
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
            <View style={[styles.modalHeader, isDark && styles.modalHeaderDark]}>
              <Text style={[styles.modalTitle, titleStyle]}>Filter Teenlancers</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={isDark ? '#FFFFFF' : '#111827'} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, titleStyle]}>Minimum Rating</Text>
                <View style={styles.ratingGrid}>
                  {RATING_OPTIONS.map((rating) => {
                    const isSelected = localFilters.minRating === rating;
                    return (
                      <Pressable
                        key={rating}
                        style={[
                          styles.ratingChip,
                          isSelected && styles.ratingChipSelected,
                          isDark && styles.ratingChipDark,
                          isSelected && isDark && styles.ratingChipSelectedDark,
                        ]}
                        onPress={() => {
                          setLocalFilters({
                            ...localFilters,
                            minRating: isSelected ? undefined : rating,
                          });
                        }}
                      >
                        <View style={styles.ratingChipContent}>
                          <Text
                            style={[
                              styles.ratingChipText,
                              isSelected && styles.ratingChipTextSelected,
                              isDark && !isSelected && styles.ratingChipTextDark,
                            ]}
                          >
                            {rating}+
                          </Text>
                          {renderStar(rating)}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, titleStyle]}>Distance Radius</Text>
                <View style={styles.radiusGrid}>
                  {RADIUS_OPTIONS.map((radius) => {
                    const isSelected = localFilters.radius === radius;
                    return (
                      <Pressable
                        key={radius}
                        style={[
                          styles.radiusChip,
                          isSelected && styles.radiusChipSelected,
                          isDark && styles.radiusChipDark,
                          isSelected && isDark && styles.radiusChipSelectedDark,
                        ]}
                        onPress={() => {
                          setLocalFilters({
                            ...localFilters,
                            radius: isSelected ? undefined : radius,
                          });
                        }}
                      >
                        <Text
                          style={[
                            styles.radiusChipText,
                            isSelected && styles.radiusChipTextSelected,
                            isDark && !isSelected && styles.radiusChipTextDark,
                          ]}
                        >
                          {radius} mi
                        </Text>
                      </Pressable>
                    );
                  })}
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

            <View style={[styles.modalFooter, isDark && styles.modalFooterDark]}>
              <Pressable
                style={[styles.footerButton, styles.clearButton, isDark && styles.clearButtonDark]}
                onPress={clearFilters}
              >
                <Text style={[styles.clearButtonText, isDark && styles.clearButtonTextDark]}>Clear</Text>
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
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#1F2937',
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
    borderBottomColor: '#1F2937',
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
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ratingChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  ratingChipSelected: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  ratingChipDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  ratingChipSelectedDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  ratingChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  ratingChipTextSelected: {
    color: '#FFFFFF',
  },
  ratingChipTextDark: {
    color: '#D1D5DB',
  },
  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  radiusChipSelected: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  radiusChipDark: {
    backgroundColor: '#111827',
    borderColor: '#1F2937',
  },
  radiusChipSelectedDark: {
    backgroundColor: '#73af17',
    borderColor: '#73af17',
  },
  radiusChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  radiusChipTextSelected: {
    color: '#FFFFFF',
  },
  radiusChipTextDark: {
    color: '#D1D5DB',
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
    backgroundColor: '#111827',
    borderColor: '#1F2937',
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
  modalFooterDark: {
    borderTopColor: '#1F2937',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  clearButtonDark: {
    borderColor: '#1F2937',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  clearButtonTextDark: {
    color: '#D1D5DB',
  },
  applyButton: {
    backgroundColor: '#73af17',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  containerLight: {
    backgroundColor: 'transparent',
  },
  containerDark: {
    backgroundColor: 'transparent',
  },
});



