import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { approveTeenSignup, rejectTeenSignup, getPendingSignupByTokenAnyStatus } from '@/lib/supabase';
import { useThemeStore } from '@/stores/themeStore';

// Log at module level to confirm file is loading
console.log('📄 [parent-approve] Module loaded');

export default function ParentApproveScreen() {
  console.log('🚀 [parent-approve] Component function called');
  const params = useLocalSearchParams<{ token?: string; action?: string }>();
  console.log('📋 [parent-approve] Params received:', { token: params.token, action: params.action });
  const { colorScheme } = useThemeStore();
  const isDark = colorScheme === 'dark';
  const [loading, setLoading] = useState(true);
  const [pendingSignup, setPendingSignup] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);
  const [actionTaken, setActionTaken] = useState<'approved' | 'rejected' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    console.log('🔄 [parent-approve] useEffect triggered', { token: params.token, action: params.action });
    const fetchPendingSignup = async () => {
      console.log('🔄 [parent-approve] fetchPendingSignup called');
      if (!params.token) {
        console.log('❌ [parent-approve] No token provided');
        setErrorMessage('Missing approval token');
        setLoading(false);
        return;
      }

      try {
        console.log('🔍 Fetching pending signup with token:', params.token);
        const signup = await getPendingSignupByTokenAnyStatus(params.token);
        console.log('✅ Pending signup found:', signup);
        setPendingSignup(signup);
        
        // Check if already processed
        if (signup.status === 'approved') {
          setResult('success');
          setActionTaken('approved');
          setLoading(false);
          return;
        } else if (signup.status === 'rejected') {
          setResult('success');
          setActionTaken('rejected');
          setLoading(false);
          return;
        } else if (signup.status === 'expired') {
          setErrorMessage('This approval link has expired.');
          setLoading(false);
          return;
        }

        // Auto-process if action parameter is present
        console.log('🔍 [parent-approve] Checking conditions:', { 
          action: params.action, 
          status: signup.status,
          shouldApprove: params.action === 'approve' && signup.status === 'pending'
        });
        
        if (params.action === 'approve' && signup.status === 'pending') {
          console.log('✅ [parent-approve] Conditions met - Starting approval process...');
          
          // Show alert for debugging (only on web)
          if (Platform.OS === 'web') {
            Alert.alert('Debug', 'Starting approval process... Check browser console for logs.');
          }
          
          setLoading(false);
          setProcessing(true);
          console.log('✅ [parent-approve] State updated: loading=false, processing=true');
          
          // Wrap in Promise.race with timeout to prevent infinite hanging
          const approvalPromise = Promise.race([
            (async () => {
              try {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:81',message:'Before approveTeenSignup call',data:{hasToken:!!params.token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
                // #endregion
                console.log('🔄 [parent-approve] Calling approveTeenSignup with token:', params.token);
                const result = await approveTeenSignup(params.token!);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:85',message:'After approveTeenSignup call',data:{hasResult:!!result,hasPendingSignup:!!result?.pendingSignup,resultPendingSignupStatus:result?.pendingSignup?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'Q'})}).catch(()=>{});
                // #endregion
                console.log('✅ [parent-approve] Approval completed successfully, result:', result);
                
                // Update state immediately - don't wait
                console.log('🔄 [parent-approve] Updating state to success...');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:90',message:'Before state updates',data:{currentResult:result,currentActionTaken:actionTaken,currentProcessing:processing},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'R'})}).catch(()=>{});
                // #endregion
                setActionTaken('approved');
                setPendingSignup((prev: any) => {
                  const updated = prev ? { ...prev, status: 'approved' } : (result?.pendingSignup || null);
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:94',message:'Inside setPendingSignup callback',data:{hasPrev:!!prev,updatedStatus:updated?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'S'})}).catch(()=>{});
                  // #endregion
                  return updated;
                });
                setResult('success');
                setProcessing(false);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:100',message:'After all state updates called',data:{setResultCalled:true,setProcessingCalled:true,setActionTakenCalled:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'T'})}).catch(()=>{});
                // #endregion
                console.log('✅ [parent-approve] Success state set, processing set to false');
                
                // Show success alert for debugging
                if (Platform.OS === 'web') {
                  Alert.alert('Success', 'Approval completed! State updated to success.');
                }
              } catch (error: any) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:97',message:'Error caught in approval handler',data:{errorMessage:error?.message,errorName:error?.name,errorCode:error?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
                console.error('❌ [parent-approve] Approval error:', error);
                console.error('❌ [parent-approve] Error details:', {
                  message: error?.message,
                  stack: error?.stack,
                  name: error?.name
                });
                setResult('error');
                setErrorMessage(error.message || 'Failed to approve signup');
                setProcessing(false);
                
                // Show error alert for debugging
                if (Platform.OS === 'web') {
                  Alert.alert('Error', `Approval failed: ${error.message}`);
                }
              }
            })(),
            new Promise((_, reject) => 
              setTimeout(() => {
                console.error('⏱️ [parent-approve] Approval timeout after 15 seconds');
                reject(new Error('Approval timeout: Process took too long'));
              }, 15000)
            )
          ]).catch((error: any) => {
            console.error('❌ [parent-approve] Approval timeout or error:', error);
            setResult('error');
            setErrorMessage(error.message || 'Approval process timed out. Please try again.');
            setProcessing(false);
            
            // Show timeout alert
            if (Platform.OS === 'web') {
              Alert.alert('Timeout', 'Approval process timed out after 15 seconds.');
            }
          });
          
          console.log('🔄 [parent-approve] Approval promise created, returning from useEffect');
          return;
        } else if (params.action === 'reject' && signup.status === 'pending') {
          setLoading(false);
          setProcessing(true);
          try {
            await rejectTeenSignup(params.token);
            setActionTaken('rejected');
            setPendingSignup((prev: any) => prev ? { ...prev, status: 'rejected' } : null);
            setResult('success');
          } catch (error: any) {
            setResult('error');
            setErrorMessage(error.message || 'Failed to reject signup');
          } finally {
            setProcessing(false);
          }
          return;
        }
        // If status is 'pending' and no action, show message to use email link
        if (signup.status === 'pending' && !params.action) {
          setErrorMessage('Please use the approval link from your email to approve or reject this request.');
          setLoading(false);
          return;
        }
      } catch (error: any) {
        console.error('❌ Error fetching pending signup:', error);
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        setErrorMessage(error.message || 'Invalid or expired approval token');
      } finally {
        setLoading(false);
      }
    };

    fetchPendingSignup();
  }, [params.token, params.action]);


  const containerStyle = isDark ? styles.containerDark : styles.containerLight;
  const textStyle = isDark ? styles.textDark : styles.textLight;
  const subtitleStyle = isDark ? styles.subtitleDark : styles.subtitleLight;

  // Check success FIRST - this is the most important state
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/49e84fa0-ab03-4c98-a1bc-096c4cecf811',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/parent-approve.tsx:197',message:'Render check',data:{result,actionTaken,loading,processing,hasPendingSignup:!!pendingSignup,pendingSignupStatus:pendingSignup?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'W'})}).catch(()=>{});
  // #endregion
  if (result === 'success') {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, textStyle]}>Thank You!</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>
            {actionTaken === 'approved' 
              ? "Your child's account has been approved. They can now complete their account setup and start using Ollie."
              : actionTaken === 'rejected'
              ? "The signup request has been rejected."
              : pendingSignup?.status === 'approved' 
              ? "Your child's account has been approved. They can now complete their account setup and start using Ollie."
              : "The signup request has been rejected."}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
          <Text style={[styles.loadingText, textStyle]}>Loading approval request...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMessage && !pendingSignup) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, textStyle]}>Error</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>{errorMessage}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (result === 'error') {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoContainer}>
            <Image
              source={require('@/assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, textStyle]}>Error</Text>
          <Text style={[styles.subtitle, subtitleStyle]}>{errorMessage}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Show processing state if we're processing
  if (processing) {
    return (
      <SafeAreaView style={[styles.container, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#73af17" />
          <Text style={[styles.loadingText, textStyle]}>Processing approval...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If we get here, it means we're still loading or there's an error
  // This shouldn't happen, but return loading state as fallback
  console.log('⚠️ [parent-approve] Reached fallback render - this should not happen');
  console.log('⚠️ [parent-approve] State:', { loading, processing, result, errorMessage });
  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#73af17" />
        <Text style={[styles.loadingText, textStyle]}>Loading...</Text>
        <Text style={[styles.loadingText, textStyle, { marginTop: 20, fontSize: 12 }]}>
          Debug: loading={String(loading)}, processing={String(processing)}, result={String(result)}
        </Text>
      </View>
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
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  textLight: {
    color: '#000000',
  },
  textDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  subtitleLight: {
    color: '#666666',
  },
  subtitleDark: {
    color: '#9CA3AF',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    textAlign: 'center',
  },
});

