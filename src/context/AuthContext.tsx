/**
 * Auth Context - Driver selection & PIN authentication
 * Persists session so user stays logged in after app reload until they logout.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Driver } from '../data/drivers';
import { DRIVERS } from '../data/drivers';
import { getDriverData } from '@/api/driverData.api';
import { lookupVehicleName, setAgencyVehicles } from '@/utils/vehicleLookup';
import { getVehiclesByDriver, getVehicleAssignment } from '@/api/vehicle.api';
import { getManifestAssignmentsByVehicle, getManifestsForToday } from '@/api/manifests.api';
import { getPrimaryRouteIdFromManifestJson } from '@/utils/manifestMap';
import { isAssignedRouteId } from '@/utils/helpers';
import { reportMdtStatusAfterLogin } from '@/api/mdt.api';
import { deviceService } from '@/services/device.service';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { usePeakApiEnabled } from '@/hooks/usePeakApiEnabled';
import { useAssignmentSync } from '@/hooks/useAssignmentSync';
import {
  applyDriverManualIos,
  applyDriverUnassignedIos,
  selectDriverFromAssignmentIos,
} from '@/services/driverAssignment.service';
import { getAssignment } from '@/api/position.api';
import {
  getAssignedDriverIdFromResult,
  parseAssignmentDriverId,
  resolveVehicleAssignmentSources,
} from '@/utils/assignmentDriverId';
import { hasServerAssignment, ASSIGNMENT_ROUTE_STICKY_MS, getRouteIdFromAssignmentResult } from '@/utils/assignmentSync';
import { getMdtRouteIdForVehicleUpdate } from '@/utils/resolveOutboundRouteId';
import {
  findDriverById,
  lookupDriverByIdFromRoster,
  subscribeAgencyDriversUpdated,
} from '@/utils/driverLookup';
import {
  getMdtDriverIdFromSelectedDriver,
  getTelemetryDriverIdFromAssignmentApi,
} from '@/utils/mdtTelemetry';
import { coerceDriverIdForApi } from '@/utils/outboundDriverId';
import {
  findRouteLabelById,
  isDisplayableRouteLabel,
  lookupRouteLabelById,
  subscribeAgencyRoutesUpdated,
} from '@/utils/routeLookup';
import {
  findBlockNameById,
  lookupBlockNameById,
  setTodayManifests,
  subscribeTodayManifestsUpdated,
} from '@/utils/manifestLookup';
import type { AssignmentResponse, VehicleAssignmentPayload } from '@/api/position.api';

const AUTH_STORAGE_KEY = '@driver_tracking:auth_state';
/** iOS NSUserDefaults vehicleAssignmentUpdated — 0 means use admin portal assignment on MDT. */
const VEHICLE_ASSIGNMENT_UPDATED_KEY = '@driver_tracking:vehicle_assignment_updated';

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
  isSyncingVehicle: boolean;
}

interface AuthContextType extends AuthState {
  login: (driver: Driver, pin?: string) => Promise<boolean>;
  logout: () => void;
  selectDriver: (driver: Driver) => Promise<void>;
  setVehicleId: (id: string | null, options?: { fromTablet?: boolean }) => void;
  setVehicleName: (name: string | null) => void;
  setServiceStatus: (status: 'in_service' | 'out_of_service') => void;
  selectRouteOrStatus: (
    value: string,
    routeId?: string | null,
    manifestId?: number | null,
    options?: { manual?: boolean },
  ) => void;
  /** Call before tablet-initiated driver change (sets override like iOS selectDriverID). */
  markDriverManualSelection: () => void;
  /** Call before login(select unassigned) so launch restore does not clear dashboard assignments. */
  markUserRequestedUnassign: () => void;
  /** False until cold-start assignment bootstrap finishes (MDT should wait). */
  isAssignmentBootstrapDone: boolean;
  /** driverID for MDT / vehicle update from assignment API (hasAssignment 1/0). */
  getMdtDriverId: () => string | number;
  /** routeID for vehicle/update — iOS selectedRoute (sticky assignment when local briefly OOS). */
  getMdtRouteId: () => string | number;
  /** iOS NSUserDefaults vehicleAssignmentUpdated for MDT. */
  getVehicleAssignmentUpdated: () => number;
  /** Driver name for bottom-bar tab (includes dashboard assignment when UI is Unassigned). */
  driverTabLabel: string;
  /** Route/block name for bottom-bar tab (resolves from IDs when label is missing). */
  routeTabLabel: string;
  /** Driver shown in tab — local selection or assignment from server. */
  driverForTab: Driver;
  /** Run updateAssignment now (e.g. after vehicle select). */
  syncAssignmentNow: () => void;
  /** iOS selectDriverID(-2): accept dashboard-assigned driver without manual override. */
  acceptDashboardAssignment: () => void;
  /** Call before tablet-initiated route change (sets override like iOS manualSelectRouteID). */
  markRouteManualSelection: () => void;
  setSelectedManifestId: (id: number | null) => void;
  setPassengerCount: (count: number | ((prev: number) => number)) => void;
  setHasShownSupervisorModal: (shown: boolean) => void;
  syncVehicleAssignment: () => Promise<void>;
  /** MDT status + assignment refresh after Peak user login / session restore. */
  runPostLoginAuthBootstrap: () => Promise<void>;
  resolveVehicleName: (vId: string) => Promise<string>;
}

const unassignedDriver = DRIVERS.find((d) => d.role === 'unassigned') || DRIVERS[0];

const initialState: AuthState = {
  driver: unassignedDriver,
  isAuthenticated: true,
  isSupervisorMode: false,
  vehicleId: null,
  vehicleName: null,
  serviceStatus: 'out_of_service',
  selectedRoute: 'Out of Service',
  selectedRouteId: null,
  selectedManifestId: null,
  passengerCount: 0,
  apcCount: 0,
  hasShownSupervisorModal: false,
  isSyncingVehicle: false,
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

function parseStoredId(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function parseStoredManifestId(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

function needsRouteLabelResolution(
  state: Pick<AuthState, 'selectedRoute' | 'selectedRouteId' | 'selectedManifestId' | 'serviceStatus'>,
): boolean {
  if (state.serviceStatus !== 'in_service') return false;
  if (isDisplayableRouteLabel(state.selectedRoute, state.selectedRouteId, state.selectedManifestId)) {
    return false;
  }
  return isAssignedRouteId(state.selectedRouteId) || state.selectedManifestId != null;
}

async function resolveStoredRouteLabel(input: {
  selectedRouteId: string | null;
  selectedManifestId: number | null;
}): Promise<string | null> {
  if (input.selectedManifestId != null) {
    const blockName = await lookupBlockNameById(input.selectedManifestId);
    if (blockName) return blockName;
  }

  if (isAssignedRouteId(input.selectedRouteId)) {
    return lookupRouteLabelById(input.selectedRouteId!);
  }

  return null;
}

function parseStoredState(raw: string | null): AuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthState> & { driver?: unknown };
    if (!parsed) return null;

    const storedDriver = isDriverLike(parsed.driver) ? (parsed.driver as Driver) : initialState.driver;

    const passengerRaw = parsed.passengerCount;
    const passengerCount =
      typeof passengerRaw === 'number'
        ? passengerRaw
        : typeof passengerRaw === 'string'
          ? parseInt(passengerRaw, 10) || 0
          : initialState.passengerCount;

    return {
      driver: storedDriver,
      isAuthenticated: parsed.isAuthenticated ?? true,
      isSupervisorMode: parsed.isSupervisorMode ?? false,
      vehicleId: parseStoredId(parsed.vehicleId),
      vehicleName:
        parsed.vehicleName == null
          ? null
          : typeof parsed.vehicleName === 'string'
            ? parsed.vehicleName
            : typeof parsed.vehicleName === 'number'
              ? String(parsed.vehicleName)
              : initialState.vehicleName,
      serviceStatus:
        parsed.serviceStatus === 'in_service' || parsed.serviceStatus === 'out_of_service'
          ? parsed.serviceStatus
          : initialState.serviceStatus,
      selectedRoute: typeof parsed.selectedRoute === 'string'
        ? parsed.selectedRoute
        : initialState.selectedRoute,
      selectedRouteId: parseStoredId(parsed.selectedRouteId),
      selectedManifestId: parseStoredManifestId(parsed.selectedManifestId),
      passengerCount,
      apcCount: typeof parsed.apcCount === 'number'
        ? parsed.apcCount
        : passengerCount,
      hasShownSupervisorModal: typeof parsed.hasShownSupervisorModal === 'boolean'
        ? parsed.hasShownSupervisorModal
        : initialState.hasShownSupervisorModal,
      isSyncingVehicle: false,
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const apiEnabled = usePeakApiEnabled();
  const [state, setState] = useState<AuthState>(initialState);
  const [isAssignmentBootstrapDone, setIsAssignmentBootstrapDone] = useState(false);
  const [isAuthRestored, setIsAuthRestored] = useState(false);
  const [routeLabelTick, setRouteLabelTick] = useState(0);
  const hasRestored = useRef(false);
  /** When true, assignment poll must not overwrite driver (iOS driverOverride). */
  const driverOverrideRef = useRef(false);
  /** After tablet Unassigned: hold selectDriverID(-2) until server clears assignment driver. */
  const manualUnassignActiveRef = useRef(false);
  /** Server driver ID we are clearing via unassign — new admin assignment with a different ID is allowed. */
  const manualUnassignBlockedDriverIdRef = useRef<string | null>(null);
  /** True only when the user tapped Unassigned this session (never on cold start). */
  const userRequestedServerUnassignRef = useRef(false);
  const assignmentBootstrapDoneRef = useRef(false);
  const assignmentBootstrapStartedRef = useRef(false);
  const assignmentSyncRunRef = useRef<(() => void) | null>(null);
  const assignmentAdoptGraceClearRef = useRef<(() => void) | null>(null);
  const [assignmentTabDriver, setAssignmentTabDriver] = useState<Driver | null>(null);
  /** When true, assignment poll must not overwrite route (iOS routeOverride). */
  const routeOverrideRef = useRef(false);
  const routeLastSelectedRef = useRef(0);
  const assignmentRef = useRef<VehicleAssignmentPayload | null>(null);
  /** MDT/vehicle driverID from last assignment API response. */
  const assignmentApiDriverIdRef = useRef<string | number>(0);
  const lastServerAssignmentAtRef = useRef(0);
  const lastAssignmentRouteIdRef = useRef<string | null>(null);
  const lastAssignmentCurrentRouteIdRef = useRef<string | null>(null);
  const routeOverrideRefForTelemetry = useRef(false);
  const serviceStatusRef = useRef(state.serviceStatus);
  const vehicleIdRef = useRef<string | null>(state.vehicleId);
  const driverRef = useRef<Driver | null>(state.driver);
  const selectedRouteIdRef = useRef<string | null>(state.selectedRouteId);
  const selectedManifestIdRef = useRef<number | null>(state.selectedManifestId);
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  useEffect(() => {
    vehicleIdRef.current = state.vehicleId;
    driverRef.current = state.driver;
    selectedRouteIdRef.current = state.selectedRouteId;
    selectedManifestIdRef.current = state.selectedManifestId;
    serviceStatusRef.current = state.serviceStatus;
    routeOverrideRefForTelemetry.current = routeOverrideRef.current;
  }, [state.vehicleId, state.driver, state.selectedRouteId, state.selectedManifestId, state.serviceStatus]);

  const prevVehicleIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevVehicleIdRef.current;
    prevVehicleIdRef.current = state.vehicleId;
    if (prev != null && prev !== state.vehicleId) {
      manualUnassignActiveRef.current = false;
      manualUnassignBlockedDriverIdRef.current = null;
      driverOverrideRef.current = false;
      setAssignmentTabDriver(null);
    }
  }, [state.vehicleId]);

  const applyAssignmentApiTelemetry = useCallback((result: AssignmentResponse) => {
    const active = hasServerAssignment(result);
    if (active) {
      lastServerAssignmentAtRef.current = Date.now();
    }

    const routeFromApi = getRouteIdFromAssignmentResult(
      result,
      result.assignment ?? assignmentRef.current,
    );
    if (routeFromApi) {
      lastAssignmentCurrentRouteIdRef.current = routeFromApi;
      lastAssignmentRouteIdRef.current = routeFromApi;
    }

    if (!driverOverrideRef.current) {
      assignmentApiDriverIdRef.current = getTelemetryDriverIdFromAssignmentApi(result);
    }
    if (result.assignment) {
      assignmentRef.current = result.assignment;
      const ar = parseAssignmentDriverId(result.assignment.routeID);
      if (isAssignedRouteId(ar)) {
        lastAssignmentRouteIdRef.current = ar;
      }
    } else if (
      !active &&
      Date.now() - lastServerAssignmentAtRef.current > ASSIGNMENT_ROUTE_STICKY_MS
    ) {
      assignmentRef.current = null;
      lastAssignmentRouteIdRef.current = null;
      lastAssignmentCurrentRouteIdRef.current = null;
    }

    if (driverOverrideRef.current) return;

    const assignedId = getAssignedDriverIdFromResult(
      result,
      result.assignment ?? assignmentRef.current,
    );
    const local = driverRef.current;
    const localUnassigned = !local || local.role === 'unassigned';

    if (!assignedId) {
      if (!hasServerAssignment(result)) {
        setAssignmentTabDriver(null);
      }
      return;
    }

    if (localUnassigned) {
      const tabDriver = findDriverById(assignedId);
      if (tabDriver) {
        setAssignmentTabDriver(tabDriver);
      } else {
        void lookupDriverByIdFromRoster(assignedId).then((fromRoster: Driver | null) => {
          if (!fromRoster || driverOverrideRef.current) return;
          const stillUnassigned =
            !driverRef.current || driverRef.current.role === 'unassigned';
          if (!stillUnassigned) return;
          setAssignmentTabDriver(fromRoster);
        });
      }
    }
  }, []);

  /** iOS selectDriverID(-2): assignment ref + refs before route work; UI via setDriverFromSync. */
  const adoptDriverFromAssignment = useCallback((
    resolved: Driver,
    assignment: VehicleAssignmentPayload,
  ) => {
    assignmentRef.current = assignment;
    manualUnassignActiveRef.current = false;
    manualUnassignBlockedDriverIdRef.current = null;
    driverRef.current = resolved;
  }, []);

  const syncTelemetryDriverIdFromLocal = useCallback((driver: Driver | null) => {
    assignmentApiDriverIdRef.current = getMdtDriverIdFromSelectedDriver(driver);
  }, []);

  const getMdtRouteId = useCallback((): string | number => {
    return getMdtRouteIdForVehicleUpdate({
      selectedRouteId: selectedRouteIdRef.current,
      serviceStatus: serviceStatusRef.current,
      routeOverride: routeOverrideRefForTelemetry.current,
      assignment: assignmentRef.current,
      stickyAssignmentRouteId: lastAssignmentRouteIdRef.current,
      currentRouteIdFromApi: lastAssignmentCurrentRouteIdRef.current,
    });
  }, []);

  /** iOS selectedDriver for manual pick; assignment API when tablet is unassigned. */
  const getMdtDriverId = useCallback((): string | number => {
    const fromSelected = getMdtDriverIdFromSelectedDriver(driverRef.current);
    if (fromSelected !== 0 && fromSelected !== '0') {
      return fromSelected;
    }
    return coerceDriverIdForApi(assignmentApiDriverIdRef.current);
  }, []);

  const getVehicleAssignmentUpdated = useCallback(() => {
    return vehicleAssignmentUpdatedRef.current;
  }, []);

  const syncAssignmentNow = useCallback(() => {
    assignmentSyncRunRef.current?.();
  }, []);

  const registerAssignmentSync = useCallback((run: (() => void) | null) => {
    assignmentSyncRunRef.current = run;
  }, []);

  const registerAdoptGraceClear = useCallback((clear: (() => void) | null) => {
    assignmentAdoptGraceClearRef.current = clear;
  }, []);

  const vehicleAssignmentUpdatedRef = useRef(0);

  const driverForTab = useMemo((): Driver => {
    const local = state.driver ?? unassignedDriver;
    if (local.role !== 'unassigned') {
      return local;
    }
    if (assignmentTabDriver) {
      return assignmentTabDriver;
    }
    return local;
  }, [state.driver, assignmentTabDriver]);

  const driverTabLabel = driverForTab.name;

  const routeTabLabel = useMemo(() => {
    if (isDisplayableRouteLabel(state.selectedRoute, state.selectedRouteId, state.selectedManifestId)) {
      return state.selectedRoute!.trim();
    }
    if (state.serviceStatus === 'in_service') {
      if (state.selectedManifestId != null) {
        const blockName = findBlockNameById(state.selectedManifestId);
        if (blockName) return blockName;
        return '...';
      }
      if (isAssignedRouteId(state.selectedRouteId)) {
        const routeName = findRouteLabelById(state.selectedRouteId);
        if (routeName) return routeName;
        return '...';
      }
    }
    return 'Out of Service';
  }, [
    state.selectedRoute,
    state.selectedRouteId,
    state.selectedManifestId,
    state.serviceStatus,
    routeLabelTick,
  ]);

  useEffect(() => {
    getManifestsForToday()
      .then((list) => setTodayManifests(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const unsubRoutes = subscribeAgencyRoutesUpdated(() => {
      setRouteLabelTick((t) => t + 1);
    });
    const unsubManifests = subscribeTodayManifestsUpdated(() => {
      setRouteLabelTick((t) => t + 1);
    });
    return () => {
      unsubRoutes();
      unsubManifests();
    };
  }, []);

  const notifyManualDriverChange = useCallback(async (
    previousDriver: Driver | null,
    nextDriver: Driver,
    vehicleId: string | null,
  ) => {
    if (!vehicleId || vehicleId === '110') return;

    if (nextDriver.role === 'unassigned') {
      const clearServer = userRequestedServerUnassignRef.current;
      userRequestedServerUnassignRef.current = false;
      manualUnassignActiveRef.current = clearServer;
      driverOverrideRef.current = false;
      const fromAssignment = assignmentRef.current?.driverID;
      manualUnassignBlockedDriverIdRef.current =
        previousDriver != null && previousDriver.role !== 'unassigned'
          ? String(previousDriver.id).trim()
          : fromAssignment != null && String(fromAssignment) !== '0'
            ? String(fromAssignment).trim()
            : null;
      if (clearServer) {
        try {
          const result = await applyDriverUnassignedIos({
            vehicleId,
            currentDriver: previousDriver,
            selectedRouteId: selectedRouteIdRef.current,
            selectedManifestId: selectedManifestIdRef.current,
            clearAssignmentRecord: true,
          });
          assignmentRef.current = null;
          setAssignmentTabDriver(null);
          if (!result.success) {
            console.error('[AuthContext] Unassign driver failed:', result.errorMessage);
          } else if (__DEV__) {
            console.log('[AuthContext] Driver unassigned on server');
          }
        } catch (e) {
          console.error('[AuthContext] Unassign driver failed:', e);
        }
      }
      return;
    }

    manualUnassignActiveRef.current = false;
    driverOverrideRef.current = true;
    driverRef.current = nextDriver;
    syncTelemetryDriverIdFromLocal(nextDriver);
    try {
      await applyDriverManualIos({ vehicleId, driver: nextDriver });
    } catch (e) {
      console.warn('[AuthContext] Manual driver login failed:', e);
    }
  }, [syncTelemetryDriverIdFromLocal]);

  const resolveVehicleName = useCallback(async (vId: string): Promise<string> => {
    const cached = lookupVehicleName(vId);
    if (cached) return cached;

    try {
      const data = await getDriverData({ silent: true });
      setAgencyVehicles(Array.isArray(data?.vehicle) ? data.vehicle : []);
      const resolved = lookupVehicleName(vId);
      if (resolved) return resolved;
    } catch (e) {
      if (__DEV__) {
        console.warn('[AuthContext] resolveVehicleName failed:', e);
      }
    }
    return vId;
  }, []);

  const applyRestoredSessionRefs = useCallback((restored: AuthState) => {
    driverRef.current = restored.driver;
    vehicleIdRef.current = restored.vehicleId;
    selectedRouteIdRef.current = restored.selectedRouteId;
    selectedManifestIdRef.current = restored.selectedManifestId;
    const hasActiveRoute =
      restored.serviceStatus === 'in_service' &&
      (
        (restored.selectedRoute && restored.selectedRoute !== 'Out of Service') ||
        isAssignedRouteId(restored.selectedRouteId) ||
        restored.selectedManifestId != null
      );
    if (hasActiveRoute) {
      routeOverrideRef.current = true;
      routeLastSelectedRef.current = Date.now() / 1000;
    }

    const restoredDriver = restored.driver;
    if (restoredDriver && restoredDriver.role !== 'unassigned') {
      driverOverrideRef.current = true;
      assignmentApiDriverIdRef.current = getMdtDriverIdFromSelectedDriver(restoredDriver);
    }
  }, []);

  // Restore session from storage on mount — hydrate UI immediately, then sync assignment in background
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (cancelled) return;
        const restored = parseStoredState(stored);

        if (restored) {
          applyRestoredSessionRefs(restored);
          setState(restored);
          hasRestored.current = true;

          if (restored.vehicleId && !restored.vehicleName) {
            resolveVehicleName(restored.vehicleId).then((name) => {
              if (!cancelled) {
                setState((s) => ({ ...s, vehicleName: name }));
              }
            }).catch(() => {});
          }

          if (needsRouteLabelResolution(restored)) {
            resolveStoredRouteLabel(restored).then((label) => {
              if (!cancelled && label) {
                setState((s) => ({ ...s, selectedRoute: label }));
              }
            }).catch(() => {});
          }

          const vId = restored.vehicleId;
          if (vId && vId !== '110') {
            try {
              const assignmentResp = await getAssignment(vId, agencyID);
              if (cancelled) return;
              applyAssignmentApiTelemetry(assignmentResp);

              if (restored.driver?.role === 'unassigned') {
                const resolved = await resolveVehicleAssignmentSources(vId, assignmentResp);
                if (resolved.assignedDriverId && resolved.assignment) {
                  const adopted = await selectDriverFromAssignmentIos({
                    vehicleId: vId,
                    currentDriver: null,
                    assignment: resolved.assignment,
                  });
                  if (adopted && !cancelled) {
                    adoptDriverFromAssignment(adopted, resolved.assignment);
                    setState((s) => ({ ...s, driver: adopted }));
                  }
                }
              }

              if (__DEV__) {
                console.log('[AuthContext] Launch assignment telemetry driverID:', assignmentApiDriverIdRef.current);
              }
            } catch (e) {
              console.warn('[AuthContext] Launch assignment bootstrap failed:', e);
            }
          }
        } else {
          hasRestored.current = true;
        }

        assignmentBootstrapDoneRef.current = true;
        if (!cancelled) setIsAssignmentBootstrapDone(true);
      } catch (_e) {
        hasRestored.current = true;
        assignmentBootstrapDoneRef.current = true;
        if (!cancelled) setIsAssignmentBootstrapDone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [applyRestoredSessionRefs, adoptDriverFromAssignment, applyAssignmentApiTelemetry, resolveVehicleName]);

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
          const resolvedName =
            (lastVehicle.vehicleName && String(lastVehicle.vehicleName).trim()) ||
            (lastVehicle.vehicleNumber && String(lastVehicle.vehicleNumber).trim()) ||
            (await resolveVehicleName(String(vId)));
          const updates: any = {
            vehicleId: String(vId),
            vehicleName: resolvedName,
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
              const routeLabel =
                findRouteLabelById(String(assignment.routeID)) ||
                (match ? (match.shortName || match.longName) : null);
              if (routeLabel) {
                updates.selectedRoute = routeLabel;
              }
              updates.serviceStatus = 'in_service';
            } catch (e) {
              console.error('[AuthContext] Error finding route name:', e);
            }
          } else if (manifests.length > 0) {
            // Find the most recent active manifest assignment
            const activeManifest = manifests[0];
            updates.selectedManifestId = activeManifest.manifestID;

            const match = allManifests.find((m) => m.manifestID === activeManifest.manifestID);
            const blockRouteId = getPrimaryRouteIdFromManifestJson(match?.manifestJson);
            updates.selectedRouteId = isAssignedRouteId(blockRouteId) ? blockRouteId : null;

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

  const markUserRequestedUnassign = useCallback(() => {
    userRequestedServerUnassignRef.current = true;
    assignmentAdoptGraceClearRef.current?.();
  }, []);

  const login = useCallback(async (driver: Driver, pin?: string): Promise<boolean> => {
    if (driver.role === 'unassigned') {
      const prev = driverRef.current;
      const vId = vehicleIdRef.current;
      const clearServer = userRequestedServerUnassignRef.current;
      userRequestedServerUnassignRef.current = false;
      manualUnassignActiveRef.current = clearServer;
      driverOverrideRef.current = false;
      const fromAssignment = assignmentRef.current?.driverID;
      manualUnassignBlockedDriverIdRef.current =
        prev != null && prev.role !== 'unassigned'
          ? String(prev.id).trim()
          : fromAssignment != null && String(fromAssignment) !== '0'
            ? String(fromAssignment).trim()
            : null;

      if (clearServer && vId && vId !== '110') {
        try {
          const result = await applyDriverUnassignedIos({
            vehicleId: vId,
            currentDriver: prev?.role !== 'unassigned' ? prev : null,
            selectedRouteId: selectedRouteIdRef.current,
            selectedManifestId: selectedManifestIdRef.current,
            clearAssignmentRecord: true,
          });
          assignmentRef.current = null;
          setAssignmentTabDriver(null);
          if (!result.success) {
            console.error('[AuthContext] Unassign driver failed:', result.errorMessage);
          } else if (__DEV__) {
            console.log('[AuthContext] Driver unassigned on server (login)');
          }
        } catch (e) {
          console.error('[AuthContext] Unassign driver failed:', e);
        }
      }

      setState((s) => ({
        ...s,
        driver,
        isAuthenticated: true,
        isSupervisorMode: false,
      }));
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

    const previousDriver = driverRef.current;
    driverOverrideRef.current = true;
    driverRef.current = resolvedDriver;
    syncTelemetryDriverIdFromLocal(resolvedDriver);
    // UPDATE DRIVER IMMEDIATELY so the UI (like BottomBar) shows the name right away
    setState((s) => ({
      ...s,
      driver: resolvedDriver,
      isAuthenticated: true,
      isSupervisorMode: resolvedDriver.role === 'supervisor',
      hasShownSupervisorModal: false, // Reset on every login
    }));

    // Fetch vehicle/assignment and MDT status in the background to avoid blocking the UI
    (async () => {
      try {
        const vehicleUpdates = resolvedDriver?.role !== 'supervisor' && await fetchAndSetVehicle(resolvedDriver.id);
        const vIdForDriver =
          (vehicleUpdates && (vehicleUpdates as { vehicleId?: string }).vehicleId) ||
          vehicleIdRef.current;
        if (resolvedDriver.role !== 'supervisor') {
          await notifyManualDriverChange(previousDriver, resolvedDriver, vIdForDriver ?? null);
        }
        const deviceBrightness = await deviceService.getBrightness();

        // Call MDT status update after login (proactively)
        if (resolvedDriver?.role !== 'supervisor') {
          const vId = vehicleUpdates ? (vehicleUpdates as any).vehicleId : initialState.vehicleId;
          if (vId) {
            setState(s => ({ ...s, isSyncingVehicle: true }));
            reportMdtStatusAfterLogin({
              agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
              vehicleID: String(vId),
              driverID: String(coerceDriverIdForApi(getMdtDriverIdFromSelectedDriver(resolvedDriver))),
              screenBrightness: deviceBrightness / 100,
            }).then(async (resp) => {
              if (resp && resp.vehicleID) {
                const vName = await resolveVehicleName(String(resp.vehicleID));
                setVehicleId(String(resp.vehicleID));
                setVehicleName(vName);
              }
            }).catch((e: Error) => {
              console.error('[AuthContext] Failed to report MDT status after login:', e);
            }).finally(() => {
              setState(s => ({ ...s, isSyncingVehicle: false }));
            });
          }
        }

        setState((s) => ({
          ...s,
          // Preserve existing vehicle/route if present, otherwise use defaults
          vehicleId: s.vehicleId || initialState.vehicleId,
          vehicleName: s.vehicleName || initialState.vehicleName,
          serviceStatus: s.serviceStatus || initialState.serviceStatus,
          selectedRoute: s.selectedRoute || initialState.selectedRoute,
          selectedRouteId: s.selectedRouteId || initialState.selectedRouteId,
          ...(vehicleUpdates || {}),
        }));
      } catch (e) {
        console.error('[AuthContext] Background vehicle/MDT update failed:', e);
      }
    })();

    return true;
  }, []);

  const logout = useCallback(async () => {
    try {
      // Preserve passengerCount & apcCount across logout so APC data isn't lost
      setState(prev => ({
        ...initialState,
        vehicleId: prev.vehicleId,
        vehicleName: prev.vehicleName,
        passengerCount: prev.passengerCount,
        apcCount: prev.apcCount,
      }));
      // Persist the updated state (with preserved counts and vehicle) back to storage
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        ...initialState,
        vehicleId: state.vehicleId,
        vehicleName: state.vehicleName,
        passengerCount: state.passengerCount,
        apcCount: state.apcCount,
      }));
    } catch (e) {
      console.log('Logout error:', e);
    }
  }, [state.passengerCount, state.apcCount, state.vehicleId, state.vehicleName]);
  const selectDriver = useCallback(async (driver: Driver) => {
    if (driver.role === 'unassigned') {
      userRequestedServerUnassignRef.current = true;
      await login(driver);
      return;
    }
    const previousDriver = driverRef.current;
    let mapped: Driver = driver;
    try {
      const data = await getDriverData();
      const driverList = data?.driver;
      const list = Array.isArray(driverList) ? driverList : [];
      const match = list.find((d) => String(d.driverID) === String(driver.id));

      if (match) {
        mapped = {
          id: match.driverID,
          name: match.driverName ?? driver.name,
          role: (match.supervisor === 1 || match.supervisor === '1') ? 'supervisor' : 'driver',
          requiresPin: !!match.code,
          pin: match.code ?? driver.pin,
        };
      }
    } catch (e) {
      console.warn('[AuthContext] Driver data fetch failed in selectDriver:', e);
    }

    driverOverrideRef.current = true;
    driverRef.current = mapped;
    syncTelemetryDriverIdFromLocal(mapped);
    // UPDATE DRIVER IMMEDIATELY
    setState((s) => ({
      ...s,
      driver: mapped,
      isSupervisorMode: mapped.role === 'supervisor',
      hasShownSupervisorModal: false,
    }));
    if (mapped.role !== 'unassigned') {
      manualUnassignActiveRef.current = false;
    }

    // Fetch vehicles for the selected driver and pick the last one in background
    (async () => {
      try {
        const vehicleUpdates = await fetchAndSetVehicle(mapped.id);
        const vId =
          (vehicleUpdates && (vehicleUpdates as { vehicleId?: string }).vehicleId) ||
          vehicleIdRef.current;
        if (mapped.role !== 'supervisor') {
          await notifyManualDriverChange(previousDriver, mapped, vId ?? null);
        }
        setState((s) => ({
          ...s,
          // Reset to defaults first
          vehicleId: initialState.vehicleId,
          vehicleName: initialState.vehicleName,
          serviceStatus: initialState.serviceStatus,
          selectedRoute: initialState.selectedRoute,
          selectedRouteId: initialState.selectedRouteId,
          ...(vehicleUpdates || {}),
        }));
      } catch (e) {
        console.error('[AuthContext] Background vehicle fetch failed in selectDriver:', e);
      }
    })();
  }, []);

  const setVehicleId = useCallback((
    vehicleId: string | null,
    options?: { fromTablet?: boolean },
  ) => {
    vehicleIdRef.current = vehicleId;
    if (options?.fromTablet && vehicleId && vehicleId !== '110') {
      const ts = Math.floor(Date.now() / 1000);
      vehicleAssignmentUpdatedRef.current = ts;
      AsyncStorage.setItem(VEHICLE_ASSIGNMENT_UPDATED_KEY, String(ts)).catch(() => {});
    }
    setState((s) => ({ ...s, vehicleId }));
    if (vehicleId && vehicleId !== '110') {
      syncAssignmentNow();
    }
  }, [syncAssignmentNow]);

  const setVehicleName = useCallback((vehicleName: string | null) => {
    setState((s) => ({ ...s, vehicleName }));
  }, []);

  const setServiceStatus = useCallback((serviceStatus: 'in_service' | 'out_of_service') => {
    setState((s) => ({ ...s, serviceStatus }));
  }, []);

  const markDriverManualSelection = useCallback(() => {
    driverOverrideRef.current = true;
  }, []);

  const markRouteManualSelection = useCallback(() => {
    routeOverrideRef.current = true;
    routeOverrideRefForTelemetry.current = true;
    routeLastSelectedRef.current = Date.now() / 1000;
  }, []);

  const applyRouteFromServer = useCallback((
    label: string,
    routeId: string | null,
    manifestId: number | null,
    serviceStatus: 'in_service' | 'out_of_service',
  ) => {
    setState((s) => {
      if (
        s.selectedRoute === label &&
        s.selectedRouteId === routeId &&
        s.selectedManifestId === manifestId &&
        s.serviceStatus === serviceStatus
      ) {
        return s;
      }
      return {
        ...s,
        selectedRoute: label,
        selectedRouteId: routeId,
        selectedManifestId: manifestId,
        serviceStatus,
      };
    });
  }, []);

  const setDriverFromSync = useCallback((driver: Driver) => {
    driverRef.current = driver;
    if (manualUnassignActiveRef.current && driver.role !== 'unassigned') {
      manualUnassignActiveRef.current = false;
      manualUnassignBlockedDriverIdRef.current = null;
    }
    if (driver.role !== 'unassigned') {
      setAssignmentTabDriver(null);
    }
    setState((s) => ({
      ...s,
      driver,
      isSupervisorMode: driver.role === 'supervisor',
    }));
  }, []);

  const acceptDashboardAssignment = useCallback(() => {
    const assigned = driverForTab.role !== 'unassigned' ? driverForTab : null;
    if (!assigned) return;
    driverOverrideRef.current = false;
    manualUnassignActiveRef.current = false;
    manualUnassignBlockedDriverIdRef.current = null;
    setDriverFromSync(assigned);
    syncAssignmentNow();
  }, [driverForTab, setDriverFromSync, syncAssignmentNow]);

  useEffect(() => {
    return subscribeAgencyDriversUpdated(() => {
      const assignedId = parseAssignmentDriverId(assignmentRef.current?.driverID);
      if (!assignedId || driverOverrideRef.current) return;

      const fromRoster = findDriverById(assignedId);
      if (!fromRoster) return;

      const current = driverRef.current;
      if (
        current &&
        current.role !== 'unassigned' &&
        String(current.id).trim() === assignedId
      ) {
        if (current.name !== fromRoster.name) {
          setDriverFromSync(fromRoster);
        }
        return;
      }

      if (!current || current.role === 'unassigned') {
        setAssignmentTabDriver(fromRoster);
        if (assignmentRef.current && !manualUnassignActiveRef.current) {
          syncAssignmentNow();
        }
      }
    });
  }, [syncAssignmentNow, setDriverFromSync]);

  useEffect(() => {
    AsyncStorage.getItem(VEHICLE_ASSIGNMENT_UPDATED_KEY).then((stored) => {
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!Number.isNaN(parsed)) {
          vehicleAssignmentUpdatedRef.current = parsed;
        }
      }
    }).catch(() => {});
  }, []);

  useAssignmentSync({
    peakApiEnabled: apiEnabled,
    vehicleId: state.vehicleId,
    isSupervisorMode: state.isSupervisorMode,
    driver: state.driver,
    setDriver: setDriverFromSync,
    applyRouteFromServer,
    driverOverrideRef,
    routeOverrideRef,
    routeLastSelectedRef,
    assignmentRef,
    manualUnassignActiveRef,
    manualUnassignBlockedDriverIdRef,
    assignmentBootstrapDone: isAssignmentBootstrapDone,
    adoptDriverFromAssignment,
    registerAssignmentSync,
    registerAdoptGraceClear,
    onAssignmentApiResponse: applyAssignmentApiTelemetry,
    lastServerAssignmentAtRef,
    selectedManifestIdRef,
    selectedManifestId: state.selectedManifestId,
  });

  const selectRouteOrStatus = useCallback((
    value: string,
    routeId?: string | null,
    manifestId?: number | null,
    options?: { manual?: boolean },
  ) => {
    if (options?.manual) {
      routeOverrideRef.current = true;
      routeOverrideRefForTelemetry.current = true;
      routeLastSelectedRef.current = Date.now() / 1000;
    }
    const isOutOfService = value === 'Out of Service';
    if (isOutOfService && options?.manual) {
      lastAssignmentRouteIdRef.current = null;
      lastAssignmentCurrentRouteIdRef.current = null;
    }
    const resolvedRouteId =
      isOutOfService || isAssignedRouteId(routeId) ? (routeId ?? null) : null;
    setState((s) => ({
      ...s,
      selectedRoute: value,
      selectedRouteId: isOutOfService ? null : resolvedRouteId,
      selectedManifestId: isOutOfService ? null : (manifestId ?? null),
      serviceStatus: isOutOfService ? 'out_of_service' : 'in_service',
      ...(isOutOfService ? {
        // passengerCount intentionally preserved
      } : {}),
    }));
  }, []);

  // Resolve route/block display name when we have IDs but the tab label is missing.
  useEffect(() => {
    if (!needsRouteLabelResolution(state)) return;

    let cancelled = false;
    resolveStoredRouteLabel(state).then((label) => {
      if (!cancelled && label) {
        setState((s) => (s.selectedRoute === label ? s : { ...s, selectedRoute: label }));
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [state.selectedRoute, state.selectedRouteId, state.selectedManifestId, state.serviceStatus]);

  // Block assignments may persist with manifestId but no routeId — resolve for OTP / vehicle updates.
  useEffect(() => {
    const manifestId = state.selectedManifestId;
    const routeId = state.selectedRouteId;
    if (!manifestId || isAssignedRouteId(routeId)) return;

    let cancelled = false;
    (async () => {
      try {
        const manifests = await getManifestsForToday();
        if (cancelled) return;
        const match = manifests.find((m) => m.manifestID === manifestId);
        const resolved = getPrimaryRouteIdFromManifestJson(match?.manifestJson);
        if (!resolved || resolved === routeId) return;
        setState((s) => ({
          ...s,
          selectedRouteId: resolved,
          selectedRoute:
            s.selectedRoute && s.selectedRoute !== 'Out of Service'
              ? s.selectedRoute
              : (match?.name || s.selectedRoute),
        }));
      } catch (e) {
        console.warn('[AuthContext] Failed to resolve block route ID:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.selectedManifestId, state.selectedRouteId]);

  const setSelectedManifestId = useCallback((selectedManifestId: number | null) => {
    setState((s) => ({ ...s, selectedManifestId }));
  }, []);

  const setPassengerCount = useCallback((countOrUpdater: number | ((prev: number) => number)) => {
    setState((s) => ({
      ...s,
      passengerCount: typeof countOrUpdater === 'function' ? countOrUpdater(s.passengerCount) : countOrUpdater,
    }));
  }, []);

  const syncVehicleAssignment = useCallback(async () => {
    if (manualUnassignActiveRef.current) return;
    const vId = state.vehicleId;
    if (!vId || vId === '110') return;

    setState(s => ({ ...s, isSyncingVehicle: true }));
    try {
      try {
        const assignmentResp = await getAssignment(vId, agencyID);
        applyAssignmentApiTelemetry(assignmentResp);
      } catch {
        // use cached assignment telemetry driverID
      }
      const deviceBrightness = await deviceService.getBrightness();
      const resp = await reportMdtStatusAfterLogin({
        agencyID: String(PEAK_DEFAULT_PARAMS.agencyID),
        vehicleID: vId,
        driverID: String(getMdtDriverId()),
        screenBrightness: deviceBrightness / 100,
      });

      if (resp && resp.vehicleID) {
        const vName = await resolveVehicleName(String(resp.vehicleID));
        setState(s => ({
          ...s,
          vehicleId: String(resp.vehicleID),
          vehicleName: vName,
          isSyncingVehicle: false
        }));
      } else {
        setState(s => ({ ...s, isSyncingVehicle: false }));
      }
    } catch (e) {
      console.error('[AuthContext] syncVehicleAssignment failed:', e);
      setState(s => ({ ...s, isSyncingVehicle: false }));
    }
  }, [state.vehicleId, getMdtDriverId, agencyID, applyAssignmentApiTelemetry, resolveVehicleName]);

  const runPostLoginAuthBootstrap = useCallback(async () => {
    const activeAgencyId = String(PEAK_DEFAULT_PARAMS.agencyID);
    if (!activeAgencyId) return;

    const vId = vehicleIdRef.current;
    if (vId && vId !== '110') {
      try {
        const assignmentResp = await getAssignment(vId, activeAgencyId);
        applyAssignmentApiTelemetry(assignmentResp);

        if (driverRef.current?.role === 'unassigned') {
          const resolved = await resolveVehicleAssignmentSources(vId, assignmentResp);
          if (resolved.assignedDriverId && resolved.assignment) {
            const adopted = await selectDriverFromAssignmentIos({
              vehicleId: vId,
              currentDriver: null,
              assignment: resolved.assignment,
            });
            if (adopted) {
              adoptDriverFromAssignment(adopted, resolved.assignment);
              setState((s) => ({ ...s, driver: adopted }));
            }
          }
        }
      } catch (e) {
        console.warn('[AuthContext] post-login assignment bootstrap failed:', e);
      }
    }

    if (driverRef.current?.role === 'supervisor') return;

    try {
      const deviceBrightness = await deviceService.getBrightness();
      const resp = await reportMdtStatusAfterLogin({
        agencyID: activeAgencyId,
        vehicleID: String(mdtVehicleIdForApi(vId) || 0),
        driverID: String(coerceDriverIdForApi(getMdtDriverId())),
        screenBrightness: deviceBrightness / 100,
      });

      if (resp?.vehicleID && String(resp.vehicleID) !== '0') {
        const vName = await resolveVehicleName(String(resp.vehicleID));
        setVehicleId(String(resp.vehicleID));
        setVehicleName(vName);
      }
    } catch (e) {
      console.warn('[AuthContext] post-login MDT status failed:', e);
    }
  }, [
    applyAssignmentApiTelemetry,
    adoptDriverFromAssignment,
    getMdtDriverId,
    resolveVehicleName,
    setVehicleId,
    setVehicleName,
  ]);

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
        markDriverManualSelection,
        markUserRequestedUnassign,
        markRouteManualSelection,
        isAssignmentBootstrapDone,
        getMdtDriverId,
        getMdtRouteId,
        getVehicleAssignmentUpdated,
        syncAssignmentNow,
        acceptDashboardAssignment,
        driverTabLabel,
        routeTabLabel,
        driverForTab,
        setPassengerCount,
        setSelectedManifestId,
        syncVehicleAssignment,
        runPostLoginAuthBootstrap,
        resolveVehicleName,
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
