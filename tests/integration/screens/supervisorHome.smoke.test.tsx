import React from 'react';
import { screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SupervisorHomeScreen from '@/screens/supervisor/SupervisorHomeScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

jest.mock('@/components/MainLayout', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'main-layout' }, children),
  };
});

describe('SupervisorHomeScreen', () => {
  it('shows dashboard title', () => {
    const nav = createMockNavigation();
    renderWithLayout(
      <SafeAreaProvider>
        <SupervisorHomeScreen navigation={nav} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Supervisor Dashboard')).toBeTruthy();
  });
});
