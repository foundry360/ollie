import { supabase } from '@/lib/supabase';

/**
 * Test function to send neighbor approval email directly
 * This bypasses the approval process and just sends the email
 */
export async function testNeighborApprovalEmail(
  email: string,
  fullName: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log('📧 [testEmail] Attempting to send test approval email to:', email);
    
    const { data, error } = await supabase.functions.invoke('send-neighbor-approval-email', {
      body: {
        email,
        fullName,
      }
    });
    
    if (error) {
      console.error('❌ [testEmail] Edge Function error:', error);
      return { success: false, error: error.message || String(error) };
    }
    
    console.log('✅ [testEmail] Email function response:', data);
    return { success: true, data };
  } catch (error: any) {
    console.error('❌ [testEmail] Failed to send test email:', error);
    return { 
      success: false, 
      error: error?.message || String(error) 
    };
  }
}

