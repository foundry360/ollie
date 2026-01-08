# Functional Testing Guide

## What is Functional Testing?

Functional testing verifies that features work correctly according to business requirements and user expectations. Unlike unit tests (which test individual functions) or integration tests (which test component interactions), functional tests focus on:

- **User flows**: Complete end-to-end user journeys
- **Feature requirements**: Does the feature meet the business requirements?
- **User experience**: Does it work as a user would expect?
- **Business logic**: Are business rules correctly implemented?

## Functional Testing vs Other Test Types

| Test Type | Focus | Example |
|-----------|-------|---------|
| **Unit Test** | Individual functions/components | Testing `authStore.setUser()` |
| **Integration Test** | Component interactions | Testing login form submission with API |
| **Functional Test** | Complete user flows | Testing "User can log in and create a task" |
| **E2E Test** | Full app in real environment | Testing on actual device/simulator |

## Functional Testing Approach for Ollie

### 1. Test User Stories/Features

For each major feature, test:
- **Happy path**: Normal successful flow
- **Error cases**: What happens when things go wrong
- **Edge cases**: Boundary conditions
- **Business rules**: Role-based access, validation rules

### 2. Key Features to Test

#### Authentication & Onboarding
- User can sign up as teen
- User can sign up as neighbor (poster)
- User can log in
- User can reset password
- Neighbor application flow works correctly

#### Task Management
- Poster can create a task
- Teen can browse available tasks
- Teen can accept a task
- Task can be completed
- Task can be cancelled

#### Payments
- Teen can set up bank account
- Parent approval flow works
- Payments are processed correctly
- Earnings are tracked

#### Messaging
- Users can send messages
- Messages are delivered correctly
- Unread message counts update

#### Profile Management
- User can update profile
- Profile photo can be changed
- Skills can be updated

## Functional Test Structure

Functional tests should be organized by feature/user story:

```
__tests__/functional/
  ├── auth/
  │   ├── login.functional.test.ts
  │   ├── signup-teen.functional.test.ts
  │   └── signup-neighbor.functional.test.ts
  ├── tasks/
  │   ├── create-task.functional.test.ts
  │   ├── accept-task.functional.test.ts
  │   └── complete-task.functional.test.ts
  ├── payments/
  │   ├── bank-setup.functional.test.ts
  │   └── payment-processing.functional.test.ts
  └── messaging/
      └── send-message.functional.test.ts
```

## Writing Functional Tests

### Principles

1. **Test from user's perspective**: "As a teen, I can accept a task"
2. **Test complete flows**: Not just one function, but the entire user journey
3. **Use realistic data**: Test with data that users would actually use
4. **Test business rules**: Verify role-based access, validation, etc.
5. **Test error handling**: What happens when things go wrong?

### Example Structure

```typescript
describe('Feature: User Login', () => {
  describe('As a user, I can log in to my account', () => {
    it('should successfully log in with valid credentials', () => {
      // Test the complete login flow
    });
    
    it('should show error with invalid credentials', () => {
      // Test error handling
    });
    
    it('should remember last email address', () => {
      // Test UX feature
    });
  });
});
```

## Tools for Functional Testing

1. **React Native Testing Library** (already set up)
   - Best for testing user interactions
   - Focuses on what users see and do

2. **MSW (Mock Service Worker)** (already set up)
   - Mock API responses
   - Test different scenarios

3. **Detox** (already set up)
   - For true E2E functional testing
   - Tests on real devices/simulators

4. **Cucumber/Gherkin** (optional)
   - BDD (Behavior-Driven Development)
   - Write tests in plain English

## Best Practices

1. **Use descriptive test names**: "As a teen, I can accept a task and see it in my upcoming gigs"
2. **Test one thing per test**: Each test should verify one specific behavior
3. **Arrange-Act-Assert pattern**: Set up, perform action, verify result
4. **Use realistic test data**: Don't use "test@test.com", use realistic scenarios
5. **Test error messages**: Verify users see helpful error messages
6. **Test accessibility**: Ensure features work for all users

## Running Functional Tests

```bash
# Run all functional tests
npm test -- __tests__/functional

# Run specific feature tests
npm test -- __tests__/functional/auth

# Run with coverage
npm run test:coverage -- __tests__/functional
```

