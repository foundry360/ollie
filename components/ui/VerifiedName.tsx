import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerifiedNameProps {
  name: string;
  verified?: boolean;
  style?: any;
  nameStyle?: any;
  iconSize?: number;
}

export function VerifiedName({ name, verified, style, nameStyle, iconSize = 16 }: VerifiedNameProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.name, nameStyle]}>{name}</Text>
      {verified && (
        <View style={styles.verifiedContainer}>
          <Ionicons name="checkmark-circle" size={iconSize} color="#F97316" />
          <Text style={styles.verifiedText}>verified</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  name: {
    fontSize: 14,
  },
  verifiedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#F97316',
    fontWeight: '500',
  },
});

