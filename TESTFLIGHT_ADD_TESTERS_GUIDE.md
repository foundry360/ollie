# TestFlight - Adding Testers Guide

## Overview

Once your build is "Ready to Test" in TestFlight, you can add testers. This guide walks you through the process step-by-step.

## Prerequisites

✅ Build submitted to TestFlight  
⏳ Build processing completes (10-30 minutes)  
✅ Build shows "Ready to Test" status  

## Step-by-Step: Add Internal Testers

### Step 1: Navigate to TestFlight

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **My Apps** → **Ollie Jobs**
3. Click **"TestFlight"** tab in the left sidebar

### Step 2: Create Internal Test Group

1. In TestFlight, click **"Internal Testing"** in the left sidebar
2. If you don't have a test group yet, click **"+"** button
3. Name your test group (e.g., "Internal Testers", "Development Team")
4. Click **"Create"**

### Step 3: Add Build to Test Group

1. Select your test group
2. Click **"+"** next to "iOS Builds"
3. Select your build (Version 1.0.0, Build 1)
4. Click **"Add"**

### Step 4: Add Testers

1. In your test group, click **"Add Testers"** button
2. You have two options:

   **Option A: Add by Email**
   - Enter Apple ID emails (one per line or comma-separated)
   - Click **"Add"**
   - Testers will receive an invitation email

   **Option B: Add via Public Link**
   - Click **"Enable Public Link"**
   - Share the link with testers
   - They can join without invitation

3. Testers will receive an email invitation
4. They need to:
   - Accept the invitation
   - Install TestFlight app (if not already installed)
   - Install your app from TestFlight

## Step-by-Step: Add External Testers

### Step 1: Create External Test Group

1. In TestFlight, click **"External Testing"** in the left sidebar
2. Click **"+"** to create a new test group
3. Name it (e.g., "Beta Testers", "UAT Testers")
4. Click **"Create"**

### Step 2: Add Build and Test Information

1. Select your test group
2. Click **"+"** next to "iOS Builds"
3. Select your build (Version 1.0.0, Build 1)
4. Fill in test information:
   - **What to Test:** Brief description of what testers should focus on
     ```
     We're testing the Ollie app MVP. Please test:
     - User registration and login
     - Task creation and acceptance
     - Messaging between users
     - Payment flows
     - Profile management
     ```
   - **Feedback Email:** Your email for receiving feedback
   - **Demo Account (if needed):** 
     - Email: test@ollie.com
     - Password: TestPassword123
   - **Notes:** Any additional information for reviewers

### Step 3: Submit for Beta App Review

1. Review all information
2. Click **"Submit for Review"**
3. Wait for Beta App Review (24-48 hours typically)
4. You'll receive an email when approved

### Step 4: Add Testers (After Approval)

Once Beta App Review is approved:

1. In your external test group, click **"Add Testers"**
2. Add testers by email or enable public link
3. Testers will receive invitations
4. They can install and test the app

## Tester Categories

### Internal Testers (Recommended First)

**Who:**
- Development team members
- Product managers
- QA team
- Key stakeholders

**Benefits:**
- ✅ Instant access (no review)
- ✅ Up to 100 testers
- ✅ Perfect for initial testing

**When to Use:**
- First round of testing
- Bug fixes verification
- Feature validation

### External Testers (For UAT)

**Who:**
- Beta testers
- Real users (teens, neighbors, parents)
- Focus groups
- Early adopters

**Benefits:**
- ✅ Up to 10,000 testers
- ✅ Real-world testing
- ✅ Public link option

**When to Use:**
- User Acceptance Testing (UAT)
- Larger beta testing
- Public beta programs

## Tester Onboarding Process

### Email Template for Testers

**Subject:** You're Invited to Test Ollie on TestFlight

**Body:**
```
Hi [Tester Name],

You've been invited to test Ollie, our new app connecting teens with neighbors for tasks!

Here's how to get started:

1. Accept the TestFlight invitation (check your email)
2. Install the TestFlight app from the App Store (if you don't have it)
3. Open TestFlight and tap "Accept" on the Ollie invitation
4. Tap "Install" to install Ollie
5. Start testing!

What to Test:
- User registration and login
- Creating and accepting tasks
- Messaging features
- Payment flows
- Profile management

Feedback:
Please send feedback to: [your-email@example.com]
Or use the TestFlight feedback button in the app.

Thank you for helping us test Ollie!

Best,
[Your Name]
```

## Managing Testers

### View Tester Activity

1. Go to TestFlight → Your test group
2. Click **"Testers"** tab
3. See:
   - Who has installed the app
   - Last activity date
   - Device information
   - Feedback received

### Remove Testers

1. Go to your test group
2. Click **"Testers"** tab
3. Select testers to remove
4. Click **"Remove"**

### Update Test Group

1. Select your test group
2. Click **"Edit"**
3. Update build, test information, or testers
4. Save changes

## Best Practices

### 1. Start Small
- Begin with 5-10 internal testers
- Expand gradually as you fix issues
- Add external testers after initial validation

### 2. Clear Communication
- Provide clear testing instructions
- Set expectations for feedback
- Respond to tester questions promptly

### 3. Organize Testers
- Create separate groups for different purposes:
  - "Development Team" - Internal
  - "Beta Testers - Teens" - External
  - "Beta Testers - Neighbors" - External
  - "Beta Testers - Parents" - External

### 4. Track Feedback
- Use TestFlight's feedback system
- Set up a feedback form (Google Form, etc.)
- Create a spreadsheet to track issues

### 5. Regular Updates
- Push new builds as you fix issues
- Keep testers informed of updates
- Thank testers for their participation

## Troubleshooting

### Tester Can't Install

**Issue:** Tester receives invitation but can't install

**Solutions:**
- Verify they accepted the invitation
- Check they have TestFlight app installed
- Ensure build is not expired
- For external testers, verify Beta App Review is approved

### Build Not Showing

**Issue:** Build doesn't appear in test group

**Solutions:**
- Wait for processing to complete (10-30 minutes)
- Verify build status is "Ready to Test"
- Check you selected the correct build
- Try refreshing the page

### Invitation Not Received

**Issue:** Tester didn't receive invitation email

**Solutions:**
- Check spam folder
- Verify email address is correct
- Resend invitation from TestFlight
- Use public link as alternative

## Quick Reference

### TestFlight Links
- **TestFlight Dashboard:** https://appstoreconnect.apple.com/apps/6757497389/testflight/ios
- **Internal Testing:** TestFlight → Internal Testing
- **External Testing:** TestFlight → External Testing

### Commands
```bash
# Check build status
eas build:list --platform ios --limit 1

# Submit new build
eas build --platform ios --profile preview
eas submit --platform ios --latest
```

## Next Steps After Adding Testers

1. ✅ Testers receive invitations
2. ✅ Testers install TestFlight app
3. ✅ Testers install Ollie app
4. ✅ Begin UAT testing
5. ✅ Collect feedback
6. ✅ Fix issues
7. ✅ Push updated builds
8. ✅ Iterate based on feedback

---

**Ready to add testers?** Wait for build to show "Ready to Test", then follow the steps above!

