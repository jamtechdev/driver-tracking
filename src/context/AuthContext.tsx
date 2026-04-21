/**
 * Auth Context - Driver selection & PIN authentication
 * Persists session so user stays logged in after app reload until they logout.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Driver } from '../data/drivers';
import { DRIVERS } from '../data/drivers';
import { getDriverData } from '@/api/driverData.api';
import { getVehiclesByDriver, getVehicleAssignment } from '@/api/vehicle.api';
import { getManifestAssignmentsByVehicle, getManifestsForToday } from '@/api/manifests.api';
import { reportMdtStatusAfterLogin } from '@/api/mdt.api';
import { deviceService } from '@/services/device.service';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

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
  selectedManifestId: number | null;
  passengerCount: number;
  apcCount: number;
  hasShownSupervisorModal: boolean;
}

interface AuthContextType extends AuthState {
  login: (driver: Driver, pin?: string) => Promise<boolean>;
  logout: () => void;
  selectDriver: (driver: Driver) => Promise<void>;
  setVehicleId: (id: string | null) => void;
  setVehicleName: (name: string | null) => void;
  setServiceStatus: (status: 'in_service' | 'out_of_service') => void;
  selectRouteOrStatus: (value: string, routeId?: string | null, manifestId?: number | null) => void;
  setSelectedManifestId: (id: number | null) => void;
  setPassengerCount: (count: number | ((prev: number) => number)) => void;
  setHasShownSupervisorModal: (shown: boolean) => void;
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
  selectedManifestId: null,
  passengerCount: 0,
  apcCount: 0,
  hasShownSupervisorModal: false,
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
    console.log('parsed', parsed);
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
      selectedManifestId: typeof parsed.selectedManifestId === 'number' || parsed.selectedManifestId === null ? parsed.selectedManifestId : initialState.selectedManifestId,
      passengerCount: typeof parsed.passengerCount === 'number' || typeof parsed.passengerCount === 'string' ? parsed.passengerCount : initialState.passengerCount,
      apcCount: typeof parsed.apcCount === 'number' ? parsed.apcCount : (typeof parsed.passengerCount === 'number' ? parsed.passengerCount : initialState.apcCount),
      hasShownSupervisorModal: typeof parsed.hasShownSupervisorModal === 'boolean' ? parsed.hasShownSupervisorModal : initialState.hasShownSupervisorModal,
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
      vehicleName: state.vehicleId,
      serviceStatus: state.serviceStatus,
      selectedRoute: state.selectedRoute,
      selectedRouteId: state.selectedRouteId,
      selectedManifestId: state.selectedManifestId,
      passengerCount: state.passengerCount,
      apcCount: state.apcCount,
      hasShownSupervisorModal: state.hasShownSupervisorModal,
    };
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(toStore)).catch(() => { });
  }, [state]);

  const fetchAndSetVehicle = async (driverId: string) => {
    try {
      const vehicles = await getVehiclesByDriver(driverId);
      if (vehicles.length > 0) {
        const lastVehicle = vehicles[vehicles.length - 1];
        const vId = lastVehicle.vehicleID || lastVehicle.vehicleNumber;
        if (vId) {
          const updates: any = {
            vehicleId: String(vId),
            vehicleName: String(vId),
            passengerCount: Number(lastVehicle.APCCount) || 0,
            apcCount: Number(lastVehicle.APCCount) || 0,
          };

          // Fetch current assignment for this vehicle (Route AND Manifest)
          const [assignment, manifests, allManifests] = await Promise.all([
            getVehicleAssignment(String(vId)),
            getManifestAssignmentsByVehicle(String(vId)),
            getManifestsForToday(),
          ]);
          console.log('All Manifest====>>>>', allManifests)
          if (assignment.success && assignment.routeID && (String(assignment.routeID) !== '0')) {
            updates.selectedRouteId = assignment.routeID;
            updates.selectedManifestId = null;

            // Try to find the route name
            try {
              const driverData = await getDriverData();
              const routes = Array.isArray(driverData?.route) ? driverData.route : [];
              const match = routes.find((r: any) => String(r.routeID) === String(assignment.routeID));
              if (match) {
                updates.selectedRoute = match.shortName || String(assignment.routeID);
                updates.serviceStatus = 'in_service';
              }
            } catch (e) {
              console.error('[AuthContext] Error finding route name:', e);
            }
          } else if (manifests.length > 0) {
            // Find the most recent active manifest assignment
            const activeManifest = manifests[0];
            updates.selectedManifestId = activeManifest.manifestID;
            updates.selectedRouteId = null;

            // Try to find the manifest name
            const match = allManifests.find((m) => m.manifestID === activeManifest.manifestID);
            if (match) {
              updates.selectedRoute = match.name;
              updates.serviceStatus = 'in_service';
            } else {
              updates.selectedRoute = `Block ${activeManifest.manifestID}`;
              updates.serviceStatus = 'in_service';
            }
          }

          return updates;
        }
      }
    } catch (e) {
      console.error('[AuthContext] Error fetching vehicle/assignment for driver:', driverId, e);
    }
    return null;
  };

  const login = useCallback(async (driver: Driver, pin?: string): Promise<boolean> => {
    if (driver.role === 'unassigned') {
      setState((s) => ({ ...s, driver, isAuthenticated: true, isSupervisorMode: false }));
      return true;
    }

    // Attempt to resolve driver from API for the most up-to-date ID/Role
    let resolvedDriver = driver;
    try {
      const data = await getDriverData();
      const driverList = Array.isArray(data?.driver) ? data.driver : [];
      const match = driverList.find((d: any) => String(d.driverID) === String(driver.id) || d.driverName === driver.name);

      if (match) {
        resolvedDriver = {
          ...driver,
          id: String(match.driverID),
          name: match.driverName || driver.name,
          role: (match.supervisor === 1 || match.supervisor === '1') ? 'supervisor' : 'driver',
          requiresPin: !!match.code,
          pin: match.code ?? driver.pin,
        };
      }
    } catch (e) {
      console.warn('[AuthContext] Driver lookup failed during login, using provided driver object.', e);
    }
    // Now verify PIN with the resolved driver if needed
    if (resolvedDriver.requiresPin && pin !== undefined) {
      const isValid = resolvedDriver.pin === pin;
      if (!isValid) return false;
    } else if (resolvedDriver.requiresPin) {
      return false;
    }

    // Now fetch vehicle/assignment info using the resolved ID
    const vehicleUpdates = resolvedDriver?.role !== 'supervisor' && await fetchAndSetVehicle(resolvedDriver.id);
    const deviceBrightness = await deviceService.getBrightness();
    // Call MDT status update after login (proactively)
    if (resolvedDriver?.role !== 'supervisor') {
      const vId = vehicleUpdates ? vehicleUpdates.vehicleId : initialState.vehicleId;
      if (vId) {
        reportMdtStatusAfterLogin({
          agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
          vehicleID: String(vId),
          driverID: String(resolvedDriver.id),
          screenBrightness: deviceBrightness / 100,
        }).catch((e: Error) => {
          console.error('[AuthContext] Failed to report MDT status after login:', e);
        });
      }
    }

    setState((s) => ({
      ...s,
      driver: resolvedDriver,
      isAuthenticated: true,
      isSupervisorMode: resolvedDriver.role === 'supervisor',
      hasShownSupervisorModal: false, // Reset on every login
      // Reset to defaults first to prevent leaking previous session data
      vehicleId: initialState.vehicleId,
      vehicleName: initialState.vehicleId,
      serviceStatus: initialState.serviceStatus,
      selectedRoute: initialState.selectedRoute,
      selectedRouteId: initialState.selectedRouteId,
      passengerCount: 0,
      ...(vehicleUpdates || {}),
    }));
    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      setState(initialState);
    } catch (e) {
      console.log('Logout error:', e);
    }
  }, []);
  const selectDriver = useCallback(async (driver: Driver) => {
    try {
      const data = await getDriverData();
      const driverList = data?.driver;
      const list = Array.isArray(driverList) ? driverList : [];
      const match = list.find((d) => String(d.driverID) === String(driver.id));

      let mapped: Driver = driver;
      if (match) {
        mapped = {
          id: match.driverID,
          name: match.driverName ?? driver.name,
          role: (match.supervisor === 1 || match.supervisor === '1') ? 'supervisor' : 'driver',
          requiresPin: !!match.code,
          pin: match.code ?? driver.pin,
        };
      }

      // Fetch vehicles for the selected driver and pick the last one
      const vehicleUpdates = await fetchAndSetVehicle(driver.id);

      setState((s) => ({
        ...s,
        driver: mapped,
        isSupervisorMode: mapped.role === 'supervisor',
        hasShownSupervisorModal: false,
        // Reset to defaults first
        vehicleId: initialState.vehicleId,
        vehicleName: initialState.vehicleId,
        serviceStatus: initialState.serviceStatus,
        selectedRoute: initialState.selectedRoute,
        selectedRouteId: initialState.selectedRouteId,
        passengerCount: 0,
        ...(vehicleUpdates || {}),
      }));
    } catch (_error) {
      const vehicleUpdates = await fetchAndSetVehicle(driver.id);
      setState((s) => ({
        ...s,
        driver,
        isSupervisorMode: driver.role === 'supervisor',
        hasShownSupervisorModal: false,
        // Reset to defaults first
        vehicleId: initialState.vehicleId,
        vehicleName: initialState.vehicleId,
        serviceStatus: initialState.serviceStatus,
        selectedRoute: initialState.selectedRoute,
        selectedRouteId: initialState.selectedRouteId,
        passengerCount: 0,
        ...(vehicleUpdates || {}),
      }));
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

  const selectRouteOrStatus = useCallback((value: string, routeId?: string | null, manifestId?: number | null) => {
    const isOutOfService = value === 'Out of Service';
    setState((s) => ({
      ...s,
      selectedRoute: value,
      selectedRouteId: isOutOfService ? null : (routeId ?? null),
      selectedManifestId: isOutOfService ? null : (manifestId ?? null),
      serviceStatus: isOutOfService ? 'out_of_service' : 'in_service',
      ...(isOutOfService ? {
        passengerCount: 0,
        // driver: unassignedDriver,
        // vehicleId: initialState.vehicleId,
        // vehicleName: initialState.vehicleId,
      } : {}),
    }));
  }, []);

  const setSelectedManifestId = useCallback((selectedManifestId: number | null) => {
    setState((s) => ({ ...s, selectedManifestId }));
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
        setSelectedManifestId,
        setHasShownSupervisorModal: (shown: boolean) => setState((s) => ({ ...s, hasShownSupervisorModal: shown })),
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
