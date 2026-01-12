# Send Prelaunch Confirmation Email

This edge function sends a prelaunch confirmation email to Teenlancers, Neighbors, and Parents of Teenlancers who have joined the prelaunch list.

## Overview

The email confirms that the lead is on Ollie's prelaunch list and provides information about what they can expect when Ollie launches in their area. The email content is customized based on the lead type:
- **Teenlancers** (teens): Information about earning money and building responsibility
- **Neighbors** (adults): Information about posting tasks and connecting with local teens
- **Parents**: Information about safety features and how their teen can participate

**Note:** This function is designed for leads (people who signed up for the prelaunch list), not existing users. The `recipientType` must be provided when calling the function, typically determined when the lead signs up for the prelaunch list.

## Usage

### POST Request

Send a POST request to the edge function with the following JSON body:

```json
{
  "email": "recipient@example.com",
  "fullName": "John Doe",
  "recipientType": "teen" // required - must be "teen", "neighbor", or "parent"
}
```

#### Required Fields:
- `email`: The lead's email address (these are leads, not existing users)
- `fullName`: The lead's full name
- `recipientType`: The type of lead. Must be one of:
  - `"teen"` - For Teenlancers (teens interested in joining)
  - `"neighbor"` - For Neighbors (adults interested in posting tasks)
  - `"parent"` - For Parents of Teenlancers (parents interested in their teens joining)

### GET Request (Preview)

You can preview the email in a browser by making a GET request with query parameters:

```
GET /send-prelaunch-confirmation-email?fullName=John+Doe&recipientType=teen
```

Query parameters:
- `fullName`: The recipient's full name (defaults to "John Doe")
- `recipientType`: The type of recipient (defaults to "teen")

## Configuration

The following environment variables must be set in Supabase Edge Function secrets:

- `RESEND_API_KEY`: Your Resend API key (required for sending emails)
- `RESEND_FROM_EMAIL`: The email address to send from (defaults to "onboarding@resend.dev")
- `RESEND_FROM_NAME`: The name to display as sender (defaults to "Ollie")
- `EMAIL_HEADER_URL`: URL to the email header image (optional - defaults to launchemail.png from Supabase Storage)
- `CONNECTED_BODY_URL`: URL to a body image shown in the email (optional)
- `SUPABASE_URL`: Your Supabase project URL (used to construct the launchemail.png URL if EMAIL_HEADER_URL is not set)

**Note:** The function uses `launchemail.png` as the header image by default. To use this image:

1. Upload `launchemail.png` to Supabase Storage in a public bucket named `email-assets`
2. Or host the image elsewhere and set `EMAIL_HEADER_URL` to the full URL
3. Or if using Supabase Storage, the URL will be automatically constructed from `SUPABASE_URL`

## Example Usage

### Using cURL

```bash
curl -X POST https://your-project.supabase.co/functions/v1/send-prelaunch-confirmation-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teen@example.com",
    "fullName": "Jane Smith",
    "recipientType": "teen"
  }'
```

### Using JavaScript/TypeScript

```typescript
const { data, error } = await supabase.functions.invoke('send-prelaunch-confirmation-email', {
  body: {
    email: 'teen@example.com',
    fullName: 'Jane Smith',
    recipientType: 'teen'
  }
})
```

### Sending to Multiple Recipients

To send to multiple recipients, call the function multiple times. Each lead must specify their recipient type:

```typescript
const leads = [
  { email: 'teen@example.com', fullName: 'Jane Smith', recipientType: 'teen' },
  { email: 'neighbor@example.com', fullName: 'John Doe', recipientType: 'neighbor' },
  { email: 'parent@example.com', fullName: 'Mary Johnson', recipientType: 'parent' }
]

for (const lead of leads) {
  await supabase.functions.invoke('send-prelaunch-confirmation-email', {
    body: lead
  })
}
```

**Note:** These are leads (people who signed up for the prelaunch list), not existing users. The recipient type should be determined when they sign up for the prelaunch list (e.g., based on which form they filled out or which role they selected).

## Response

### Success Response

```json
{
  "success": true,
  "message": "Prelaunch confirmation email sent successfully",
  "emailId": "resend_email_id",
  "recipientType": "teen"
}
```

### Error Response

```json
{
  "success": false,
  "error": "Failed to send email",
  "message": "Check Edge Function logs for details.",
  "errorDetails": "Error details here"
}
```

## Email Template

The email uses a responsive HTML template with:
- Header image (if `EMAIL_HEADER_URL` is configured)
- Personalized greeting using the recipient's first name
- Customized content based on recipient type
- Connected body image (if `CONNECTED_BODY_URL` is configured)
- Footer with Ollie branding and contact information

The email template prevents dark mode color inversion and is optimized for email clients.

