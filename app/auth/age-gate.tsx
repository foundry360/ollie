import { useState } from 'react';
import { View, Text, Platform, Alert, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function AgeGateScreen() {
  const router = useRouter();
  const [date, setDate] = useState(new Date(2005, 0, 1));
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const calculateAge = (birthdate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) age--;
    return age;
  };

  const handleContinue = () => {
    const age = calculateAge(date);
    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to use Ollie.');
      return;
    }
    const path = age < 18 ? '/auth/signup-teen' : '/auth/signup-adult';
    router.push({ pathname: path as any, params: { birthdate: date.toISOString() } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Welcome to Ollie</Text>
        <Text style={styles.subtitle}>To get started, we need to verify your age for safety.</Text>
        <Text style={styles.label}>What's your birthdate?</Text>
        
        {Platform.OS === 'android' && (
          <Pressable
            onPress={() => setShowPicker(true)}
            style={styles.dateButton}
          >
            <Text style={styles.dateButtonText}>{date.toLocaleDateString()}</Text>
          </Pressable>
        )}
        
        {showPicker && (
          <View style={styles.pickerContainer}>
            <DateTimePicker 
              value={date} 
              mode="date" 
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
              onChange={(e, d) => { 
                setShowPicker(Platform.OS === 'ios'); 
                if (d) setDate(d); 
              }} 
              maximumDate={new Date()} 
            />
          </View>
        )}
        
        <Pressable
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </Pressable>
        
        <Text style={styles.footer}>By continuing, you agree to our Terms and Privacy Policy.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 20,
    textAlign: 'center',
  },
  dateButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  pickerContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#73af17',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginBottom: 20,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  footer: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
  },
});
