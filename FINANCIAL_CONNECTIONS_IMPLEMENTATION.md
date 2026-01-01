# Stripe Financial Connections Implementation Plan

## Overview
Stripe Financial Connections provides instant bank account verification and automatic payment method creation/attachment, eliminating the need for micro-deposits and manual verification.

## Architecture

### Flow:
1. **Server-side**: Create a Financial Connections Session
2. **Client-side**: Present Financial Connections UI using Stripe React Native SDK
3. **User**: Connects bank account through Stripe's secure UI
4. **Stripe**: Automatically verifies and creates payment method (already attached to customer)
5. **Webhook/Callback**: Handle completion and store in database

## Implementation Steps

### Step 1: Edge Function Created ✅
- **File**: `supabase/functions/create-financial-connections-session/index.ts`
- **Endpoint**: `create-financial-connections-session`
- Creates a Financial Connections Session with:
  - `customer`: Stripe customer ID (created if needed)
  - `permissions`: ['payment_method', 'balances']
  - `filters`: { countries: ['US'] }
  - `payment_method_type`: 'us_bank_account'
  - `payment_method_collection`: 'always' (automatically creates and attaches payment method)

### Step 2: Client-Side Integration (Next Step)
Use `@stripe/stripe-react-native` SDK:

```typescript
import { useFinancialConnectionsSheet } from '@stripe/stripe-react-native';

// In your component:
const { presentFinancialConnectionsSheet } = useFinancialConnectionsSheet();

const handleConnectBank = async () => {
  // 1. Call your edge function to create session
  const { data, error } = await supabase.functions.invoke(
    'create-financial-connections-session',
    {
      body: {
        teen_user_id: teenId,
        approval_token: token,
      }
    }
  );

  if (error || !data?.session?.client_secret) {
    Alert.alert('Error', 'Failed to create connection session');
    return;
  }

  // 2. Present Financial Connections UI
  const { error: sheetError } = await presentFinancialConnectionsSheet({
    clientSecret: data.session.client_secret,
    onEvent: (event) => {
      if (event.name === 'financialConnectionsSheetCompleted') {
        // Handle success - payment method is already created and attached
        // You can now fetch it from Stripe or wait for webhook
      }
    }
  });

  if (sheetError) {
    Alert.alert('Error', sheetError.message);
  }
};
```

### Step 3: Webhook Handler (Optional but Recommended)
- Listen for `payment_method.attached` or `financial_connections.account.created` events
- Store payment method in database
- Update bank account record

## API Endpoints

### Your Edge Function
```
POST /functions/v1/create-financial-connections-session
{
  "teen_user_id": "uuid",
  "approval_token": "token", // optional
  "customer_id": "cus_xxx" // optional - will create if not provided
}
```

### Response
```json
{
  "success": true,
  "session": {
    "id": "fcsess_xxx",
    "client_secret": "fcsess_xxx_secret_xxx",
    "customer": "cus_xxx",
    "status": "pending"
  },
  "customer_id": "cus_xxx"
}
```

## Benefits
- ✅ Instant verification (no micro-deposits needed)
- ✅ Automatic payment method creation and attachment
- ✅ Better UX (secure Stripe UI, no manual entry)
- ✅ Supports thousands of US banks
- ✅ Built-in fraud protection
- ✅ No "must verify before attach" errors

## Key Differences from Current Approach

### Current (Manual Form):
1. User enters bank details manually
2. Create payment method
3. ❌ Cannot attach (needs verification)
4. Store in DB (unattached)
5. Requires separate verification flow

### Financial Connections:
1. User connects via Stripe UI
2. ✅ Instant verification
3. ✅ Payment method automatically created AND attached
4. Store in DB (already attached and verified)
5. Ready to use immediately

## Next Steps
1. ✅ Edge function created
2. ⏳ Update client-side code to use Financial Connections
3. ⏳ Add webhook handler (optional)
4. ⏳ Test end-to-end flow
5. ⏳ Update UI to show Financial Connections option

## Testing
1. Deploy the edge function: `supabase functions deploy create-financial-connections-session`
2. Test creating a session
3. Integrate client-side SDK
4. Test the full flow

## Documentation References
- [Stripe Financial Connections Docs](https://docs.stripe.com/financial-connections)
- [Stripe React Native SDK - Financial Connections](https://stripe.dev/stripe-react-native/api-reference/functions/useFinancialConnectionsSheet)
- [Financial Connections Demo](https://financial-connections.stripe.dev/)
