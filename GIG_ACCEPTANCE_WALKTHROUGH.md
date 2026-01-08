# Neighbor and Teenlancer Interaction: Accepting a Gig

This document walks through the complete flow of how a neighbor (gig poster) and a teenlancer interact to accept a gig.

## Overview

The gig acceptance process follows these main steps:
1. **Neighbor posts a gig** (status: `open`)
2. **Teenlancer applies** for the gig (creates application with status: `pending`)
3. **Neighbor reviews applications** and can message applicants
4. **Neighbor approves an application** (gig status changes to `accepted`, teen_id is assigned)
5. **Parent approval** (if teen has a parent, automatic approval request is created)
6. **Teen starts the gig** (status: `in_progress`)
7. **Teen completes the gig** (status: `completed`)
8. **Earnings are processed**

---

## Step-by-Step Flow

### Step 1: Neighbor Creates a Gig

**Location:** `app/tasks/create.tsx`, `lib/api/tasks.ts`

- Neighbor (user with role `'poster'`) creates a new gig using the create task form
- Gig is created with:
  - `status: 'open'`
  - `poster_id: user.id`
  - `teen_id: null` (not yet assigned)
- Gig appears in the open gigs list for teenlancers to browse

**API Call:**
```typescript
createTask({
  title: string,
  description: string,
  pay: number,
  location: { latitude, longitude },
  address: string,
  required_skills?: string[],
  estimated_hours?: number,
  photos?: string[]
})
```

---

### Step 2: Teenlancer Applies for the Gig

**Location:** `lib/api/tasks.ts` (lines 477-522), `components/tasks/GigDetailModal.tsx` (lines 163-191)

**Teenlancer Side:**
1. Teenlancer browses open gigs and finds one they're interested in
2. Clicks "Apply" button on the gig detail modal
3. Confirmation dialog appears: "Are you sure you want to apply for [gig title]?"
4. On confirmation, the application is submitted

**What Happens:**
- `applyForGig(taskId)` is called, which uses the database function `apply_for_gig`
- A record is created in `gig_applications` table:
  - `gig_id`: The gig ID
  - `teen_id`: The teenlancer's user ID
  - `status: 'pending'`
  - `created_at`: Timestamp
- The gig remains `'open'` (status doesn't change yet)
- Other teenlancers can still apply

**API Call:**
```typescript
applyForGig(taskId: string)
// Internally calls: supabase.rpc('apply_for_gig', { p_gig_id: taskId })
```

**UI Feedback:**
- Success alert: "Application submitted! The neighbor will review your application."
- Button changes to "Applied" (disabled state)

---

### Step 3: Neighbor Views Applications

**Location:** `components/tasks/GigDetailModal.tsx` (lines 735-809), `lib/api/gigApplications.ts` (lines 32-92)

**Neighbor Side:**
1. Neighbor opens their posted gig (status: `open`)
2. Sees "Applicants (X)" section showing all pending applications
3. Each application card displays:
   - Teenlancer's profile photo
   - Teenlancer's name
   - Age (if available)
   - Rating and review count
   - "Message" button to start a conversation

**What Happens:**
- `getGigApplications(gigId)` fetches all applications for the gig
- Applications are joined with:
  - `users` table (teen profile info)
  - `gigs` table (gig details)
  - Rating data from reviews
- Only applications with `status: 'pending'` are shown

**API Call:**
```typescript
getGigApplications(gigId: string): Promise<GigApplication[]>
```

**UI Features:**
- Neighbor can click on an applicant's card to view their full profile
- Neighbor can click "Message" to start a chat with a specific applicant
- Applications are sorted by `created_at` (newest first)

---

### Step 4: Neighbor Messages Applicant (Optional)

**Location:** `app/chat/[taskId].tsx`, `components/tasks/GigDetailModal.tsx` (line 793)

**Neighbor Side:**
1. Neighbor clicks "Message" button on an applicant's card
2. Chat screen opens with the selected teenlancer
3. Neighbor can ask questions, discuss details, etc.

**What Happens:**
- Chat route: `/chat/${taskId}?recipientId=${application.teen_id}`
- Messages are stored in `messages` table with:
  - `gig_id`: The gig ID
  - `sender_id`: Neighbor's user ID
  - `recipient_id`: Teenlancer's user ID
  - `content`: Message text
- Real-time updates via Supabase Realtime subscriptions

**Note:** For open gigs without an assigned teen, neighbors must select a specific applicant to message (they can't use the general chat button).

---

### Step 5: Neighbor Approves an Application

**Location:** `components/tasks/GigDetailModal.tsx` (lines 193-214), `lib/api/gigApplications.ts` (lines 239-275)

**Neighbor Side:**
1. Neighbor reviews applications and decides on a teenlancer
2. Neighbor clicks "Approve" (or similar action) on an applicant's card
3. Confirmation dialog: "Are you sure you want to approve this teenlancer for this gig?"
4. On confirmation, the application is approved

**What Happens:**
- `approveGigApplication(applicationId)` is called
- Database function `approve_gig_application` is executed, which:
  1. Validates the application exists and is pending
  2. Validates the neighbor owns the gig
  3. Validates the gig is still open
  4. Updates the application: `status: 'approved'`
  5. Updates the gig:
     - `status: 'accepted'`
     - `teen_id: application.teen_id`
  6. Rejects all other pending applications for this gig (automatically)
  7. Returns the updated gig

**API Call:**
```typescript
approveGigApplication(applicationId: string)
// Internally calls: supabase.rpc('approve_gig_application', { p_application_id: applicationId })
```

**UI Feedback:**
- Success alert: "Application approved! The teenlancer has been assigned to this gig."
- Gig status changes from `'open'` to `'accepted'`
- Applicant list disappears (gig is no longer open)
- Assigned teenlancer info appears in gig details

**Database Triggers:**
- When gig status changes to `'accepted'` and `teen_id` is set, a trigger fires:
  - If the teen has a `parent_id`, a `parent_approval` record is automatically created with `status: 'pending'`

---

### Step 6: Parent Approval (If Required)

**Location:** `supabase/migrations/002_rls_policies.sql` (lines 105-127), `lib/api/parentApprovals.ts`

**What Happens:**
- If the teenlancer has a parent account linked (`parent_id` in users table):
  - A `parent_approvals` record is automatically created via database trigger
  - `status: 'pending'`
  - Parent receives notification (email/push notification)
  - Parent can approve or reject in their dashboard

**Parent Side:**
1. Parent logs into their account
2. Sees pending approval request in their dashboard
3. Reviews gig details
4. Approves or rejects the gig

**If Approved:**
- `parent_approvals.status: 'approved'`
- Teenlancer can now start the gig

**If Rejected:**
- `parent_approvals.status: 'rejected'`
- Gig may be cancelled or teen_id removed (depending on implementation)

**Note:** If teenlancer has no parent, this step is skipped and they can proceed directly to starting the gig.

---

### Step 7: Teenlancer Starts the Gig

**Location:** `app/tasks/[id].tsx` (lines 56-65), `lib/api/tasks.ts` (lines 540-568), `components/tasks/GigDetailModal.tsx` (lines 303-327)

**Teenlancer Side:**
1. Teenlancer views the accepted gig
2. Sees "Start Gig" button
3. Clicks button, confirmation dialog: "Are you ready to start [gig title]?"
4. On confirmation, gig status changes to `'in_progress'`

**What Happens:**
- `startTask(taskId)` is called
- Validates:
  - User is the assigned teenlancer (`teen_id === user.id`)
  - Gig status is `'accepted'`
- Updates gig: `status: 'in_progress'`

**API Call:**
```typescript
startTask(taskId: string)
// Updates: status: 'in_progress'
```

**UI Feedback:**
- Success alert: "Gig started!"
- Button changes to "Mark as Complete"
- Chat becomes available for both parties

---

### Step 8: Teenlancer Completes the Gig

**Location:** `app/tasks/[id].tsx` (lines 67-88), `lib/api/tasks.ts` (lines 570-598), `components/tasks/GigDetailModal.tsx` (lines 345-369)

**Teenlancer Side:**
1. After finishing the work, teenlancer clicks "Mark as Complete"
2. Confirmation dialog: "Mark [gig title] as completed?"
3. On confirmation, gig is marked complete

**What Happens:**
- `completeTask(taskId)` is called
- Validates:
  - User is the assigned teenlancer
  - Gig status is `'in_progress'`
- Updates gig: `status: 'completed'`

**Database Triggers:**
- When gig status changes to `'completed'`, a trigger fires:
  - Creates an `earnings` record:
    - `teen_id`: The teenlancer's ID
    - `task_id`: The gig ID
    - `amount`: The gig's pay amount
    - `status: 'pending'` (awaiting payment processing)

**API Call:**
```typescript
completeTask(taskId: string)
// Updates: status: 'completed'
// Trigger creates earnings record
```

**UI Feedback:**
- Success alert: "Gig completed! Earnings will be processed."
- Gig status shows as "COMPLETED"
- Review options become available

---

## Key Database Tables

### `gigs` (tasks)
- `id`: UUID
- `title`, `description`, `pay`
- `status`: `'open' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'`
- `poster_id`: Neighbor's user ID
- `teen_id`: Teenlancer's user ID (null until approved)
- `location`, `address`, `required_skills`, etc.

### `gig_applications`
- `id`: UUID
- `gig_id`: References gigs.id
- `teen_id`: References users.id (teenlancer)
- `status`: `'pending' | 'approved' | 'rejected'`
- `rejection_reason`: Optional text
- `created_at`, `updated_at`

### `parent_approvals`
- `id`: UUID
- `teen_id`: References users.id
- `task_id`: References gigs.id
- `parent_id`: References users.id (parent)
- `status`: `'pending' | 'approved' | 'rejected'`
- `reason`: Optional rejection reason

### `earnings`
- `id`: UUID
- `teen_id`: References users.id
- `task_id`: References gigs.id
- `amount`: Decimal (gig pay amount)
- `status`: `'pending' | 'paid' | 'cancelled'`

### `messages`
- `id`: UUID
- `gig_id`: References gigs.id
- `sender_id`: References users.id
- `recipient_id`: References users.id
- `content`: Message text
- `read`: Boolean
- `created_at`

---

## Important Code Locations

### Application Flow
- **Apply for gig:** `lib/api/tasks.ts:477-522` (`applyForGig`)
- **View applications:** `lib/api/gigApplications.ts:32-92` (`getGigApplications`)
- **Approve application:** `lib/api/gigApplications.ts:239-275` (`approveGigApplication`)
- **Reject application:** `lib/api/gigApplications.ts:277-312` (`rejectGigApplication`)

### UI Components
- **Gig detail modal:** `components/tasks/GigDetailModal.tsx`
- **Task detail screen:** `app/tasks/[id].tsx`
- **Chat screen:** `app/chat/[taskId].tsx`

### Database Functions
- **Apply for gig:** `apply_for_gig` (RPC function)
- **Approve application:** `approve_gig_application` (RPC function)
- **Reject application:** `reject_gig_application` (RPC function)

### Database Triggers
- **Parent approval creation:** `supabase/migrations/002_rls_policies.sql:105-127`
- **Earnings creation:** `supabase/migrations/002_rls_policies.sql:129-150`

---

## State Transitions

```
Gig Status Flow:
open → accepted → in_progress → completed
  ↓        ↓
cancelled cancelled

Application Status Flow:
pending → approved (one application)
pending → rejected (other applications when one is approved)

Parent Approval Flow (if applicable):
pending → approved (teen can start)
pending → rejected (gig may be cancelled)
```

---

## Permissions & Security

### Row-Level Security (RLS)
- **Gig applications:** Only the gig poster can read applications for their gigs
- **Gig updates:** Only the poster can update their gigs (until accepted, then teen can update status)
- **Messages:** Users can only read messages they sent or received
- **Parent approvals:** Parents can only read/update approvals for their teens

### Validation Checks
- Teenlancers cannot apply for their own gigs
- Teenlancers cannot apply twice for the same gig
- Only the gig poster can approve/reject applications
- Only assigned teenlancer can start/complete the gig
- Gig must be in correct status for each action

---

## Summary

The complete flow ensures:
1. **Fair application process:** Multiple teenlancers can apply, neighbor chooses
2. **Communication:** Neighbors can message applicants before deciding
3. **Parent oversight:** Parents approve gigs for their teens (if applicable)
4. **Clear status tracking:** Each stage has a clear status
5. **Automatic processing:** Triggers handle parent approvals and earnings creation
6. **Security:** RLS policies ensure users can only access their own data

This creates a safe, transparent process for connecting neighbors with teenlancers for local gigs.











