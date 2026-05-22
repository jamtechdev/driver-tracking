import React from 'react';
import { screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SettingsScreen from '@/screens/settings/SettingsScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

describe('SettingsScreen', () => {
  it('renders MDT settings shell', async () => {
    const nav = createMockNavigation();
    renderWithLayout(
      <SafeAreaProvider>
        <SettingsScreen navigation={nav} />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('MDT Settings')).toBeTruthy();
    expect(screen.getByText('Debug')).toBeTruthy();
  });
});
