# TestFlight Setup - Next Steps

## Current Status: Build In Progress 🔄

### Build Timeline
- **Build time:** 15-30 minutes
- **App Store Connect processing:** 10-30 minutes after build completes
- **Total wait time:** ~30-60 minutes

### Monitor Your Build

You can monitor the build progress at:
- **EAS Dashboard:** https://expo.dev/accounts/foundry360/projects/ollie/builds
- **Terminal:** Check the terminal where you ran the build command
- **Email:** You'll receive an email when the build completes

## What Happens After Build Completes

### Step 1: Build Processing in App Store Connect
Once the build is uploaded, App Store Connect needs to process it:
1. Build appears in App Store Connect → TestFlight
2. Status will show "Processing" (10-30 minutes)
3. Once processed, status changes to "Ready to Submit" or "Ready to Test"

### Step 2: Submit to TestFlight (Automatic or Manual)

**Option A: Automatic Submission** (Recommended)
```bash
eas submit --platform ios --profile preview
```

This will:
- Automatically submit the latest build to TestFlight
- Handle all the submission steps
- Take a few minutes

**Option B: Manual Submission**
1. Go to App Store Connect → Ollie Jobs → TestFlight
2. Wait for build to process
3. Once ready, the build will automatically appear in TestFlight

### Step 3: Add Internal Testers (Instant)

Once the build is in TestFlight:
1. Go to App Store Connect → Ollie Jobs → TestFlight
2. Click **"Internal Testing"** in the left sidebar
3. Click **"+"** to create a test group (e.g., "Internal Testers")
4. Add testers by:
   - Entering their Apple ID emails
   - They must accept the invitation
5. Testers can install immediately (no review needed)

**Internal Testing Limits:**
- Up to 100 testers
- Instant access (no Beta App Review)
- Perfect for your team

### Step 4: Add External Testers (Requires Review)

For beta testers outside your team:
1. Go to TestFlight → **"External Testing"**
2. Click **"+"** to create a test group (e.g., "Beta Testers")
3. Select your processed build
4. Add test information:
   - **What to Test:** Brief description of what testers should focus on
   - **Feedback Email:** Where to send feedback
   - **Demo Account:** If login required, provide test credentials
5. Click **"Submit for Review"**
6. Wait for Beta App Review (24-48 hours typically)

**External Testing:**
- Up to 10,000 testers
- Requires Beta App Review (24-48 hours)
- Perfect for larger beta testing

## Quick Reference Commands

```bash
# Check build status
eas build:list

# Submit latest build to TestFlight (after build completes)
eas submit --platform ios --profile preview

# View build logs
eas build:view [BUILD_ID]

# Cancel a build (if needed)
eas build:cancel [BUILD_ID]
```

## Checklist After Build Completes

- [ ] Build status shows "Finished" in EAS dashboard
- [ ] Build appears in App Store Connect → TestFlight
- [ ] Build processing completes (shows "Ready to Test")
- [ ] Submit build to TestFlight (if not automatic)
- [ ] Create internal test group
- [ ] Add internal testers (team members)
- [ ] Testers receive invitations
- [ ] Testers install TestFlight app
- [ ] Testers can install and test the app
- [ ] Collect feedback

## Common Issues & Solutions

### Build Failed
- Check the build logs in EAS dashboard
- Common issues: Missing credentials, code signing errors
- Re-run build after fixing issues

### Build Stuck Processing
- Usually takes 10-30 minutes in App Store Connect
- If stuck > 1 hour, check App Store Connect status page
- Try submitting a new build if needed

### Testers Can't Install
- Verify they accepted the invitation
- Check they have TestFlight app installed
- Ensure build is not expired
- For external testers, verify Beta App Review is approved

## Next Steps

Once your build completes, we'll:
1. ✅ Verify build appears in TestFlight
2. ✅ Add internal testers
3. ✅ Test the installation process
4. ✅ Set up external testing (if needed)
5. ✅ Prepare for Beta App Review

---

**Current Step:** Waiting for build to complete (15-30 minutes remaining)
**Next Step:** Submit to TestFlight and add testers

