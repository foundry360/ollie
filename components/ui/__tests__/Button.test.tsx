import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '../Button';
import { useThemeStore } from '@/stores/themeStore';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </QueryClientProvider>
);

jest.mock('@/stores/themeStore');

describe('Button Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useThemeStore as jest.Mock).mockReturnValue({
      colorScheme: 'light',
    });
  });

  it('should render button with title', () => {
    const { getByText, debug } = render(
      <Wrapper>
        <Button title="Click Me" onPress={() => {}} />
      </Wrapper>
    );
    debug(); // Debug output to see what's rendered
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Wrapper>
        <Button title="Click Me" onPress={onPress} />
      </Wrapper>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Wrapper>
        <Button title="Click Me" onPress={onPress} disabled />
      </Wrapper>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('should not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Wrapper>
        <Button title="Click Me" onPress={onPress} loading />
      </Wrapper>
    );

    fireEvent.press(getByText('Click Me'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('should render with primary variant', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Primary" onPress={() => {}} variant="primary" />
      </Wrapper>
    );
    expect(getByText('Primary')).toBeTruthy();
  });

  it('should render with secondary variant', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Secondary" onPress={() => {}} variant="secondary" />
      </Wrapper>
    );
    expect(getByText('Secondary')).toBeTruthy();
  });

  it('should render with danger variant', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Danger" onPress={() => {}} variant="danger" />
      </Wrapper>
    );
    expect(getByText('Danger')).toBeTruthy();
  });

  it('should render with fullWidth', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Full Width" onPress={() => {}} fullWidth />
      </Wrapper>
    );
    expect(getByText('Full Width')).toBeTruthy();
  });

  it('should render with small size', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Small" onPress={() => {}} size="small" />
      </Wrapper>
    );
    expect(getByText('Small')).toBeTruthy();
  });

  it('should render with large size', () => {
    const { getByText } = render(
      <Wrapper>
        <Button title="Large" onPress={() => {}} size="large" />
      </Wrapper>
    );
    expect(getByText('Large')).toBeTruthy();
  });
});

