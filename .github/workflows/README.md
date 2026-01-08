# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated testing and CI/CD.

## Workflows

### `test.yml`
Runs automated tests on every push and pull request:
- Unit tests
- Integration tests
- Functional tests
- TypeScript type checking
- Coverage reporting

## Setup

### Required GitHub Secrets

For Sentry integration (if using in builds):
- `SENTRY_AUTH_TOKEN` - Your Sentry authentication token
- `SENTRY_ORG` - Your Sentry organization slug (e.g., `foundry360-llc`)
- `SENTRY_PROJECT` - Your Sentry project name (e.g., `ollie`)
- `EXPO_PUBLIC_SENTRY_DSN` - Your Sentry DSN

### How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret with its value

## Workflow Triggers

- **Push to main/develop**: Runs all tests
- **Pull requests**: Runs all tests before merge
- **Manual trigger**: Can be triggered manually from Actions tab

## Test Results

Test results are visible in:
- GitHub Actions tab
- Pull request checks
- Commit status

## Coverage Reports

Coverage reports are uploaded to Codecov (if configured). To set up Codecov:

1. Sign up at https://codecov.io
2. Connect your GitHub repository
3. Coverage will be automatically uploaded on each test run

