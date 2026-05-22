import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PinEntryScreen from '@/screens/auth/PinEntryScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

const mockLogin = jest.fn(() => Promise.resolve(true));

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    login: mockLogin,
    logout: jest.fn(),
    selectDriver: jest.fn(),
    setVehicleId: jest.fn(),
    setVehicleName: jest.fn(),
    setServiceStatus: jest.fn(),
    selectRouteOrStatus: jest.fn(),
    setPassengerCount: jest.fn(),
    setSelectedManifestId: jest.fn(),
    setHasShownSupervisorModal: jest.fn(),
    syncVehicleAssignment: jest.fn().mockResolvedValue(undefined),
    resolveVehicleName: jest.fn().mockResolvedValue(''),
    driver: null,
    isAuthenticated: false,
    isSupervisorMode: false,
    vehicleId: null,
    vehicleName: null,
    serviceStatus: 'out_of_service' as const,
    selectedRoute: '',
    selectedRouteId: null,
    selectedManifestId: null,
    passengerCount: 0,
    apcCount: 0,
    hasShownSupervisorModal: false,
    isSyncingVehicle: false,
  }),
}));

describe('PinEntryScreen', () => {
  beforeEach(() => {
    mockLogin.mockClear();
    mockLogin.mockImplementation(() => Promise.resolve(true));
  });

  it('enters PIN and calls login', async () => {
    const nav = createMockNavigation();
    const driver = {
      id: '1',
      name: 'Test',
      role: 'driver' as const,
      requiresPin: true,
      pin: '1234',
    };
    renderWithLayout(
      <SafeAreaProvider>
        <PinEntryScreen navigation={nav} route={{ params: { driver } }} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Please enter driver login passcode')).toBeTruthy();
    for (const digit of ['1', '2', '3', '4']) {
      fireEvent.press(screen.getByText(digit));
    }
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  });
});
