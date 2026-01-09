# EAS Build Dependency Installation Error

## Issue
Build failed with: "Unknown error. See logs of the Install dependencies build phase for more information."

Build ID: `15b7d686-ac8f-4b96-8d81-d27be475c953`

## What to Check

### 1. View Build Logs
Check the detailed build logs at:
https://expo.dev/accounts/foundry360/projects/ollie/builds/15b7d686-ac8f-4b96-8d81-d27be475c953

Look for errors in the "Install dependencies" phase. Common issues:
- npm install failures
- Dependency version conflicts
- Package lock file issues
- Node version incompatibilities

### 2. Environment Variable Issue
The build output showed:
```
Resolved "production" environment for the build.
```

But we're using `--profile preview`. This might be causing issues.

**Solution:** Check if there are environment variables set for "production" that conflict.

### 3. Common Fixes

**Option A: Clean Build**
Sometimes clearing EAS cache helps:
```bash
# Rebuild - EAS will use fresh dependencies
eas build --platform ios --profile preview --clear-cache
```

**Option B: Check package.json Consistency**
Make sure package.json and package-lock.json are in sync:
```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Update package-lock.json"
git push
```

**Option C: Check Build Logs for Specific Error**
The actual error will be in the build logs. Common errors:
- `npm ERR!` messages
- Package not found errors
- Version conflict errors
- Node version mismatch

### 4. Verify Changes Are Committed
✅ Changes have been committed and pushed
- package.json (Sentry removed)
- package-lock.json (updated)
- eas.json (distribution: store)
- app.config.js (Sentry removed)

### 5. Rebuild After Checking Logs
Once you identify the specific error from the logs:

```bash
eas build --platform ios --profile preview
```

## Next Steps

1. **Check the build logs** at the URL above
2. **Identify the specific npm/dependency error**
3. **Fix the issue** (might be a dependency version conflict)
4. **Rebuild**

## Quick Test: Local npm install

Verify dependencies install correctly locally:
```bash
rm -rf node_modules package-lock.json
npm install
```

If this works locally but fails in EAS, it might be:
- Node version mismatch
- Platform-specific dependency issue
- EAS environment configuration

---

**Action:** Check the build logs first to see the actual error message.

