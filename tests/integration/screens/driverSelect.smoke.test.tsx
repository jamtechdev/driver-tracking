import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import DriverSelectScreen from '@/screens/auth/DriverSelectScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    login: jest.fn(),
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

jest.mock('@/context/PinEntryModalContext', () => ({
  PinEntryModalProvider: ({ children }: { children: React.ReactNode }) => children,
  usePinEntryModal: () => ({ open: jest.fn(), close: jest.fn(), isOpen: false }),
}));

describe('DriverSelectScreen', () => {
  it('lists drivers in modal', () => {
    const nav = createMockNavigation();
    renderWithLayout(
      <SafeAreaProvider>
        <DriverSelectScreen navigation={nav} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Select Driver', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('James T Kirk', { includeHiddenElements: true })).toBeTruthy();
  });
});
