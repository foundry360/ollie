# TestFlight Setup Guide - Ollie iOS App

This guide walks you through setting up TestFlight for the Ollie app using your existing Apple Developer account.

## Prerequisites

- ✅ Apple Developer Account (you mentioned you already have this)
- ✅ EAS CLI installed (`npm install -g eas-cli`)
- ✅ Expo account
- ✅ App configured in `app.json` and `eas.json`

## Step 1: Verify Apple Developer Account Access

1. Go to [developer.apple.com](https://developer.apple.com)
2. Sign in with your Apple ID
3. Verify you have access to:
   - App Store Connect
   - Certificates, Identifiers & Profiles

## Step 2: Configure EAS Build

### 2.1 Login to Expo

```bash
eas login
```

Enter your Expo credentials.

### 2.2 Link Your Project (if not already done)

```bash
eas build:configure
```

This will:
- Create or update `eas.json`
- Set up build profiles
- Configure your project for EAS builds

### 2.3 Verify EAS Configuration

Check that your `eas.json` has the correct profiles:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

## Step 3: Set Up App Store Connect

### 3.1 Create App in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Sign in with your Apple Developer account
3. Click **"My Apps"**
4. Click the **"+"** button to create a new app
5. Fill in the required information:
   - **Platform:** iOS
   - **Name:** Ollie
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select `com.foundry360.ollie` (or create new)
   - **SKU:** `ollie-ios` (unique identifier)
   - **User Access:** Full Access (or as needed)

### 3.2 Configure App Information

1. In App Store Connect, select your app
2. Go to **"App Information"**
3. Fill in:
   - **Category:** Select appropriate categories (e.g., "Lifestyle", "Social Networking")
   - **Privacy Policy URL:** Your privacy policy URL
   - **Support URL:** Your support page URL

### 3.3 Set Up App Store Listing (Optional for TestFlight)

While not required for TestFlight, you can start preparing:
- App description
- Keywords
- Screenshots (will be needed for production)
- App icon

## Step 4: Build for TestFlight

### 4.1 Build iOS App

Run the build command:

```bash
eas build --platform ios --profile preview
```

This will:
- Prompt you to select or create an Apple Developer account connection
- Build your app in the cloud
- Take approximately 15-30 minutes

### 4.2 During Build Process

You'll be asked:
1. **"Do you want to use the existing Apple ID?"** - Select your account
2. **"Do you want to use the existing App Store Connect API key?"** - If you have one, yes. Otherwise, it will guide you to create one.

### 4.3 Create App Store Connect API Key (if needed)

If you need to create an API key:

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Click **"Users and Access"**
3. Click **"Keys"** tab
4. Click **"+"** to generate a new key
5. Name it (e.g., "EAS Build Key")
6. Select **"App Manager"** or **"Admin"** role
7. Click **"Generate"**
8. Download the `.p8` key file (you can only download once!)
9. Note the **Key ID** and **Issuer ID**

Then configure in EAS:

```bash
eas credentials
```

Select iOS → App Store Connect API Key, and enter:
- Key ID
- Issuer ID
- Path to the `.p8` file

## Step 5: Submit Build to TestFlight

### 5.1 Automatic Submission

After the build completes, you can submit automatically:

```bash
eas submit --platform ios --profile preview
```

Or submit a specific build:

```bash
eas submit --platform ios --latest
```

### 5.2 Manual Submission (Alternative)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **"TestFlight"** tab
4. Wait for build to process (can take 10-30 minutes)
5. Once processed, the build will appear in TestFlight

## Step 6: Configure TestFlight

### 6.1 Add Internal Testers

1. In App Store Connect, go to **"TestFlight"** tab
2. Click **"Internal Testing"** in the left sidebar
3. Click **"+"** to create a test group (e.g., "Internal Testers")
4. Add testers:
   - Click **"Add Testers"**
   - Enter Apple ID emails of team members
   - They must accept the invitation

**Note:** Internal testers can test immediately (no review needed), but limited to 100 testers.

### 6.2 Add External Testers

1. In TestFlight, click **"External Testing"** in the left sidebar
2. Click **"+"** to create a test group (e.g., "Beta Testers")
3. Select a build (must be processed)
4. Add test information:
   - **What to Test:** Brief description of what testers should focus on
   - **Feedback Email:** Where to send feedback
5. Add testers:
   - Enter Apple ID emails
   - Or create a public link (for up to 10,000 testers)

**Note:** External testing requires Beta App Review (usually 24-48 hours).

### 6.3 Beta App Review (for External Testing)

Before external testers can access the app:

1. In TestFlight, go to **"External Testing"**
2. Select your test group
3. Click **"Submit for Review"**
4. Fill in:
   - **Beta App Information:** What's new in this version
   - **Contact Information:** Your contact details
   - **Demo Account:** If login required, provide test credentials
   - **Notes:** Any additional information for reviewers
5. Submit for review

Review typically takes 24-48 hours.

## Step 7: Distribute to Testers

### 7.1 Send TestFlight Invitations

**For Internal Testers:**
- Invitations are sent automatically when you add them
- They receive an email with TestFlight link
- They can install immediately via TestFlight app

**For External Testers:**
- After Beta App Review approval
- Invitations sent automatically
- Or share the public TestFlight link

### 7.2 TestFlight App Installation

Testers need to:
1. Install **TestFlight** app from App Store (if not already installed)
2. Accept invitation email
3. Open TestFlight app
4. Tap **"Accept"** on the invitation
5. Tap **"Install"** to install the app

## Step 8: Manage TestFlight Builds

### 8.1 View Build Status

In App Store Connect → TestFlight:
- **Processing:** Build is being processed
- **Ready to Submit:** Build ready for testing
- **Testing:** Build is available to testers
- **Expired:** Build has expired (90 days)

### 8.2 Expire Old Builds

Builds expire after 90 days. To expire manually:
1. Select the build
2. Click **"Expire Build"**

### 8.3 Update TestFlight Build

When you have a new version:

```bash
# Build new version
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios --latest
```

The new build will automatically replace the old one for testers.

## Step 9: Collect Feedback

### 9.1 TestFlight Feedback

Testers can provide feedback via:
- **TestFlight App:** Built-in feedback button
- **Email:** Direct email to your feedback address
- **Crash Reports:** Automatically collected

### 9.2 View Feedback

1. In App Store Connect → TestFlight
2. Go to **"Feedback"** section
3. View all feedback and crash reports

### 9.3 TestFlight Analytics

View metrics in TestFlight:
- Number of testers
- Installations
- Crashes
- Feedback received

## Step 10: Troubleshooting

### Build Fails

**Issue:** Build fails with certificate error
**Solution:**
```bash
eas credentials
```
Select iOS → Remove and recreate certificates

**Issue:** Build fails with provisioning profile error
**Solution:** EAS will automatically create profiles, but you may need to:
1. Go to developer.apple.com
2. Verify your App ID exists
3. Ensure bundle identifier matches `app.json`

### Submission Fails

**Issue:** "No builds found"
**Solution:** Wait for build to complete processing (check build status)

**Issue:** "Missing compliance"
**Solution:** In App Store Connect → App Information → Answer export compliance questions

### TestFlight Issues

**Issue:** Testers can't install
**Solution:**
- Verify they accepted invitation
- Check they have TestFlight app installed
- Ensure build is not expired
- For external testers, verify Beta App Review is approved

**Issue:** Build stuck in "Processing"
**Solution:**
- Usually takes 10-30 minutes
- If stuck > 1 hour, check App Store Connect status page
- Try submitting a new build

## Step 11: Production Submission (After UAT)

Once UAT is complete:

```bash
# Build production version
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

Then in App Store Connect:
1. Complete App Store listing
2. Add screenshots
3. Fill in all required information
4. Submit for App Review

## Quick Reference Commands

```bash
# Build for TestFlight
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios --profile preview

# Check build status
eas build:list

# View credentials
eas credentials

# Build production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --profile production
```

## Checklist

- [ ] Apple Developer account verified
- [ ] EAS CLI installed and logged in
- [ ] App created in App Store Connect
- [ ] Bundle ID configured
- [ ] Build completed successfully
- [ ] Build submitted to TestFlight
- [ ] Internal testers added
- [ ] External testers added (if needed)
- [ ] Beta App Review submitted (for external)
- [ ] Testers can install and use app
- [ ] Feedback collection system set up

## Additional Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Expo EAS Submit](https://docs.expo.dev/submit/introduction/)

---

**Need Help?**
- EAS Support: [forums.expo.dev](https://forums.expo.dev)
- Apple Developer Support: [developer.apple.com/support](https://developer.apple.com/support)

