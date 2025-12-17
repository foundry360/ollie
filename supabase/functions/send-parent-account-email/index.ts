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
    const { parentEmail, tempPassword, teenName, webAppUrl } = await req.json()

    console.log('📧 [send-parent-account-email] Function called with:', {
      hasParentEmail: !!parentEmail,
      parentEmail: parentEmail,
      hasTempPassword: !!tempPassword,
      tempPasswordLength: tempPassword?.length,
      hasTeenName: !!teenName,
      teenName: teenName,
      webAppUrl: webAppUrl,
    })

    if (!parentEmail || !tempPassword || !teenName) {
      console.error('❌ Missing required fields:', {
        parentEmail: !!parentEmail,
        tempPassword: !!tempPassword,
        teenName: !!teenName,
      })
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(parentEmail)) {
      console.error('❌ Invalid email format:', parentEmail)
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
    console.log('  To Email:', parentEmail)

    const emailSubject = `Your Ollie Parent Account Has Been Created`

    // Get logo URL
    const logoUrl = Deno.env.get('LOGO_URL') || 'https://via.placeholder.com/64x64/73af17/FFFFFF?text=Ollie'
    
    // Construct login URL
    const loginUrl = `${webAppUrl}/auth/login`
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Ollie Parent Account Has Been Created</title>
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
                Great news! You've approved <strong>${teenName}'s</strong> account on Ollie, and we've automatically created a parent account for you so you can monitor and manage your teen's activity.
              </p>
              
              <!-- Account Details Section -->
              <h2 style="margin: 32px 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                Your Account Details
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                <strong>Email:</strong> ${parentEmail}
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <strong>Temporary Password:</strong> <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; color: #111827;">${tempPassword}</code>
              </p>
              
              <!-- Important Notice -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #92400e; font-weight: 600;">
                  ⚠️ Important: Please change your password after logging in for the first time.
                </p>
              </div>
              
              <!-- How to Login Section -->
              <h2 style="margin: 32px 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                How to Get Started
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                1. Download the Ollie app on your mobile device
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                2. Open the app and click <strong>"Already have an account"</strong> on the login screen
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                3. Use your email address as your username: <strong>${parentEmail}</strong>
              </p>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                4. Enter your temporary password: <code style="background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 16px; color: #111827; font-weight: 600;">${tempPassword}</code>
              </p>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                5. After logging in, you can change your password in the app's profile settings
              </p>
              
              <!-- Login Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 32px;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #73af17; border-radius: 8px;">
                          <a href="${loginUrl}" style="background-color: #73af17; border: 0; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 50px; text-decoration: none; text-align: center; width: 280px; -webkit-text-size-adjust: none;">
                            Log In to Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- What You Can Do Section -->
              <h2 style="margin: 32px 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                What You Can Do
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                As a parent on Ollie, you can:
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">Review and approve tasks your teen wants to accept</li>
                <li style="margin-bottom: 8px;">Monitor your teen's earnings and activity</li>
                <li style="margin-bottom: 8px;">View messages between your teen and neighbors</li>
                <li style="margin-bottom: 0;">Manage account settings and privacy controls</li>
              </ul>
              
              <!-- Security Note -->
              <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; line-height: 22px; color: #92400e;">
                  <strong>Security Reminder:</strong> Please change your password after logging in for the first time. You can do this in the app by going to your Profile → Change Password.
                </p>
              </div>
              
              <!-- Questions -->
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                If you have questions or need assistance, you can contact us at <a href="mailto:approvals@olliejobs.com" style="color: #73af17; text-decoration: underline;">approvals@olliejobs.com</a>.
              </p>
              
              <!-- Closing -->
              <p style="margin: 24px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Welcome to Ollie!<br>
                <strong>The Ollie Team</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- BLACK FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: #111827;">
              <p style="margin: 0 0 8px; font-size: 14px; line-height: 20px; color: #ffffff; text-align: center;">
                <a href="https://olliejobs.com" style="color: #ffffff; text-decoration: none;">olliejobs.com</a> | <a href="mailto:approvals@olliejobs.com" style="color: #ffffff; text-decoration: none;">approvals@olliejobs.com</a>
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
    console.log('📧 PARENT ACCOUNT EMAIL PREVIEW:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('To:', parentEmail)
    console.log('From:', `${resendFromName} <${resendFromEmail}>`)
    console.log('Subject:', emailSubject)
    console.log('Login URL:', loginUrl)
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
            loginUrl,
            emailDetails: {
              to: parentEmail,
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
      
      console.log('📧 Sending parent account email via Resend API...')
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${resendFromName} <${resendFromEmail}>`,
          to: [parentEmail],
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
        
        console.log('✅ Parent account email sent successfully via Resend:', resendData)
        console.log('📧 Email ID:', resendData.id)
        console.log('📧 To:', parentEmail)
        console.log('📧 From:', `${resendFromName} <${resendFromEmail}>`)
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email sent successfully',
            loginUrl,
            emailId: resendData.id,
            to: parentEmail,
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
          loginUrl,
          errorDetails: emailError?.message || String(emailError)
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('Error in send-parent-account-email function:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})


