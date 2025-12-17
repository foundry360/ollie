# Pending Application Login Fix

## Problem
When a neighbor tried to log in before their application was approved, they could bypass the approval process:
- ❌ Login succeeded with valid credentials
- ❌ System automatically created a full user profile
- ❌ User gained access to the main app without approval
- ❌ Approval process was completely bypassed

## Solution Implemented

### 1. Updated Login Flow (`app/auth/login.tsx`)

**Added:**
- Import `getNeighborApplicationByUserId` function
- Check for pending applications when profile doesn't exist
- Redirect based on application status:
  - **`pending`** → Redirect to `/auth/pending-neighbor-approval`
  - **`rejected`** → Redirect to `/auth/neighbor-rejected`
  - **`approved`** → Continue with profile creation

**Flow:**
```
Login with email/password
  ↓
Profile exists? → Yes → Load profile → Access granted ✅
  ↓ No
Check pending application
  ↓
Status = pending? → Redirect to pending screen (show alert) 🔄
Status = rejected? → Redirect to rejected screen (show alert) ❌
Status = approved or no application? → Create profile → Access granted ✅
```

### 2. Updated App Initialization (`app/_layout.tsx`)

**Added:**
- Import `getNeighborApplicationByUserId` function
- Check for pending applications on app launch
- Enhanced navigation guard to handle pending applications

**Changes:**

#### Session Check (lines 66-101):
- When profile doesn't exist, check for pending application
- Log application status for debugging
- Don't create profile if application is pending

#### Navigation Guard (lines 227-269):
- When logged-in user is on splash/role-selection:
  - Check for pending application
  - Redirect to pending screen if `status = 'pending'`
  - Redirect to rejected screen if `status = 'rejected'`
  - Redirect to tabs if `status = 'approved'` or no application

### 3. Created Rejection Screen (`app/auth/neighbor-rejected.tsx`)

**New screen showing:**
- ❌ Red "close-circle" icon
- Clear message: "Application Not Approved"
- Rejection reason (if provided)
- Info about contacting support
- Sign Out button
- Contact Support link

## How It Works Now

### Scenario 1: Neighbor logs in while application is pending
1. ✅ Login succeeds (valid credentials)
2. ✅ System checks for profile → not found
3. ✅ System checks for pending application → found with status `'pending'`
4. ✅ Alert shown: "Your neighbor application is still under review"
5. ✅ Redirected to `/auth/pending-neighbor-approval`
6. ✅ Screen polls for status updates every 10 seconds
7. ⏳ User waits for admin approval

### Scenario 2: Neighbor logs in after rejection
1. ✅ Login succeeds
2. ✅ System checks for profile → not found
3. ✅ System checks for pending application → found with status `'rejected'`
4. ✅ Alert shown: "Your application was not approved"
5. ✅ Redirected to `/auth/neighbor-rejected`
6. ✅ User sees rejection reason and can contact support

### Scenario 3: Approved neighbor logs in
1. ✅ Login succeeds
2. ✅ System checks for profile → not found
3. ✅ System checks for pending application → found with status `'approved'`
4. ✅ System creates full user profile
5. ✅ User gains access to main app

### Scenario 4: Regular user (no application)
1. ✅ Login succeeds
2. ✅ System checks for profile → not found
3. ✅ System checks for pending application → not found
4. ✅ System creates user profile (OAuth or other signup method)
5. ✅ User gains access to main app

## Security Improvements

✅ **Approval Process Enforced:** Users can't bypass the approval workflow  
✅ **Status Checked on Every Login:** Fresh status from database  
✅ **Multiple Guard Points:** Login screen + App initialization + Navigation guard  
✅ **Clear User Communication:** Specific alerts for each scenario  
✅ **Proper Redirects:** Users always land on the correct screen for their status  

## Files Modified

1. **`app/auth/login.tsx`**
   - Added pending application check
   - Added status-based redirects
   - Added user-friendly alerts

2. **`app/_layout.tsx`**
   - Added pending application check on app launch
   - Enhanced navigation guard
   - Added async application status checking

3. **`app/auth/neighbor-rejected.tsx`** (NEW)
   - Created rejection screen
   - Shows rejection reason
   - Provides support contact option

## Testing Checklist

- [ ] Login with pending application → redirected to pending screen
- [ ] Login with rejected application → redirected to rejected screen  
- [ ] Login with approved application → profile created, access granted
- [ ] Login as regular user (no application) → profile created, access granted
- [ ] App launch with pending application → redirected to pending screen
- [ ] Pending screen auto-redirects when status changes to approved
- [ ] Pending screen auto-redirects when status changes to rejected

## Next Steps

To complete the neighbor signup flow, you still need:
- [ ] Admin approval interface (`app/admin/neighbor-applications.tsx`)
- [ ] Admin API functions for approve/reject
- [ ] Complete neighbor profile screen (final setup after approval)

