import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/themeStore';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert('Success', 'Password changed successfully!');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const cardStyle = isDark ? styles.cardDark : styles.cardLight;
  const titleStyle = isDark ? styles.titleDark : styles.titleLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  const handleMenuItemPress = (label: string) => {
    // Placeholder for menu item actions
    Alert.alert('Coming Soon', `${label} feature coming soon`);
  };

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
        <Text style={[styles.screenTitle, titleStyle]}>Settings</Text>
        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>Account</Text>
          
          <Pressable 
            style={[styles.menuItem, styles.menuItemWithBorder, isDark && styles.menuItemBorderDark]}
            onPress={() => handleMenuItemPress('Privacy & Security')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Privacy & Security</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          <Pressable 
            style={[styles.menuItem, styles.menuItemWithBorder, isDark && styles.menuItemBorderDark]}
            onPress={() => handleMenuItemPress('Billing & Payments')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="card-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Billing & Payments</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          <Pressable 
            style={styles.menuItem} 
            onPress={() => setShowChangePassword(true)}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
        </View>

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>Personalization</Text>
          
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="moon-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Dark Mode</Text>
            </View>
            <ThemeToggle />
          </View>
        </View>

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>Activity</Text>
          
          <Pressable 
            style={styles.menuItem}
            onPress={() => handleMenuItemPress('Activity Notifications')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="notifications-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
        </View>

        <View style={[styles.section, cardStyle]}>
          <Text style={[styles.sectionTitle, titleStyle]}>About</Text>
          
          <Pressable 
            style={[styles.menuItem, styles.menuItemWithBorder, isDark && styles.menuItemBorderDark]}
            onPress={() => handleMenuItemPress('Help Center')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="help-circle-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Help Center</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          <Pressable 
            style={[styles.menuItem, styles.menuItemWithBorder, isDark && styles.menuItemBorderDark]}
            onPress={() => handleMenuItemPress('Terms of Use')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="document-text-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Terms of Use</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>

          <Pressable 
            style={styles.menuItem}
            onPress={() => handleMenuItemPress('Privacy Policy')}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="shield-checkmark-outline" size={20} color={isDark ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.menuItemLabel, labelStyle]}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet
        visible={showChangePassword}
        onClose={() => {
          setShowChangePassword(false);
          setNewPassword('');
          setConfirmPassword('');
        }}
        title="Change Password"
      >
        <View style={styles.bottomSheetContent}>
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Enter new password (min 8 characters)"
            autoCapitalize="none"
          />
          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Confirm new password"
            autoCapitalize="none"
            style={{ marginTop: 16 }}
          />
          <View style={styles.passwordActions}>
            <Pressable 
              style={[styles.cancelPasswordButton, isDark && styles.cancelPasswordButtonDark]}
              onPress={() => {
                setShowChangePassword(false);
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              <Text style={[styles.cancelPasswordText, isDark && styles.cancelPasswordTextDark]}>
                Cancel
              </Text>
            </Pressable>
            <Button
              title={isChangingPassword ? 'Changing...' : 'Change Password'}
              onPress={handleChangePassword}
              disabled={isChangingPassword}
              style={styles.savePasswordButton}
            />
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#F9FAFB',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 0,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cardLight: {
    backgroundColor: '#FFFFFF',
  },
  cardDark: {
    backgroundColor: '#111111',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 8,
    marginBottom: 12,
  },
  titleDark: {
    color: '#FFFFFF',
  },
  titleLight: {
    color: '#000000',
  },
  textDark: {
    color: '#9CA3AF',
  },
  textLight: {
    color: '#FFFFFF',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  labelLight: {
    color: '#000000',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemBorderDark: {
    borderBottomColor: '#1F1F1F',
  },
  menuItemLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  bottomSheetContent: {
    paddingBottom: 20,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'space-between',
  },
  cancelPasswordButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPasswordButtonDark: {
    borderColor: '#4B5563',
  },
  cancelPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  cancelPasswordTextDark: {
    color: '#9CA3AF',
  },
  savePasswordButton: {
    flex: 1,
  },
});
