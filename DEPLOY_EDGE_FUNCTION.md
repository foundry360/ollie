# Deploy Edge Function - Quick Guide

## The Issue
The Edge Function is returning a 404 error, which means it's not deployed to Supabase.

## Solution: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project dashboard
2. Navigate to **Edge Functions** → **Functions**

### Step 2: Create/Update the Function
1. Click **"Create a new function"** or find `send-parent-approval-email` if it exists
2. If it exists, click on it to edit
3. If it doesn't exist, create it with the name: `send-parent-approval-email`

### Step 3: Copy the Code
1. Open the file: `supabase/functions/send-parent-approval-email/index.ts`
2. Copy **ALL** the code from that file
3. Paste it into the Supabase Dashboard code editor

### Step 4: Deploy
1. Click **"Deploy"** or **"Save"**
2. Wait for deployment to complete

### Step 5: Verify
1. The function should now appear in your functions list
2. You can test it using the "Invoke" button in the Dashboard
3. Make sure `RESEND_API_KEY` is set in Edge Function Secrets

## Alternative: Deploy via CLI (if you have Supabase CLI)

```bash
# Login to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref enxxlckxhcttvsxnjfnw

# Deploy the function
supabase functions deploy send-parent-approval-email
```

## Verify Deployment

After deployment, the function should be accessible at:
```
https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/send-parent-approval-email
```

The 404 error should disappear once the function is properly deployed.

