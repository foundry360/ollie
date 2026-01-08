# Testing Guide

This guide covers unit tests, integration tests, and E2E tests for the Ollie app.

## Test Structure

```
__tests__/
  ├── unit/              # Unit tests for isolated components/functions
  ├── integration/       # Integration tests for feature flows
  └── utils/             # Test utilities and helpers

e2e/                     # End-to-end tests (Detox)
  ├── jest.config.js
  └── *.e2e.test.ts

mocks/                   # MSW handlers for API mocking
  ├── handlers.ts
  └── server.ts
```

## Running Tests

### Unit Tests
```bash
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Run tests with coverage report
npm run test:unit        # Run only unit tests
```

### Integration Tests
```bash
npm run test:integration # Run only integration tests
```

### E2E Tests
```bash
# First, build the app
npm run test:e2e:build

# Then run E2E tests
npm run test:e2e
```

## Writing Tests

### Unit Test Example

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '@/stores/authStore';

describe('useAuthStore', () => {
  it('should set user correctly', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = { id: '123', email: 'test@example.com' };
    
    act(() => {
      result.current.setUser(mockUser);
    });
    
    expect(result.current.user).toEqual(mockUser);
  });
});
```

### Integration Test Example

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';

describe('Login Integration', () => {
  it('should login successfully', async () => {
    const { getByPlaceholderText, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Login'));
    
    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalled();
    });
  });
});
```

### E2E Test Example

```typescript
import { by, element, waitFor } from 'detox';

describe('Login Flow', () => {
  it('should login successfully', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.text('Login')).tap();
    
    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
```

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage for stores, utilities, and API functions
- **Integration Tests**: Cover all critical user flows (login, signup, task creation, etc.)
- **E2E Tests**: Cover main user journeys end-to-end

## Mocking

### Expo Modules
All Expo modules are mocked in `jest.setup.js`. Add new mocks there if needed.

### API Calls
Use MSW (Mock Service Worker) for API mocking. Add handlers in `mocks/handlers.ts`.

### AsyncStorage
AsyncStorage is automatically mocked. Use `jest.fn()` to customize behavior:

```typescript
(AsyncStorage.getItem as jest.Mock).mockResolvedValue('stored-value');
```

## Best Practices

1. **Isolate Tests**: Each test should be independent and not rely on other tests
2. **Clean Up**: Use `beforeEach` and `afterEach` to reset state
3. **Use Test IDs**: Add `testID` props to components for E2E tests
4. **Mock External Dependencies**: Mock Supabase, Sentry, and other external services
5. **Test User Behavior**: Focus on testing what users see and do, not implementation details

## Troubleshooting

### Tests failing with module resolution errors
- Check `jest.config.js` `moduleNameMapper` settings
- Ensure all dependencies are installed

### E2E tests not finding elements
- Add `testID` props to components
- Use `waitFor` with appropriate timeouts
- Check that the app is built correctly

### MSW not intercepting requests
- Ensure `server.listen()` is called in `jest.setup.js`
- Check that handlers match the request URLs

## Next Steps

1. Add `testID` props to key components for E2E testing
2. Expand test coverage for critical features
3. Set up CI/CD to run tests automatically
4. Add visual regression testing if needed

