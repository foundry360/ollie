import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Login Flow E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display login screen', async () => {
    // Wait for app to load
    await waitFor(element(by.text('Login')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Verify login form elements are visible
    await detoxExpect(element(by.text('Login'))).toBeVisible();
  });

  it('should show validation errors for empty fields', async () => {
    // Try to submit empty form
    await element(by.text('Login')).tap();
    
    // Should show validation errors
    await waitFor(element(by.text(/email/i)))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should login successfully with valid credentials', async () => {
    // Note: This test requires actual backend or mocked backend
    // For now, it's a template that can be customized
    
    // Enter email
    await element(by.id('email-input')).typeText('test@example.com');
    
    // Enter password
    await element(by.id('password-input')).typeText('password123');
    
    // Tap login button
    await element(by.text('Login')).tap();
    
    // Wait for navigation to home (adjust based on your app structure)
    // await waitFor(element(by.id('home-screen')))
    //   .toBeVisible()
    //   .withTimeout(10000);
  });

  it('should show error on invalid credentials', async () => {
    await element(by.id('email-input')).typeText('wrong@example.com');
    await element(by.id('password-input')).typeText('wrongpassword');
    await element(by.text('Login')).tap();
    
    // Wait for error message
    await waitFor(element(by.text(/invalid/i)))
      .toBeVisible()
      .withTimeout(5000);
  });
});

