# Deploy delete-user-account Edge Function

## The Issue
The Edge Function is returning a 404 error, which means it's not deployed to Supabase.

## Solution: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard
1. Open your Supabase project dashboard: https://supabase.com/dashboard/project/enxxlckxhcttvsxnjfnw
2. Navigate to **Edge Functions** → **Functions** (in the left sidebar)

### Step 2: Create the Function
1. Click **"Create a new function"** button
2. Name it: `delete-user-account` (must match exactly, with hyphens)
3. Click **"Create function"**

### Step 3: Copy the Code
1. Open the file: `supabase/functions/delete-user-account/index.ts` in your editor
2. Copy **ALL** the code from that file (lines 1-112)
3. Paste it into the Supabase Dashboard code editor (replace any default code)

### Step 4: Deploy
1. Click **"Deploy"** button (top right)
2. Wait for deployment to complete (you'll see a success message)

### Step 5: Verify
1. The function should now appear in your functions list
2. You can test it using the "Invoke" button in the Dashboard
3. The function URL should be: `https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/delete-user-account`

## Alternative: Deploy via CLI

If you have Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref enxxlckxhcttvsxnjfnw

# Deploy the function
supabase functions deploy delete-user-account
```

## Important Notes

- The function name must be `delete-user-account` (with hyphens, not underscores)
- No environment variables need to be set manually - Supabase automatically provides:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_ANON_KEY`
- After deployment, the 404 error should disappear

## Troubleshooting

### Bundle Timeout Issues

If you get a "bundle times out" error when deploying via the dashboard:

1. **Try deploying via CLI instead:**
   ```bash
   # Make sure you're in the project root
   cd /Users/jasongelsomino/Ollie
   
   # Login and link (if not already done)
   supabase login
   supabase link --project-ref enxxlckxhcttvsxnjfnw
   
   # Try standard deployment
   supabase functions deploy delete-user-account
   
   # If that fails, try with --use-api flag
   supabase functions deploy delete-user-account --use-api
   
   # Or try with --use-docker flag
   supabase functions deploy delete-user-account --use-docker
   ```

2. **Or use the deployment script:**
   ```bash
   ./supabase/functions/delete-user-account/deploy.sh
   ```

3. **Wait and retry:** Sometimes Supabase's bundler has temporary issues. Wait 5-10 minutes and try again.

4. **Check function size:** The function should be very small (< 1KB). If it's larger, there might be an issue.

### 404 Errors After Deployment

If you still get a 404 after deployment:
1. Check that the function name matches exactly: `delete-user-account`
2. Wait a few seconds for the deployment to propagate
3. Check the Edge Functions logs in the Supabase Dashboard for any errors
4. Try refreshing the function list in the dashboard
5. Verify the function appears in the Edge Functions list

