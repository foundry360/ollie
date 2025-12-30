import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { parent_email, teen_name, setup_token, web_app_url } = await req.json()

    console.log('📧 [send-bank-account-setup-email] Function called with:', {
      hasParentEmail: !!parent_email,
      parentEmail: parent_email,
      hasTeenName: !!teen_name,
      teenName: teen_name,
      hasSetupToken: !!setup_token,
      setupTokenLength: setup_token?.length,
      webAppUrl: web_app_url,
    })

    if (!parent_email || !teen_name || !setup_token || !web_app_url) {
      console.error('❌ Missing required fields:', {
        parentEmail: !!parent_email,
        teenName: !!teen_name,
        setupToken: !!setup_token,
        webAppUrl: !!web_app_url,
      })
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(parent_email)) {
      console.error('❌ Invalid email format:', parent_email)
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get email configuration from Edge Function secrets
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
    const resendFromName = Deno.env.get('RESEND_FROM_NAME') || 'Ollie'
    
    console.log('📧 Email configuration:')
    console.log('  From Email:', resendFromEmail)
    console.log('  From Name:', resendFromName)
    console.log('  To Email:', parent_email)

    const emailSubject = `Set Up Bank Account for ${teen_name}'s Ollie Account`

    // Get logo URL
    const logoUrl = Deno.env.get('LOGO_URL') || 'https://via.placeholder.com/64x64/73af17/FFFFFF?text=Ollie'
    
    // Construct setup URL
    const setupUrl = `${web_app_url}/parent/bank-setup?token=${setup_token}`
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Set Up Bank Account for ${teen_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; color: #1f2937;">
  
  <!-- Main Container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        
        <!-- Email Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden;">
          
          <!-- BLACK HEADER -->
          <tr>
            <td style="padding: 32px; text-align: center; background-color: #111827;">
              <img src="${logoUrl}" alt="Ollie" style="max-width: 120px; height: auto; display: block; margin: 0 auto;" onerror="this.style.display='none';" />
            </td>
          </tr>
          
          <!-- WHITE BODY -->
          <tr>
            <td style="padding: 40px 32px; background-color: #ffffff;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                Hello,
              </p>
              
              <!-- Opening Paragraph -->
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <strong>${teen_name}</strong> has requested to set up a bank account on Ollie to receive payments from completed tasks. As the parent/guardian, we need you to enter the bank account details to enable direct deposits.
              </p>
              
              <!-- Security Note -->
              <div style="background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #1E40AF;">
                  <strong>Secure & Safe:</strong> Your bank account information is encrypted and secure. We use Stripe, a trusted payment processor, to handle all banking details.
                </p>
              </div>
              
              <!-- Setup Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #73af17; border-radius: 8px;">
                          <a href="${setupUrl}" style="background-color: #73af17; border: 0; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 50px; text-decoration: none; text-align: center; width: 280px; -webkit-text-size-adjust: none;">
                            Set Up Bank Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What You'll Need Section -->
              <h2 style="margin: 32px 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                What You'll Need
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                To complete the setup, you'll need:
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">Bank account routing number (9 digits)</li>
                <li style="margin-bottom: 8px;">Bank account number</li>
                <li style="margin-bottom: 8px;">Account type (checking or savings)</li>
                <li style="margin-bottom: 0;">Account holder name (should match the bank account)</li>
              </ul>
              
              <!-- Important Notice -->
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #92400E; font-weight: 600;">
                  ⚠️ Important: This link will expire in 7 days. Please complete the setup as soon as possible.
                </p>
              </div>
              
              <!-- Questions -->
              <p style="margin: 32px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                If you have questions or need assistance, you can contact us at <a href="mailto:support@olliejobs.com" style="color: #73af17; text-decoration: underline;">support@olliejobs.com</a>.
              </p>
              
              <!-- Closing -->
              <p style="margin: 24px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Thank you for supporting ${teen_name} on Ollie!<br>
                <strong>The Ollie Team</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- BLACK FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: #111827;">
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 20px; color: #ffffff; text-align: center;">
                <a href="https://olliejobs.com" style="color: #ffffff; text-decoration: none;">olliejobs.com</a> | <a href="mailto:support@olliejobs.com" style="color: #ffffff; text-decoration: none;">support@olliejobs.com</a>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #ffffff; text-align: center;">
                © ${new Date().getFullYear()} Ollie. All rights reserved.
              </p>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
    `.trim()

    // Log email preview for testing
    console.log('📧 BANK ACCOUNT SETUP EMAIL PREVIEW:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('To:', parent_email)
    console.log('From:', `${resendFromName} <${resendFromEmail}>`)
    console.log('Subject:', emailSubject)
    console.log('Setup URL:', setupUrl)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Send email using Resend API
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      
      if (!resendApiKey) {
        console.log('⚠️ RESEND_API_KEY not configured. Email details logged below.')
        console.log('📧 To send emails, set RESEND_API_KEY in Edge Function secrets')
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email prepared. Configure RESEND_API_KEY in Edge Function secrets to send emails.',
            setupUrl,
            emailDetails: {
              to: parent_email,
              from: `${resendFromName} <${resendFromEmail}>`,
              subject: emailSubject,
            },
            note: 'Set RESEND_API_KEY in Edge Function secrets to enable email sending.',
            htmlPreview: emailBodyHtml.substring(0, 500) + '...'
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log('📧 Sending bank account setup email via Resend API...')
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${resendFromName} <${resendFromEmail}>`,
          to: [parent_email],
          subject: emailSubject,
          html: emailBodyHtml,
        }),
      })
      
      const resendData = await resendResponse.json()
      
      console.log('📧 Resend API response status:', resendResponse.status)
      console.log('📧 Resend API response data:', JSON.stringify(resendData, null, 2))
      
      if (resendResponse.ok) {
        // Check if Resend returned an error in the response body
        if (resendData.error) {
          console.error('❌ Resend returned error in response:', resendData.error)
          throw new Error(`Resend API error: ${JSON.stringify(resendData.error)}`)
        }
        
        console.log('✅ Bank account setup email sent successfully via Resend:', resendData)
        console.log('📧 Email ID:', resendData.id)
        console.log('📧 To:', parent_email)
        console.log('📧 From:', `${resendFromName} <${resendFromEmail}>`)
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email sent successfully',
            setupUrl,
            emailId: resendData.id,
            to: parent_email,
            from: `${resendFromName} <${resendFromEmail}>`,
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        console.error('❌ Resend API returned error status:', resendResponse.status)
        console.error('❌ Resend API error response:', JSON.stringify(resendData, null, 2))
        throw new Error(`Resend API error (${resendResponse.status}): ${JSON.stringify(resendData)}`)
      }
    } catch (emailError: any) {
      console.error('Email sending error:', emailError)
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to send email',
          message: 'Check Edge Function logs for details.',
          setupUrl,
          errorDetails: emailError?.message || String(emailError)
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('Error in send-bank-account-setup-email function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

