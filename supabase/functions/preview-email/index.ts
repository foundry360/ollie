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
    // Get test data from query params or body
    const url = new URL(req.url)
    const teenName = url.searchParams.get('teenName') || 'John Doe'
    const teenAge = url.searchParams.get('teenAge') || '15'
    const approvalUrl = url.searchParams.get('approvalUrl') || 'http://localhost:8081/parent-approve?token=test-token-123'

    const emailSubject = `Approve ${teenName}'s Ollie Account`
    const emailBodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #73af17; margin: 0; font-size: 28px;">Ollie</h1>
    </div>
    
    <h2 style="color: #333; margin-top: 0;">Parent Approval Request</h2>
    
    <p>Hello,</p>
    
    <p>Your child <strong>${teenName}</strong>${teenAge ? ` (age ${teenAge})` : ''} has requested to create an Ollie account.</p>
    
    <p>Please review and approve or reject this request by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${approvalUrl}" 
         style="background-color: #73af17; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
        Review Approval Request
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #73af17; font-size: 14px; background-color: #f9f9f9; padding: 10px; border-radius: 4px;">${approvalUrl}</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
      This link will expire in 7 days. If you did not expect this email, please ignore it.
    </p>
  </div>
</body>
</html>
    `.trim()

    // Return HTML preview
    return new Response(emailBodyHtml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

