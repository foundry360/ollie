import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate email HTML
function generateEmailHtml(fullName: string, emailHeaderUrl: string, connectedBodyUrl: string = ''): string {
  // Extract first name only
  const firstName = fullName.split(' ')[0] || fullName;
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>Application Approved</title>
  <style>
    /* Prevent dark mode color inversion */
    @media (prefers-color-scheme: dark) {
      .email-container {
        background-color: #f9fafb !important;
      }
      .email-card {
        background-color: #ffffff !important;
      }
      .email-body {
        background-color: #ffffff !important;
        color: #374151 !important;
      }
      .email-body p {
        color: #374151 !important;
      }
      .email-footer {
        background-color: #111827 !important;
        color: #ffffff !important;
      }
      .email-footer p {
        color: #ffffff !important;
      }
      .email-footer a {
        color: #ffffff !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; color: #1f2937;">
  
  <!-- Main Container -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; padding: 0;" class="email-container">
    <tr>
      <td align="center">
        
        <!-- Email Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; overflow: hidden;" class="email-card">
          
          ${emailHeaderUrl ? `
          <!-- EMAIL HEADER IMAGE -->
          <tr>
            <td style="padding: 0; margin: 0; line-height: 0; font-size: 0;">
              <img src="${emailHeaderUrl}" alt="Ollie" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0; padding: 0; border: 0;" onerror="this.style.display='none';" />
            </td>
          </tr>
          ` : `
          <!-- FALLBACK HEADER -->
          <tr>
            <td style="padding: 32px; text-align: center; background-color: #111827;">
              <p style="margin: 0; font-size: 24px; font-weight: 600; color: #ffffff;">Ollie</p>
            </td>
          </tr>
          `}
          
          <!-- WHITE BODY -->
          <tr>
            <td style="padding: 40px 32px 16px 32px; background-color: #ffffff; margin: 0;" class="email-body">
              
              <!-- Greeting -->
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #374151;">
                Hello ${firstName},
              </p>
              
              <!-- Welcome Message -->
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                Welcome to Ollie! We're excited to let you know that your neighbor application has been approved. You're now part of a community that connects trusted neighbors with local teens who are ready to help with everyday tasks.
              </p>
              
              <p style="margin: 0; font-size: 16px; line-height: 24px; color: #374151;">
                You can now log in to your account and start posting tasks—whether it's yard work, pet care, household help, or other simple jobs.
              </p>
              
            </td>
          </tr>
          
          ${connectedBodyUrl ? `
          <!-- Connected Body Image -->
          <tr>
            <td style="padding: 0; margin: 0; line-height: 0; font-size: 0; text-align: center;">
              <img src="${connectedBodyUrl}" alt="Connected Community" style="width: 100%; max-width: 600px; height: auto; display: block; margin: 0; padding: 0; border: 0;" />
            </td>
          </tr>
          ` : ''}
          
          <!-- WHITE BODY CONTINUED -->
          <tr>
            <td style="padding: 40px 32px; background-color: #ffffff; margin: 0;" class="email-body">
              
              <!-- Login Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #73af17; border-radius: 8px;">
                          <a href="https://olliejobs.com/login" style="background-color: #73af17; border: 0; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 50px; text-decoration: none; text-align: center; width: 280px; -webkit-text-size-adjust: none;">
                            Get Started
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Closing -->
              <p style="margin: 32px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Local teens in your area are ready to help, and you'll be supporting them as they build responsibility and earn money in a safe, community-based way.
              </p>
              
              <p style="margin: 24px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Welcome to the community!<br>
                <strong>The Ollie Team</strong>
              </p>
              
            </td>
          </tr>
          
          <!-- BLACK FOOTER -->
          <tr>
            <td style="padding: 24px 32px; background-color: #111827; border-radius: 0 0 8px 8px;" class="email-footer">
              <p style="margin: 0 0 8px; font-size: 12px; line-height: 18px; color: #ffffff; text-align: center;">
                <a href="https://olliejobs.com" style="color: #ffffff; text-decoration: none;">olliejobs.com</a> | <a href="mailto:support@olliejobs.com" style="color: #ffffff; text-decoration: none;">support@olliejobs.com</a>
              </p>
              <p style="margin: 0; font-size: 10px; line-height: 16px; color: #ffffff; text-align: center;">
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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Log function invocation
  console.log('📧 [send-neighbor-approval-email] Function called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Get email configuration from Edge Function secrets
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
    const resendFromName = Deno.env.get('RESEND_FROM_NAME') || 'Ollie'
    const emailHeaderUrl = Deno.env.get('EMAIL_HEADER_URL') || ''
    const connectedBodyUrl = Deno.env.get('CONNECTED_BODY_URL') || ''
    const emailSubject = `Your Ollie Application Has Been Approved!`

  // Handle GET request for browser preview (no auth required for preview)
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      const fullName = url.searchParams.get('fullName') || 'John Doe'
      const email = url.searchParams.get('email') || 'test@example.com'
      const connectedBodyUrl = Deno.env.get('CONNECTED_BODY_URL') || ''
      
      const emailBodyHtml = generateEmailHtml(fullName, emailHeaderUrl, connectedBodyUrl)
      
      // Return HTML preview (no auth check for GET requests - preview only)
      return new Response(emailBodyHtml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
        },
      })
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error?.message || String(error) }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
  }

  // Handle POST request to send email
  try {
    const { email, fullName } = await req.json()

    if (!email || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const emailBodyHtml = generateEmailHtml(fullName, emailHeaderUrl, connectedBodyUrl)

    // Log email preview for testing
    console.log('📧 EMAIL PREVIEW:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('To:', email)
    console.log('From:', `${resendFromName} <${resendFromEmail}>`)
    console.log('Subject:', emailSubject)
    console.log('Header Image URL:', emailHeaderUrl || 'Not configured')
    console.log('Connected Body URL:', connectedBodyUrl || 'Not configured')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Send email using Resend API
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      
      if (!resendApiKey) {
        console.log('⚠️ RESEND_API_KEY not configured. Email details logged below.')
        console.log('📧 To send emails, set RESEND_API_KEY in Edge Function secrets')
        console.log('Get your API key from: https://resend.com/api-keys')
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email prepared. Configure RESEND_API_KEY in Edge Function secrets to send emails.',
            emailDetails: {
              to: email,
              from: `${resendFromName} <${resendFromEmail}>`,
              subject: emailSubject,
            },
            note: 'Set RESEND_API_KEY in Edge Function secrets to enable email sending. Get your key from https://resend.com/api-keys',
            htmlPreview: emailBodyHtml.substring(0, 500) + '...'
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log('📧 Sending email via Resend API...')
      
      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${resendFromName} <${resendFromEmail}>`,
          to: [email],
          subject: emailSubject,
          html: emailBodyHtml,
        }),
      })
      
      const resendData = await resendResponse.json()
      
      if (resendResponse.ok) {
        console.log('✅ Email sent successfully via Resend:', resendData)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email sent successfully',
            emailId: resendData.id,
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      } else {
        throw new Error(`Resend API error: ${JSON.stringify(resendData)}`)
      }
    } catch (emailError: any) {
      console.error('Email sending error:', emailError)
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to send email',
          message: 'Check Edge Function logs for details.',
          errorDetails: emailError?.message || String(emailError)
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

  } catch (error: any) {
    console.error('Error sending email:', error)
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

