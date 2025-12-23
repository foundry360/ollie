# How to Test manage-twilio-conversation Function

## The Problem
The function requires a valid Supabase JWT token with a "sub" claim. Using the anon key will fail with "missing sub claim" error.

## Solution: Get a Valid User JWT Token

### Option 1: From Your App (Recommended)

1. Open your app and log in
2. In your browser/app console, run:
```javascript
// If using Supabase client
const { data: { session } } = await supabase.auth.getSession();
console.log('JWT Token:', session?.access_token);
```

3. Copy the token (it should be much longer than 219 characters)

### Option 2: Use Supabase Dashboard Function Invoker

1. Go to **Supabase Dashboard** → **Edge Functions** → `manage-twilio-conversation`
2. Click **Invoke** or **Test**
3. In the **Authorization** field, you need to provide a user JWT token
4. To get one, you can:
   - Use the Supabase Auth API to create a test session
   - Or use a token from your logged-in app

### Option 3: Create a Test Token via API

```bash
# First, sign in a user via Supabase Auth API
curl -X POST 'https://enxxlckxhcttvsxnjfnw.supabase.co/auth/v1/token?grant_type=password' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'

# This will return an access_token - use that as your Bearer token
```

## Test Request

Once you have a valid JWT token:

```bash
curl -X POST https://enxxlckxhcttvsxnjfnw.supabase.co/functions/v1/manage-twilio-conversation \
  -H "Authorization: Bearer YOUR_VALID_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "gig_id": "c6ba68d4-e866-4a8c-91b1-30fcf470066d",
    "participant1_id": "4dddc850-eda7-4149-84de-65c97b77973b",
    "participant2_id": "91342eda-636e-4263-8dfe-521d3aa7b5b8"
  }'
```

## Important Notes

- **DO NOT use the anon key** - it will fail with "missing sub claim"
- The token must be from an authenticated user session
- The token should be 200+ characters (JWT tokens are typically longer)
- The token should have a "sub" claim containing the user ID







