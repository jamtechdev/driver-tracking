/**
 * Auth Context - Driver selection & PIN authentication
 * Persists session so user stays logged in after app reload until they logout.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Driver } from '../data/drivers';
import { DRIVERS } from '../data/drivers';
import { getDriverData } from '@/api/driverData.api';

const AUTH_STORAGE_KEY = '@driver_tracking:auth_state';

interface AuthState {
  driver: Driver | null;
  isAuthenticated: boolean;
  isSupervisorMode: boolean;
  vehicleId: string | null;
  vehicleName: string | null;
  serviceStatus: 'in_service' | 'out_of_service';
  selectedRoute: string;
  selectedRouteId: string | null;
  passengerCount: number;
}

interface AuthContextType extends AuthState {
  login: (driver: Driver, pin?: string) => boolean;
  logout: () => void;
  selectDriver: (driver: Driver) => void;
  setVehicleId: (id: string | null) => void;
  setVehicleName: (name: string | null) => void;
  setServiceStatus: (status: 'in_service' | 'out_of_service') => void;
  selectRouteOrStatus: (value: string, routeId?: string | null) => void;
  setPassengerCount: (count: number | ((prev: number) => number)) => void;
}

const unassignedDriver = DRIVERS.find((d) => d.role === 'unassigned') || DRIVERS[0];

const initialState: AuthState = {
  driver: unassignedDriver,
  isAuthenticated: true,
  isSupervisorMode: false,
  vehicleId: '110',
  vehicleName: null,
  serviceStatus: 'out_of_service',
  selectedRoute: 'Out of Service',
  selectedRouteId: null,
  passengerCount: 0,
};

function isDriverLike(obj: unknown): obj is Driver {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    'name' in obj &&
    'role' in obj &&
    typeof (obj as Driver).role === 'string'
  );
}

function parseStoredState(raw: string | null): AuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthState> & { driver?: unknown };
    if (!parsed || !isDriverLike(parsed.driver)) return null;
    return {
      driver: parsed.driver as Driver,
      isAuthenticated: parsed.isAuthenticated ?? true,
      isSupervisorMode: parsed.isSupervisorMode ?? false,
      vehicleId: typeof parsed.vehicleId === 'string' ? parsed.vehicleId : initialState.vehicleId,
      vehicleName: typeof parsed.vehicleName === 'string' || parsed.vehicleName === null ? parsed.vehicleName : initialState.vehicleName,
      serviceStatus: parsed.serviceStatus === 'in_service' || parsed.serviceStatus === 'out_of_service' ? parsed.serviceStatus : initialState.serviceStatus,
      selectedRoute: typeof parsed.selectedRoute === 'string' ? parsed.selectedRoute : initialState.selectedRoute,
      selectedRouteId: typeof parsed.selectedRouteId === 'string' || parsed.selectedRouteId === null ? parsed.selectedRouteId : initialState.selectedRouteId,
      passengerCount: typeof parsed.passengerCount === 'number' ? parsed.passengerCount : initialState.passengerCount,
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);
  const hasRestored = useRef(false);

  // Restore session from storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (cancelled) return;
        const restored = parseStoredState(stored);
        if (restored) setState(restored);
      } catch (_e) {
        // keep initialState
      } finally {
        if (!cancelled) hasRestored.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist state whenever it changes (after first restore)
  useEffect(() => {
    if (!hasRestored.current) return;
    const toStore = {
      driver: state.driver,
      isAuthenticated: state.isAuthenticated,
      isSupervisorMode: state.isSupervisorMode,
      vehicleId: state.vehicleId,
      vehicleName: state.vehicleName,
      serviceStatus: state.serviceStatus,
      selectedRoute: state.selectedRoute,
      selectedRouteId: state.selectedRouteId,
      passengerCount: state.passengerCount,
    };
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore)).catch(() => {});
  }, [state]);

  const login = useCallback((driver: Driver, pin?: string): boolean => {
    if (driver.role === 'unassigned') {
      setState((s) => ({ ...s, driver, isAuthenticated: true, isSupervisorMode: false }));
      return true;
    }
    if (driver.requiresPin && pin !== undefined) {
      const isValid = driver.pin === pin;
      if (!isValid) return false;
    } else if (driver.requiresPin) {
      return false;
    }
    setState((s) => ({
      ...s,
      driver,
      isAuthenticated: true,
      isSupervisorMode: driver.role === 'supervisor',
    }));
    return true;
  }, []);

  const logout = useCallback(() => {
    setState(initialState);
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  }, []);

  const selectDriver = useCallback(async (driver: Driver) => {
    try {
      const data = await getDriverData();
      const driverList = data?.driver;
      const list = Array.isArray(driverList) ? driverList : [];
      const match = list.find((d) => String(d.driverID) === String(driver.id));
      if (match) {
        const mapped: Driver = {
          id: match.driverID,
          name: match.driverName ?? driver.name,
          role: (match.supervisor === 1 || match.supervisor === '1') ? 'supervisor' : 'driver',
          requiresPin: !!match.code,
          pin: match.code ?? driver.pin,
        };
        setState((s) => ({ ...s, driver: mapped, isSupervisorMode: mapped.role === 'supervisor' }));
      } else {
        setState((s) => ({ ...s, driver, isSupervisorMode: driver.role === 'supervisor' }));
      }
    } catch (_error) {
      setState((s) => ({ ...s, driver, isSupervisorMode: driver.role === 'supervisor' }));
    }
  }, []);

  const setVehicleId = useCallback((vehicleId: string | null) => {
    setState((s) => ({ ...s, vehicleId }));
  }, []);

  const setVehicleName = useCallback((vehicleName: string | null) => {
    setState((s) => ({ ...s, vehicleName }));
  }, []);

  const setServiceStatus = useCallback((serviceStatus: 'in_service' | 'out_of_service') => {
    setState((s) => ({ ...s, serviceStatus }));
  }, []);

  const selectRouteOrStatus = useCallback((value: string, routeId?: string | null) => {
    const isOutOfService = value === 'Out of Service';
    setState((s) => ({
      ...s,
      selectedRoute: value,
      selectedRouteId: isOutOfService ? null : (routeId ?? s.selectedRouteId),
      serviceStatus: isOutOfService ? 'out_of_service' : 'in_service',
      ...(isOutOfService ? { passengerCount: 0 } : {}),
    }));
  }, []);

  const setPassengerCount = useCallback((countOrUpdater: number | ((prev: number) => number)) => {
    setState((s) => ({
      ...s,
      passengerCount: typeof countOrUpdater === 'function' ? countOrUpdater(s.passengerCount) : countOrUpdater,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        selectDriver,
        setVehicleId,
        setVehicleName,
        setServiceStatus,
        selectRouteOrStatus,
        setPassengerCount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
