import React from 'react';
import { screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from '@/screens/home/HomeScreen';
import { createMockNavigation } from '../../mocks/navigation';
import { renderWithLayout } from '../../helpers/renderWithLayout';

jest.mock('@/api/passenger.api', () => ({
  passengerApi: {
    getHistory: jest.fn().mockResolvedValue([]),
    updateCount: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/services/messaging.service', () => ({
  messagingService: {
    initializeTTS: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn(),
    stop: jest.fn(),
    onFinish: jest.fn(() => () => {}),
  },
}));

jest.mock('@/components/VehicleSelectModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/PassengerCountModal', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/BulkPassengerNumpad', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/SupervisorModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    driver: { id: '1', name: 'Driver', role: 'driver' as const, requiresPin: false },
    passengerCount: 0,
    setPassengerCount: jest.fn(),
    selectedRouteId: null,
    hasShownSupervisorModal: true,
    setHasShownSupervisorModal: jest.fn(),
    vehicleId: 'v1',
    apcCount: 0,
    selectedRoute: 'Out of Service',
    logout: jest.fn(),
    login: jest.fn(),
    selectDriver: jest.fn(),
    setVehicleId: jest.fn(),
    setVehicleName: jest.fn(),
    setServiceStatus: jest.fn(),
    selectRouteOrStatus: jest.fn(),
    setSelectedManifestId: jest.fn(),
    syncVehicleAssignment: jest.fn().mockResolvedValue(undefined),
    resolveVehicleName: jest.fn().mockResolvedValue(''),
    isAuthenticated: true,
    isSupervisorMode: false,
    vehicleName: null,
    serviceStatus: 'out_of_service' as const,
    selectedManifestId: null,
    isSyncingVehicle: false,
  }),
}));

jest.mock('@/context/DriverModalContext', () => ({
  DriverModalProvider: ({ children }: { children: React.ReactNode }) => children,
  useDriverModal: () => ({ isOpen: false, open: jest.fn(), close: jest.fn() }),
}));

jest.mock('@/context/EmergencyContext', () => ({
  EmergencyProvider: ({ children }: { children: React.ReactNode }) => children,
  useEmergency: () => ({
    emergencyActivated: false,
    activateEmergency: jest.fn(),
    deactivateEmergency: jest.fn(),
    openDeactivateReasonModal: jest.fn(),
  }),
}));

jest.mock('@/context/ReportIncidentModalContext', () => ({
  ReportIncidentModalProvider: ({ children }: { children: React.ReactNode }) => children,
  useReportIncidentModal: () => ({ open: jest.fn(), close: jest.fn(), isOpen: false }),
}));

jest.mock('@/context/DriverModelContext', () => ({
  DriverModelProvider: ({ children }: { children: React.ReactNode }) => children,
  useDriverModel: () => ({
    minsLate: 0,
    lastLocation: { latitude: 0, longitude: 0 },
    nextStop: null,
    schedule: [],
    setOnLocationXmit: jest.fn(),
  }),
}));

jest.mock('@/context/DriverDataContext', () => ({
  DriverDataProvider: ({ children }: { children: React.ReactNode }) => children,
  useDriverData: () => ({
    fareCategories: [],
    stops: [],
  }),
}));

describe('HomeScreen', () => {
  it('renders dashboard shell', async () => {
    const nav = createMockNavigation();
    renderWithLayout(
      <SafeAreaProvider>
        <HomeScreen navigation={nav} />
      </SafeAreaProvider>,
    );
    await screen.findByText(/Auto\/Tracking/);
    expect(screen.getByText(/Auto\/Tracking/)).toBeTruthy();
  });
});
