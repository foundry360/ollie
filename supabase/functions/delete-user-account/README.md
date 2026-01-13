# Delete User Account Edge Function

This edge function handles complete account deletion, including both the user profile (`public.users`) and the authentication account (`auth.users`).

## What It Does

1. **Verifies Authentication**: Ensures the user is authenticated and can only delete their own account
2. **Deletes User Profile**: Removes the profile from `public.users`, which cascades to delete all related data (gigs, messages, earnings, etc.)
3. **Deletes Auth Account**: Removes the account from `auth.users` using admin privileges

## Security

- Users can only delete their own account (verified via auth token)
- Requires service role key for admin operations
- Validates authentication before proceeding

## Deployment

### Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Functions**
3. Click **"Create a new function"** or find `delete-user-account` if it exists
4. Name it: `delete-user-account`
5. Copy the code from `supabase/functions/delete-user-account/index.ts`
6. Paste it into the Supabase Dashboard code editor
7. Click **"Deploy"** or **"Save"**

### Via Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy delete-user-account
```

## Environment Variables

The function uses these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for admin operations)
- `SUPABASE_ANON_KEY` - Anonymous key (for auth verification)

These are automatically set in Supabase Edge Functions - no manual configuration needed.

## Usage

The function is called automatically when a user deletes their account from the mobile app. The `deleteAccount()` function in `lib/api/users.ts` handles the invocation.

## Testing

You can test the function using the Supabase Dashboard:
1. Go to **Edge Functions** → **Functions** → `delete-user-account`
2. Click **"Invoke"**
3. Provide a test request with an Authorization header from an authenticated user

## Migration Required

Before using this function, make sure to run migration `110_add_delete_user_account_function.sql` which:
- Creates the `delete_user_account()` database function (fallback)
- Adds RLS policy for profile deletion

The edge function is the preferred method as it handles complete deletion including the auth account.















