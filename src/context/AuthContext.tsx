/**
 * Auth Context - Driver selection & PIN authentication
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Driver } from '../data/drivers';
import { DRIVERS } from '../data/drivers';

interface AuthState {
  driver: Driver | null;
  isAuthenticated: boolean;
  isSupervisorMode: boolean;
  vehicleId: string | null;
  serviceStatus: 'in_service' | 'out_of_service';
  selectedRoute: string;
}

interface AuthContextType extends AuthState {
  login: (driver: Driver, pin?: string) => boolean;
  logout: () => void;
  selectDriver: (driver: Driver) => void;
  setVehicleId: (id: string | null) => void;
  setServiceStatus: (status: 'in_service' | 'out_of_service') => void;
  selectRouteOrStatus: (value: string) => void;
}

const unassignedDriver = DRIVERS.find((d) => d.role === 'unassigned') || DRIVERS[0];

const initialState: AuthState = {
  driver: unassignedDriver,
  isAuthenticated: true,
  isSupervisorMode: false,
  vehicleId: '110',
  serviceStatus: 'out_of_service',
  selectedRoute: 'Out of Service',
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>(initialState);

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
  }, []);

  const selectDriver = useCallback((driver: Driver) => {
    setState((s) => ({
      ...s,
      driver,
      isSupervisorMode: driver.role === 'supervisor',
    }));
  }, []);

  const setVehicleId = useCallback((vehicleId: string | null) => {
    setState((s) => ({ ...s, vehicleId }));
  }, []);

  const setServiceStatus = useCallback((serviceStatus: 'in_service' | 'out_of_service') => {
    setState((s) => ({ ...s, serviceStatus }));
  }, []);

  const selectRouteOrStatus = useCallback((value: string) => {
    const isOutOfService = value === 'Out of Service';
    setState((s) => ({
      ...s,
      selectedRoute: value,
      serviceStatus: isOutOfService ? 'out_of_service' : 'in_service',
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
        setServiceStatus,
        selectRouteOrStatus,
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
