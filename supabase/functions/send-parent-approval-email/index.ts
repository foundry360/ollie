import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { parentEmail, token, teenName, teenAge, approvalUrl } = await req.json()

    if (!parentEmail || !token || !teenName || !approvalUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Construct approve and reject URLs with action parameters
    const webAppUrl = approvalUrl.split('/parent-approve')[0] || 'http://localhost:8081'
    const approveUrl = `${webAppUrl}/parent-approve?token=${token}&action=approve`
    const rejectUrl = `${webAppUrl}/parent-approve?token=${token}&action=reject`
    
    // Calculate expiration date (48 hours from now to match template)
    const expirationDate = new Date()
    expirationDate.setHours(expirationDate.getHours() + 48)
    const expirationDateFormatted = expirationDate.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    
    // Format current date/time
    const currentDate = new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })

    // Get email configuration from Edge Function secrets
    // For Resend: You can use their default domain (onboarding@resend.dev) for testing
    // Or verify your own domain at https://resend.com/domains
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
    const resendFromName = Deno.env.get('RESEND_FROM_NAME') || 'Ollie'

    // No need to check SMTP config since we're using Resend

    const emailSubject = `Parental Approval Required for Your Teen to Use Ollie`
    
    // Get logo URL - must be a publicly accessible URL
    // Option 1: Set LOGO_URL in Edge Function secrets with full URL (e.g., https://yourdomain.com/logo.png)
    // Option 2: Host logo on Supabase Storage, CDN, or your website
    const logoUrl = Deno.env.get('LOGO_URL') || 'https://via.placeholder.com/64x64/73af17/FFFFFF?text=Ollie'
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parental Approval Required for Your Teen to Use Ollie</title>
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
                Your teen, <strong>${teenName}</strong>, has signed up for Ollie, a mobile app that helps teens earn money by completing simple, local tasks for trusted neighbors—such as yard work, pet care, or basic household help.
              </p>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                Because your teen is under 18, your approval is required before their account can be activated.
              </p>
              
              <!-- What is Ollie Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                What is Ollie?
              </h2>
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                Ollie connects teens with nearby neighbors who need help with everyday tasks. The goal is to help teens build responsibility, earn money, and gain real-world experience in a safe, community-based way.
              </p>
              
              <!-- What does parental approval mean Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                What does parental approval mean?
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                By approving your teen's account, you are:
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">Allowing them to create and use an account on Ollie</li>
                <li style="margin-bottom: 8px;">Acknowledging that tasks are optional and accepted by the teen</li>
                <li style="margin-bottom: 0;">Retaining the ability to review activity and revoke access at any time</li>
              </ul>
              
              <!-- Safety & Controls Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                Safety & Controls
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                We take safety seriously. Our platform includes:
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">Neighbor identity verification</li>
                <li style="margin-bottom: 8px;">Clear task descriptions before acceptance</li>
                <li style="margin-bottom: 8px;">In-app messaging (no sharing of personal contact details)</li>
                <li style="margin-bottom: 0;">Parent visibility and account controls</li>
              </ul>
              
              <!-- How to approve Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                How to approve
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                To review and approve your teen's account, please click the link below:
              </p>
              
              <!-- Approve Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 32px;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #73af17; border-radius: 8px;">
                          <a href="${approveUrl}" style="background-color: #73af17; border: 0; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 50px; text-decoration: none; text-align: center; width: 280px; -webkit-text-size-adjust: none;">
                            Approve My Teen's Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                This will take only a few minutes.
              </p>
              
              <!-- Deny Link -->
              <p style="margin: 0 0 32px; text-align: center;">
                <a href="${rejectUrl}" style="color: #73af17; text-decoration: underline; font-size: 14px;">
                  This isn't my child
                </a>
              </p>
              
              <!-- Questions -->
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                If you have questions or would like more information before approving, you can visit <a href="https://olliejobs.com/parents" style="color: #73af17; text-decoration: underline;">olliejobs.com/parents</a> or contact us at <a href="mailto:approvals@olliejobs.com" style="color: #73af17; text-decoration: underline;">approvals@olliejobs.com</a>.
              </p>
              
              <!-- Closing -->
              <p style="margin: 0 0 8px; font-size: 16px; line-height: 24px; color: #374151;">
                Thank you for helping your teen take a positive step toward independence and responsibility.
              </p>
              
              <p style="margin: 24px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Warm regards,<br>
                <strong>The Ollie Team</strong>
              </p>
              
              <!-- Expiration Notice -->
              <p style="margin: 32px 0 0; font-size: 13px; line-height: 18px; color: #9ca3af; text-align: center;">
                This request expires: ${expirationDateFormatted}
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
    console.log('📧 EMAIL PREVIEW:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('To:', parentEmail)
    console.log('From:', `${resendFromName} <${resendFromEmail}>`)
    console.log('Subject:', emailSubject)
    console.log('Approval URL:', approvalUrl)
    console.log('Logo URL:', logoUrl)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('HTML Email Body:')
    console.log(emailBodyHtml)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Send email using Resend API (HTTP-based, works with Edge Functions)
    // Note: Supabase Edge Functions block SMTP ports (25, 465, 587)
    // Resend uses HTTPS and works perfectly with Edge Functions
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
            approvalUrl,
            emailDetails: {
              to: parentEmail,
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
          to: [parentEmail],
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
            approvalUrl,
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
      console.error('Email preparation error:', emailError)
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Failed to prepare email',
          message: 'Check Edge Function logs for details. Use approvalUrl for testing.',
          approvalUrl,
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

