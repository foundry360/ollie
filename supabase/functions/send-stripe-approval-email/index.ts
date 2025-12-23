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
    const { parentEmail, teenName, approvalId, dashboardUrl } = await req.json()

    if (!parentEmail || !teenName || !dashboardUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get email configuration from Edge Function secrets
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'
    const resendFromName = Deno.env.get('RESEND_FROM_NAME') || 'Ollie'

    const emailSubject = `Payment Account Setup Approval Required for ${teenName}`
    
    // Get logo URL
    const logoUrl = Deno.env.get('LOGO_URL') || 'https://via.placeholder.com/64x64/73af17/FFFFFF?text=Ollie'
    
    const emailBodyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Account Setup Approval Required</title>
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
                Your teen, <strong>${teenName}</strong>, has requested to set up a payment account on Ollie to receive payments for completed gigs.
              </p>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                Because your teen is under 18, your approval is required before they can connect their payment account.
              </p>
              
              <!-- What this means Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                What does this mean?
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                By approving this request, you are allowing your teen to:
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">Connect a Stripe payment account to receive payments</li>
                <li style="margin-bottom: 8px;">Receive money directly into their account when they complete gigs</li>
                <li style="margin-bottom: 0;">Set up banking information for payouts</li>
              </ul>
              
              <!-- Safety & Security Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                Safety & Security
              </h2>
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #374151;">
                We use Stripe, a trusted payment processor used by millions of businesses worldwide. Your teen's payment information is secure and encrypted.
              </p>
              <ul style="margin: 0 0 32px; padding-left: 24px; font-size: 16px; line-height: 24px; color: #374151;">
                <li style="margin-bottom: 8px;">All payments are processed securely through Stripe</li>
                <li style="margin-bottom: 8px;">Banking information is encrypted and never shared</li>
                <li style="margin-bottom: 8px;">You can review all payment activity in the parent dashboard</li>
                <li style="margin-bottom: 0;">You can revoke access at any time</li>
              </ul>
              
              <!-- How to approve Section -->
              <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827;">
                How to approve
              </h2>
              <p style="margin: 0 0 24px; font-size: 16px; line-height: 24px; color: #374151;">
                To review and approve your teen's payment account setup, please click the link below:
              </p>
              
              <!-- Approve Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 32px;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                      <tr>
                        <td align="center" style="background-color: #73af17; border-radius: 8px;">
                          <a href="${dashboardUrl}" style="background-color: #73af17; border: 0; border-radius: 8px; color: #ffffff; display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; line-height: 50px; text-decoration: none; text-align: center; width: 280px; -webkit-text-size-adjust: none;">
                            Review & Approve Payment Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                This will take only a few minutes. You can approve or reject the request from your parent dashboard.
              </p>
              
              <!-- Questions -->
              <p style="margin: 0 0 32px; font-size: 16px; line-height: 24px; color: #374151;">
                If you have questions or would like more information before approving, you can visit <a href="https://olliejobs.com/parents" style="color: #73af17; text-decoration: underline;">olliejobs.com/parents</a> or contact us at <a href="mailto:approvals@olliejobs.com" style="color: #73af17; text-decoration: underline;">approvals@olliejobs.com</a>.
              </p>
              
              <!-- Closing -->
              <p style="margin: 0 0 8px; font-size: 16px; line-height: 24px; color: #374151;">
                Thank you for helping your teen manage their earnings responsibly.
              </p>
              
              <p style="margin: 24px 0 0; font-size: 16px; line-height: 24px; color: #374151;">
                Warm regards,<br>
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
    console.log('📧 STRIPE APPROVAL EMAIL PREVIEW:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('To:', parentEmail)
    console.log('From:', `${resendFromName} <${resendFromEmail}>`)
    console.log('Subject:', emailSubject)
    console.log('Dashboard URL:', dashboardUrl)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Send email using Resend API
    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      
      if (!resendApiKey) {
        console.log('⚠️ RESEND_API_KEY not configured. Email details logged above.')
        console.log('📧 To send emails, set RESEND_API_KEY in Edge Function secrets')
        console.log('Get your API key from: https://resend.com/api-keys')
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email prepared. Configure RESEND_API_KEY in Edge Function secrets to send emails.',
            dashboardUrl,
            emailDetails: {
              to: parentEmail,
              from: `${resendFromName} <${resendFromEmail}>`,
              subject: emailSubject,
            },
            note: 'Set RESEND_API_KEY in Edge Function secrets to enable email sending. Get your key from https://resend.com/api-keys',
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
            dashboardUrl,
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
          message: 'Check Edge Function logs for details. Use dashboardUrl for testing.',
          dashboardUrl,
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

