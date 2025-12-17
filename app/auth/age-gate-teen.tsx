import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Image, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/Button';
import { Ionicons } from '@expo/vector-icons';

export default function AgeGateTeenScreen() {
  const router = useRouter();
  const { colorScheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const [birthdate, setBirthdate] = useState(['', '', '', '', '', '', '', '']); // MM/DD/YYYY
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Reset birthdate when screen comes into focus (user navigated back)
  useFocusEffect(
    useCallback(() => {
      // Reset birthdate to empty when screen comes into focus
      setBirthdate(['', '', '', '', '', '', '', '']);
      // Clear all input refs
      inputRefs.current.forEach(ref => {
        if (ref) {
          ref.clear();
        }
      });
    }, [])
  );

  const calculateAgeLocal = (birthdate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
    return age;
  };

  const handleBirthdateChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    
    const newBirthdate = [...birthdate];
    newBirthdate[index] = value;
    setBirthdate(newBirthdate);
    
    if (value && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (value && index === 1) {
      inputRefs.current[2]?.focus();
    }
    if (value && index === 3) {
      inputRefs.current[4]?.focus();
    }
  };

  const handleBirthdateKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !birthdate[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleContinue = async () => {
    // Parse birthdate from input boxes
    const month = birthdate[0] + birthdate[1];
    const day = birthdate[2] + birthdate[3];
    const year = birthdate[4] + birthdate[5] + birthdate[6] + birthdate[7];
    
    if (!month || !day || !year || month.length !== 2 || day.length !== 2 || year.length !== 4) {
      Alert.alert('Invalid Date', 'Please enter a complete birthdate (MM/DD/YYYY)');
      return;
    }
    
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const yearNum = parseInt(year, 10);
    
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
      Alert.alert('Invalid Date', 'Please enter a valid birthdate');
      return;
    }
    
    const birthDate = new Date(yearNum, monthNum - 1, dayNum);
    const age = calculateAgeLocal(birthDate);
    
    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to use Ollie.');
      return;
    }
    if (age >= 18) {
      Alert.alert('Age Limit', 'Teens must be under 18. Please use the adult signup.');
      router.replace('/role-selection');
      return;
    }
    
    // Store birthdate in AsyncStorage for later use (e.g., check status)
    await AsyncStorage.setItem('teen_birthdate', birthDate.toISOString());
    
    // Navigate to request approval screen with birthdate
    router.push({
      pathname: '/auth/request-approval',
      params: { 
        birthdate: birthDate.toISOString(),
        age: age.toString()
      }
    });
  };

  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;
  const labelStyle = isDark ? styles.labelDark : styles.labelLight;

  return (
    <SafeAreaView style={[styles.container, containerStyle]} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={isDark ? '#FFFFFF' : '#000000'} />
          <Text style={[styles.backButtonText, isDark && styles.backButtonTextDark]}>Back</Text>
        </Pressable>
        <View style={styles.logoContainer}>
          <Image 
            source={isDark ? require('@/assets/logo.png') : require('@/assets/logo-dark.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.subtitle, subtitleStyle]}>
          Let's get you set up! First, we need to verify your age.
        </Text>
        <View style={styles.spacer} />
        <Text style={[styles.label, labelStyle]}>What's your birthdate?</Text>
        
        <View style={styles.birthdateContainer}>
          <View style={styles.birthdateInputs}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.birthdateInput,
                  isDark && styles.birthdateInputDark,
                ]}
                value={birthdate[index]}
                onChangeText={(value) => handleBirthdateChange(index, value)}
                onKeyPress={({ nativeEvent }) => handleBirthdateKeyPress(index, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
          <Text style={[styles.birthdateLabel, isDark && styles.birthdateLabelDark]}>
            MM/DD/YYYY
          </Text>
        </View>
        
        <Button
          title="Continue"
          onPress={handleContinue}
          fullWidth
        />
        
        <Text style={[styles.footer, subtitleStyle]}>
          By continuing, you agree to our Terms and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerLight: {
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 0,
    alignSelf: 'flex-start',
    gap: 4,
  },
  backButtonText: {
    fontSize: 16,
    color: '#000000',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 0,
  },
  logo: {
    width: 180,
    height: 180,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 12,
    lineHeight: 24,
    textAlign: 'center',
  },
  subtitleLight: {
    color: '#6B7280',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  spacer: {
    height: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  labelLight: {
    color: '#111827',
  },
  labelDark: {
    color: '#FFFFFF',
  },
  birthdateContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: 24,
  },
  birthdateInputs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  birthdateInput: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    backgroundColor: 'transparent',
    color: '#111827',
  },
  birthdateInputDark: {
    borderColor: '#4B5563',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
  },
  birthdateLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  birthdateLabelDark: {
    color: '#9CA3AF',
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});

