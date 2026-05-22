import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabHeader from '@/components/TabHeader';

jest.mock('@/context/EmergencyContext', () => ({
  useEmergency: () => ({
    emergencyActivated: false,
    activateEmergency: jest.fn(),
    deactivateEmergency: jest.fn(),
    openDeactivateReasonModal: jest.fn(),
  }),
}));

jest.mock('@/context/ReportIncidentModalContext', () => ({
  useReportIncidentModal: () => ({ open: jest.fn() }),
}));

jest.mock('@/context/SettingsModalContext', () => ({
  useSettingsModal: () => ({
    use24HourClock: false,
    setUse24HourClock: jest.fn(),
    visible: false,
    open: jest.fn(),
    close: jest.fn(),
    anchorY: null,
  }),
}));

jest.mock('@/context/SidebarContext', () => ({
  useSidebar: () => ({ open: jest.fn(), isOpen: false, close: jest.fn() }),
}));

describe('TabHeader', () => {
  it('renders without throwing', () => {
    const { toJSON } = render(
      <SafeAreaProvider>
        <TabHeader />
      </SafeAreaProvider>,
    );
    expect(toJSON()).toBeTruthy();
  });
});
