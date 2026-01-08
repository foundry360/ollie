# Complete List of Popups/Alerts in Ollie App

This document lists all popups, alerts, and dialogs used throughout the app. All system alerts should be migrated to use the custom `Alert` component from `@/components/ui/Alert` to match the app's theme.

## System Alerts (Alert.alert)

### Authentication & Account
1. **Login Screen** (`app/auth/login.tsx`)
   - Error: "Email is required"
   - Error: "Please enter a valid email address"
   - Error: "Password is required"
   - Error: "Invalid email or password"
   - Success: "Password reset email sent"
   - Error: "Failed to send password reset email"

2. **Logout** (`components/Drawer.tsx`)
   - Confirmation: "Are you sure you want to logout?"
   - Success: "You have been logged out."

3. **Settings** (`app/(tabs)/settings.tsx`)
   - Error: "Please fill in all password fields"
   - Error: "Password must be at least 8 characters"
   - Error: "New passwords do not match"
   - Success: "Password changed successfully!"
   - Error: "Failed to change password"
   - Coming Soon: Various feature placeholders
   - Delete Account: Two-step confirmation dialogs

4. **Profile** (`app/(tabs)/profile.tsx`)
   - Permission Denied: Photo library/camera permissions
   - Success: "Profile photo updated successfully!"
   - Error: "Failed to upload profile photo"
   - Success: "Account info updated successfully!"
   - Error: "Failed to update account info"
   - Success: "Location updated successfully!"
   - Error: "Failed to update location"
   - Success: "Bio updated successfully!"
   - Error: "Failed to update bio"
   - Success: "Skills updated successfully!"
   - Error: "Failed to update skills"
   - Success: "Availability updated successfully!"
   - Error: "Failed to update availability"

### Tasks & Gigs
5. **Task Detail** (`app/tasks/[id].tsx`)
   - Confirmation: "Accept Task" with confirmation
   - Success: "Task accepted! Waiting for parent approval if required."
   - Error: "Failed to accept task"
   - Success: "Task started!"
   - Error: "Failed to start task"
   - Confirmation: "Complete Task" with confirmation
   - Error: "Failed to complete task"
   - Confirmation: "Cancel Task" with confirmation
   - Success: "Task cancelled."
   - Error: "Failed to cancel task"
   - Error: "Could not open maps app"

6. **Gig Detail Modal** (`components/tasks/GigDetailModal.tsx`)
   - Confirmation: "Apply for this gig?"
   - Success: "Application submitted! The neighbor will review your application."
   - Error: "Failed to apply for gig"
   - Success: "Application approved and scheduled!"
   - Error: "Failed to approve application"
   - Confirmation: "Reject Application" with reason prompt
   - Success: "Application rejected."
   - Error: "Failed to reject application"
   - Confirmation: "Delete Gig" with confirmation
   - Success: "Gig deleted successfully."
   - Error: "Failed to delete gig"
   - Error: "Could not open maps app"
   - Confirmation: "Start Gig" with confirmation
   - Success: "Gig started!"
   - Error: "Failed to start gig"
   - Success: "Gig removed from saved" / "Gig saved!"
   - Error: "Failed to save gig"
   - Confirmation: "Complete Gig" with confirmation
   - Error: "Failed to complete gig"
   - Success: "Proposed schedule accepted!"
   - Error: "Failed to accept proposed schedule"
   - Success: "Proposed schedule rejected"
   - Error: "Failed to update schedule"

7. **Create Gig Modal** (`components/tasks/CreateGigModal.tsx`)
   - Validation Error: "Title must be at least 3 characters"
   - Validation Error: "Description must be at least 10 characters"
   - Validation Error: "Please select at least one skill"
   - Validation Error: "Please enter a valid pay amount"
   - Validation Error: "Please get your location first"
   - Error: "Failed to load teenlancers"
   - Success: "Gig created successfully!"
   - Error: "Failed to create gig"

8. **Schedule Confirmation Modal** (`components/tasks/ScheduleConfirmationModal.tsx`)
   - Success: "Schedule confirmed!"
   - Error: "Failed to confirm schedule"
   - Error: "Please select a date for your proposed schedule"
   - Success: "Schedule proposal sent to the neighbor!"
   - Error: "Failed to propose schedule"

9. **Teen Upcoming Scheduled Gigs** (`components/home/TeenUpcomingScheduledGigs.tsx`)
   - Success: "{taskTitle} started!"
   - Error: "Failed to start task"
   - Confirmation: "Complete Task" with confirmation
   - Error: "Failed to complete task"

10. **Completion Approvals Card** (`components/home/CompletionApprovalsCard.tsx`)
    - Success: "Completion approved. Payment will be processed."
    - Error: "Failed to approve completion"
    - Success: "Completion rejected. Gig status reverted to in progress."
    - Error: "Failed to reject completion"
    - Confirmation: "Approve Completion" with confirmation
    - Confirmation: "Reject Completion" with reason prompt

### Payments
11. **Payment Setup** (`app/(tabs)/payment-setup.tsx`)
    - Success: "Setup email sent to parent"
    - Error: "Failed to send setup email"
    - Success: "Bank account verified successfully!"
    - Error: "Verification Failed" - amounts don't match
    - Confirmation: "Delete Bank Account" with confirmation
    - Success: "Bank account deleted successfully"
    - Error: "Failed to delete bank account"
    - Success: "Bank account verification email sent"
    - Error: "Failed to resend deposits"

12. **Payment Methods** (`app/(tabs)/payment-methods.tsx`, `components/payments/PaymentMethodsContent.tsx`)
    - Error: "Failed to load payment methods"
    - Success: "Default payment method updated"
    - Error: "Failed to set default payment method"
    - Confirmation: "Remove Payment Method" with confirmation
    - Success: "Payment method removed"
    - Error: "Failed to remove payment method"

13. **Add Payment Method Modal** (`components/payments/AddPaymentMethodModal.tsx`)
    - Error: "Invalid Card" - invalid card number
    - Error: "Required Field" - cardholder name
    - Error: "Not Supported" - payment methods on web
    - Error: "Failed to add payment method"
    - Success: "Payment method added successfully"

14. **Bank Account Setup** (`app/payments/bank-account-setup.tsx`, `app/parent/bank-setup.tsx`)
    - Error: "Invalid setup token"
    - Success: "Bank account connected successfully!"
    - Error: "Failed to connect bank account"
    - Error: "Financial Connections is not available on this platform"

### Messages
15. **Chat Screen** (`app/chat/[taskId].tsx`)
    - Error: "Failed to load messages"
    - Error: "Cannot Send" - empty message
    - Error: "Cannot Send" - missing information
    - Error: "Error Sending Message"

### Parent Dashboard
16. **Parent Dashboard** (`app/parent/dashboard.tsx`)
    - Confirmation: "Approve Task" with confirmation
    - Success: "Task approved!"
    - Error: "Failed to approve task"
    - Confirmation: "Reject Task" with reason prompt
    - Success: "Task rejected"
    - Error: "Failed to reject task"

### Reviews
17. **Add Review Modal** (`components/reviews/AddReviewModal.tsx`)
    - Error: "Please select a rating"
    - Error: "Please write a review"
    - Success: "Review submitted successfully!"
    - Error: "Failed to submit review"

### Signup & Onboarding
18. **Signup Screens** (`app/auth/signup-teen.tsx`, `app/auth/signup-adult.tsx`)
    - Various validation errors
    - Success/Error messages for signup flow

19. **Age Gate** (`app/auth/age-gate.tsx`, `app/auth/age-gate-teen.tsx`)
    - Age validation errors

20. **Complete Neighbor Profile** (`app/auth/complete-neighbor-profile.tsx`)
    - Error: "Failed to complete profile"

21. **Verify Phone/Email** (`app/auth/verify-phone.tsx`, `app/auth/verify-id.tsx`, `app/auth/confirm-email.tsx`)
    - Verification errors and success messages

22. **Reset Password** (`app/auth/reset-password.tsx`)
    - Password reset errors and success

### Other
23. **QR Code** (`app/(tabs)/qr-code.tsx`)
    - Various sharing/error messages

24. **Verification Upload** (`app/verification/upload.tsx`)
    - Upload errors and success

25. **Create Task** (`app/tasks/create.tsx`)
    - Task creation errors and success

## Custom Modals & Bottom Sheets

These already use custom components and are properly themed:

1. **BottomSheet** (`components/ui/BottomSheet.tsx`) - Used for:
   - Change Password (Settings)
   - Payment Methods (Settings)
   - Profile editing sections
   - Various forms

2. **GigDetailModal** (`components/tasks/GigDetailModal.tsx`)
3. **CreateGigModal** (`components/tasks/CreateGigModal.tsx`)
4. **ScheduleConfirmationModal** (`components/tasks/ScheduleConfirmationModal.tsx`)
5. **ApproveApplicationModal** (`components/tasks/ApproveApplicationModal.tsx`)
6. **AddPaymentMethodModal** (`components/payments/AddPaymentMethodModal.tsx`)
7. **AddReviewModal** (`components/reviews/AddReviewModal.tsx`)
8. **ReviewsModal** (`components/reviews/ReviewsModal.tsx`)
9. **ProfileModal** (`components/profile/ProfileModal.tsx`)
10. **PaymentSummaryModal** (`components/earnings/PaymentSummaryModal.tsx`)
11. **PaymentsModal** (`components/home/PaymentsModal.tsx`)
12. **CompletedGigsModal** (`components/home/CompletedGigsModal.tsx`)
13. **TaskFilters Modal** (`components/tasks/TaskFilters.tsx`)

## Migration Plan

To migrate all `Alert.alert` calls to use the custom themed Alert:

1. Replace `import { Alert } from 'react-native'` with `import { Alert } from '@/components/ui/Alert'`
2. The API is compatible - `Alert.alert(title, message, buttons, options)` works the same way
3. All alerts will automatically match the app's theme (light/dark mode)

## Priority Alerts to Migrate

High Priority (User-facing, frequently used):
- Logout confirmation
- Delete account confirmations
- Task/Gig actions (accept, start, complete, cancel)
- Payment method removal
- Bank account deletion

Medium Priority:
- Form validation errors
- Success messages
- Permission requests

Low Priority:
- Debug/development alerts
- Coming soon placeholders

