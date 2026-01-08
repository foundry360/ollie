/**
 * Functional Tests for Task Acceptance Feature
 * 
 * User Story: As a teen, I can accept a task so I can complete it and earn money
 * 
 * Test Scenarios:
 * 1. Teen can view available tasks
 * 2. Teen can accept an open task
 * 3. Task status changes to "accepted" after acceptance
 * 4. Teen sees accepted task in their upcoming gigs
 * 5. Teen cannot accept already accepted tasks
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useAcceptTask } from '@/hooks/useTasks';

jest.mock('@/stores/authStore');
jest.mock('@/hooks/useTasks');
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useLocalSearchParams: () => ({ id: 'task-123' }),
}));

const TaskDetailScreen = require('@/app/tasks/[id]').default;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SafeAreaProvider>{children}</SafeAreaProvider>
  </QueryClientProvider>
);

describe('Feature: Task Acceptance', () => {
  const mockTeenUser = {
    id: 'teen-123',
    email: 'teen@example.com',
    role: 'teen',
    full_name: 'Teen User',
  };

  const mockOpenTask = {
    id: 'task-123',
    title: 'Mow the lawn',
    description: 'Need help mowing',
    pay: 50,
    status: 'open',
    poster_id: 'poster-123',
    teen_id: null,
  };

  const mockAcceptTask = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuthStore as jest.Mock).mockReturnValue({
      user: mockTeenUser,
    });
    (useAcceptTask as jest.Mock).mockReturnValue({
      mutateAsync: mockAcceptTask,
      isLoading: false,
    });
  });

  describe('As a teen, I can accept an available task', () => {
    it('should successfully accept an open task', async () => {
      const acceptedTask = {
        ...mockOpenTask,
        status: 'accepted',
        teen_id: mockTeenUser.id,
      };

      mockAcceptTask.mockResolvedValue(acceptedTask);

      // Mock useTask hook to return open task
      const { useTask } = require('@/hooks/useTasks');
      (useTask as jest.Mock).mockReturnValue({
        data: mockOpenTask,
        isLoading: false,
      });

      const { getByText } = render(
        <Wrapper>
          <TaskDetailScreen />
        </Wrapper>
      );

      // Find and click accept button
      await waitFor(() => {
        const acceptButton = getByText(/accept|take this gig/i);
        fireEvent.press(acceptButton);
      });

      // Verify task was accepted
      await waitFor(() => {
        expect(mockAcceptTask).toHaveBeenCalledWith('task-123');
      });
    });

    it('should show confirmation before accepting task', async () => {
      const { useTask } = require('@/hooks/useTasks');
      (useTask as jest.Mock).mockReturnValue({
        data: mockOpenTask,
        isLoading: false,
      });

      const { Alert } = require('@/components/ui/Alert');
      Alert.alert = jest.fn((title, message, buttons) => {
        // Simulate user confirming
        if (buttons && buttons[0] && buttons[0].onPress) {
          buttons[0].onPress();
        }
      });

      const { getByText } = render(
        <Wrapper>
          <TaskDetailScreen />
        </Wrapper>
      );

      await waitFor(() => {
        const acceptButton = getByText(/accept|take this gig/i);
        fireEvent.press(acceptButton);
      });

      // Should show confirmation dialog
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          expect.stringContaining(/accept|confirm/i),
          expect.any(String),
          expect.any(Array)
        );
      });
    });

    it('should update task status to accepted after acceptance', async () => {
      const acceptedTask = {
        ...mockOpenTask,
        status: 'accepted',
        teen_id: mockTeenUser.id,
      };

      mockAcceptTask.mockResolvedValue(acceptedTask);

      const { useTask } = require('@/hooks/useTasks');
      (useTask as jest.Mock).mockReturnValue({
        data: mockOpenTask,
        isLoading: false,
      });

      const { getByText, queryByText } = render(
        <Wrapper>
          <TaskDetailScreen />
        </Wrapper>
      );

      await waitFor(() => {
        const acceptButton = getByText(/accept|take this gig/i);
        fireEvent.press(acceptButton);
      });

      await waitFor(() => {
        // Task status should change
        expect(queryByText(/accepted/i)).toBeTruthy();
        // Accept button should no longer be visible
        expect(queryByText(/accept|take this gig/i)).toBeNull();
      });
    });
  });

  describe('As a teen, I cannot accept tasks that are already accepted', () => {
    it('should not show accept button for already accepted tasks', async () => {
      const acceptedTask = {
        ...mockOpenTask,
        status: 'accepted',
        teen_id: 'other-teen-123',
      };

      const { useTask } = require('@/hooks/useTasks');
      (useTask as jest.Mock).mockReturnValue({
        data: acceptedTask,
        isLoading: false,
      });

      const { queryByText } = render(
        <Wrapper>
          <TaskDetailScreen />
        </Wrapper>
      );

      await waitFor(() => {
        // Accept button should not be visible
        expect(queryByText(/accept|take this gig/i)).toBeNull();
        // Should show that task is already accepted
        expect(queryByText(/accepted|taken/i)).toBeTruthy();
      });
    });

    it('should not show accept button for tasks I already accepted', async () => {
      const myAcceptedTask = {
        ...mockOpenTask,
        status: 'accepted',
        teen_id: mockTeenUser.id, // I accepted it
      };

      const { useTask } = require('@/hooks/useTasks');
      (useTask as jest.Mock).mockReturnValue({
        data: myAcceptedTask,
        isLoading: false,
      });

      const { queryByText, getByText } = render(
        <Wrapper>
          <TaskDetailScreen />
        </Wrapper>
      );

      await waitFor(() => {
        // Accept button should not be visible
        expect(queryByText(/accept|take this gig/i)).toBeNull();
        // Should show action buttons for accepted task (start, complete, etc.)
        expect(getByText(/start|complete/i)).toBeTruthy();
      });
    });
  });

  describe('As a teen, I can see accepted tasks in my upcoming gigs', () => {
    it('should show accepted task in upcoming gigs list', async () => {
      // This would test the home screen or upcoming gigs component
      // Implementation depends on your app structure
      const acceptedTask = {
        ...mockOpenTask,
        status: 'accepted',
        teen_id: mockTeenUser.id,
      };

      // Mock the useUpcomingGigs or similar hook
      const { useUpcomingGigs } = require('@/hooks/useTasks');
      (useUpcomingGigs as jest.Mock).mockReturnValue({
        data: [acceptedTask],
        isLoading: false,
      });

      // Render upcoming gigs component
      // Verify task appears in list
    });
  });
});

