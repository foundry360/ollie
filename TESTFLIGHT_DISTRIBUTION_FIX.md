# TestFlight Distribution Type Fix

## Issue
Build was signed with **Ad Hoc/Enterprise Provisioning Profile** (Internal Distribution), but TestFlight requires **App Store Distribution Provisioning Profile**.

Error: `Invalid Provisioning Profile for Apple App Store distribution. The application was signed with an Ad Hoc/Enterprise Provisioning Profile, which is meant for "Internal Distribution".`

## Root Cause
The `preview` profile in `eas.json` had:
```json
"distribution": "internal"
```

This creates an Ad Hoc build for internal testing, not suitable for TestFlight/App Store.

## Fix Applied
Changed the distribution type to `"store"` for TestFlight/App Store distribution:

```json
"preview": {
  "distribution": "store",  // Changed from "internal"
  ...
}
```

## Next Steps

### 1. Rebuild with Correct Distribution

You need to rebuild the app with the correct distribution type:

```bash
eas build --platform ios --profile preview
```

This new build will be:
- ✅ Signed with App Store Distribution Provisioning Profile
- ✅ Suitable for TestFlight submission
- ✅ Ready for App Store submission (if needed)

### 2. Submit to TestFlight

Once the new build completes:

```bash
eas submit --platform ios --latest
```

Or specify the new build ID:
```bash
eas submit --platform ios --id [NEW_BUILD_ID]
```

## Distribution Types Explained

| Distribution Type | Use Case | TestFlight? |
|-------------------|----------|-------------|
| `internal` | Ad Hoc distribution (direct install) | ❌ No |
| `store` | App Store / TestFlight | ✅ Yes |
| `development` | Development builds (dev client) | ❌ No |

For TestFlight, you **must** use `distribution: "store"`.

## Build Time

- Build time: ~15-30 minutes
- Build processing: ~10-30 minutes  
- Total: ~30-60 minutes

## What Happens After Rebuild

1. ✅ New build completes with App Store provisioning profile
2. ✅ Submit to TestFlight (should work now)
3. ✅ Build appears in TestFlight
4. ✅ Processing completes
5. ✅ Ready to add testers

## Important Notes

- **The previous build (ID: 0ccb3041-...) cannot be used** - it's signed for Ad Hoc
- **You must rebuild** with the correct distribution type
- **New build will take ~15-30 minutes**
- **Once rebuilt, submission should work**

---

**Action Required:** Rebuild with `eas build --platform ios --profile preview`

