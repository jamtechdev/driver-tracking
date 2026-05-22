import React from 'react';
import { screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MessagingScreen from '@/screens/messaging/MessagingScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

jest.mock('@/context/IncomingMessagesContext', () => ({
  IncomingMessagesProvider: ({ children }: { children: React.ReactNode }) => children,
  useIncomingMessages: () => ({
    messages: [],
    loading: false,
    error: null as string | null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/context/MessagingModalContext', () => ({
  MessagingModalProvider: ({ children }: { children: React.ReactNode }) => children,
  useMessagingModal: () => ({ open: jest.fn(), close: jest.fn(), isOpen: false }),
}));

describe('MessagingScreen', () => {
  it('shows empty state', () => {
    const nav = createMockNavigation();
    renderWithLayout(
      <SafeAreaProvider>
        <MessagingScreen navigation={nav} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Messages')).toBeTruthy();
    expect(screen.getByText('No incoming messages')).toBeTruthy();
  });
});
