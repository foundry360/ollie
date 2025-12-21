import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { TeenlancerProfile } from '@/lib/api/users';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ProfileModal } from '@/components/profile/ProfileModal';

interface TeenlancerCardProps {
  teenlancer: TeenlancerProfile;
  onPress?: (teenlancerId: string) => void;
}

export function TeenlancerCard({ teenlancer, onPress }: TeenlancerCardProps) {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handlePress = () => {
    if (onPress) {
      onPress(teenlancer.id);
    } else {
      setShowProfileModal(true);
    }
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const bioStyle = isDark ? styles.bioDark : styles.bioLight;

  // Render stars for rating
  const renderStars = () => {
    const stars = [];
    const rating = Math.round(teenlancer.rating);
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color="#F59E0B"
          style={styles.starIcon}
        />
      );
    }
    return stars;
  };

  return (
    <Pressable
      style={[styles.card, cardStyle]}
      onPress={handlePress}
      android_ripple={{ color: isDark ? '#374151' : '#E5E7EB' }}
    >
      <View style={styles.content}>
        {/* Avatar and Name Row */}
        <View style={styles.headerRow}>
          {teenlancer.profile_photo_url ? (
            <Image
              source={{ uri: teenlancer.profile_photo_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
              <Ionicons name="person" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </View>
          )}
          <View style={styles.nameContainer}>
            <Text style={[styles.name, titleStyle]} numberOfLines={1}>
              {teenlancer.full_name}
            </Text>
            <View style={styles.ratingRow}>
              <View style={styles.starsContainer}>
                {renderStars()}
              </View>
              <Text style={[styles.ratingText, textStyle]}>
                {teenlancer.rating.toFixed(1)}
              </Text>
              {teenlancer.reviewCount > 0 && (
                <Text style={[styles.reviewCount, textStyle]}>
                  ({teenlancer.reviewCount})
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Skills */}
        {teenlancer.skills && teenlancer.skills.length > 0 && (
          <View style={styles.skillsContainer}>
            {teenlancer.skills.slice(0, 3).map((skill, index) => (
              <View
                key={index}
                style={[styles.skillTag, isDark && styles.skillTagDark]}
              >
                <Text style={[styles.skillText, isDark && styles.skillTextDark]}>
                  {skill}
                </Text>
              </View>
            ))}
            {teenlancer.skills.length > 3 && (
              <Text style={[styles.moreSkills, textStyle]}>
                +{teenlancer.skills.length - 3} more
              </Text>
            )}
          </View>
        )}

        {/* Bio */}
        {teenlancer.bio && (
          <Text style={[styles.bio, bioStyle]} numberOfLines={2}>
            {teenlancer.bio}
          </Text>
        )}

        {/* Footer with Distance and View Profile */}
        <View style={styles.footer}>
          {teenlancer.distance !== undefined && (
            <View style={styles.distanceContainer}>
              <Ionicons name="location" size={14} color="#73af17" />
              <Text style={[styles.distance, textStyle]}>
                {teenlancer.distance.toFixed(1)} mi away
              </Text>
            </View>
          )}
          <Pressable
            style={styles.viewProfileButton}
            onPress={handlePress}
          >
            <Text style={styles.viewProfileText}>View Profile</Text>
            <Ionicons name="chevron-forward" size={16} color="#73af17" />
          </Pressable>
        </View>
      </View>

      <ProfileModal
        visible={showProfileModal}
        userId={teenlancer.id}
        onClose={() => setShowProfileModal(false)}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#1F2937',
    borderColor: '#374151',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarPlaceholderDark: {
    backgroundColor: '#374151',
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#000000',
  },
  titleDark: {
    color: '#FFFFFF',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
  },
  textDark: {
    color: '#D1D5DB',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  skillTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E8F5D9',
  },
  skillTagDark: {
    backgroundColor: '#2D4A1A',
  },
  skillText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#5a8a12',
  },
  skillTextDark: {
    color: '#A8D574',
  },
  moreSkills: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  bio: {
    fontSize: 13,
    lineHeight: 18,
    color: '#6B7280',
    marginBottom: 0,
  },
  bioDark: {
    color: '#9CA3AF',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distance: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewProfileText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#73af17',
  },
  titleLight: {
    color: '#000000',
  },
  textLight: {
    color: '#374151',
  },
  bioLight: {
    color: '#6B7280',
  },
});

