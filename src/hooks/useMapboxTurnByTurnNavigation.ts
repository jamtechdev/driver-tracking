/**
 * In-app Mapbox turn-by-turn navigation via native Mapbox Navigation SDK.
 * Bottom-sheet stop names follow the puck along the map stop list (forward only).
 * Schedule nextStop can jump HUD forward, but never backward.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMapboxAccessTokenValid } from '@/config/mapbox.config';
import type { ScheduleStop } from '@/context/DriverModelContext';
import type { LastLocation } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';
import { calculateDistance } from '@/utils/helpers';
import {
  findNavigationStopIndex,
  HUD_APPROACHING_METERS,
  HUD_ARRIVAL_METERS,
  HUD_LEAVE_METERS,
  HUD_NEAR_STOP_METERS,
  mergeNavigationStopWithSchedule,
  refreshNavigationStopsFromSchedule,
  resolveForwardStopIndex,
  resolveNavigableStops,
  scheduleStopKey,
  scheduleStopsMatch,
} from '@/features/navigation/navigationStopUtils';
import type {
  NavigationCoordinate,
  NavigationStatus,
  NavigationStop,
  TurnByTurnNavigationState,
} from '@/features/navigation/types';
import {
  requestLocationPermission,
  requestPostNotificationsPermission,
} from '@/utils/permissions';

/** Library fires this when POST_NOTIFICATIONS is denied — not a fatal nav failure. */
function isNonFatalMapboxError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('notification permission') ||
    lower.includes('notifications permission')
  );
}

/** User-friendly message for Mapbox RouterFailure dumps. */
function formatMapboxNativeError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Mapbox navigation failed to start.';

  if (/routerfailure|error finding route/i.test(trimmed)) {
    // Only match Mapbox's real "too many coordinates" — do NOT match long URLs
    // that simply contain many lat/lng pairs (false positive before).
    if (/too many coordinates/i.test(trimmed)) {
      return 'Too many stops for one Mapbox request (max 25). Try again with a shorter trip.';
    }
    if (trimmed.length > 180) {
      return 'Mapbox could not calculate a driving route for these stops. Check stop coordinates or try again.';
    }
    return trimmed;
  }

  return trimmed.length > 220 ? `${trimmed.slice(0, 217)}…` : trimmed;
}
import {
  buildMapboxSessionRouteStops,
  buildFrozenMapboxNativeSession,
  type FrozenMapboxNativeSession,
} from '@/features/navigation/mapboxNativeRoute';

export interface NativeRouteProgress {
  distanceTraveled: number;
  durationRemaining: number;
  fractionTraveled: number;
  distanceRemaining: number;
}

export interface NativePuckLocation {
  latitude: number;
  longitude: number;
}

export interface UseMapboxTurnByTurnNavigationOptions {
  schedule: ScheduleStop[];
  allStops?: StopData[];
  /** Same stop list drawn on the map (route.routeStops) — fallback if schedule lacks coords. */
  mapRouteStops?: StopData[];
  /**
   * Ordered stops from stoptimes API (sequence ascending for assigned trip).
   * Preferred over mapRouteStops for turn-by-turn when present.
   */
  tripOrderedStops?: StopData[];
  /** Agency published polyline (`route.points`) for Map Matching exact-path guidance. */
  agencyRoutePoints?: NavigationCoordinate[];
  nextStop: ScheduleStop | null;
  lastLocation: LastLocation | null;
  locationError: string | null;
  onTripCompleted?: (routeId: string | null) => void;
  routeId?: string | null;
}

export interface UseMapboxTurnByTurnNavigationResult extends TurnByTurnNavigationState {
  canStart: boolean;
  startNavigation: () => Promise<void>;
  cancelNavigation: () => void;
  currentDestination: NavigationStop | null;
  upcomingStops: NavigationStop[];
  isNavigating: boolean;
  /** Frozen once at session start — native map never receives updated route props. */
  frozenNativeSession: FrozenMapboxNativeSession | null;
  /** True while native reports off the matched agency path (reroute disabled for training). */
  isOffRoute: boolean;
  handleNativeArrive: () => void;
  handleNativeRouteProgress: (progress: NativeRouteProgress) => void;
  handleNativeLocationChange: (location: NativePuckLocation) => void;
  handleNativeOffRoute: (offRoute: boolean) => void;
  handleNativeError: (message: string) => void;
  handleNativeCancel: () => void;
}

const INITIAL_STATE: TurnByTurnNavigationState = {
  status: 'idle',
  stops: [],
  currentStopIndex: 0,
  route: null,
  progress: null,
  errorMessage: null,
  isOffline: false,
};

function isActiveNavigationStatus(status: NavigationStatus): boolean {
  return (
    status === 'preparing' ||
    status === 'navigating' ||
    status === 'rerouting' ||
    status === 'arriving' ||
    status === 'completed' ||
    status === 'error'
  );
}

/** Survives MapScreen remounts (e.g. layout flips) so rotate does not dump the driver to Start Navigation. */
type PersistedNavigationSession = {
  state: TurnByTurnNavigationState;
  frozenNativeSession: FrozenMapboxNativeSession | null;
  lastSyncedNextStopKey: string | null;
};

let persistedNavigationSession: PersistedNavigationSession | null = null;

function clearPersistedNavigationSession(): void {
  persistedNavigationSession = null;
}

function persistActiveNavigationSession(session: PersistedNavigationSession): void {
  if (isActiveNavigationStatus(session.state.status)) {
    persistedNavigationSession = session;
  } else {
    clearPersistedNavigationSession();
  }
}

export function useMapboxTurnByTurnNavigation(
  options: UseMapboxTurnByTurnNavigationOptions,
): UseMapboxTurnByTurnNavigationResult {
  const {
    schedule,
    allStops = [],
    mapRouteStops = [],
    tripOrderedStops = [],
    agencyRoutePoints = [],
    nextStop,
    lastLocation,
    locationError,
    onTripCompleted,
    routeId,
  } = options;

  const [state, setState] = useState<TurnByTurnNavigationState>(
    () => persistedNavigationSession?.state ?? INITIAL_STATE,
  );
  const [frozenNativeSession, setFrozenNativeSession] = useState<FrozenMapboxNativeSession | null>(
    () => persistedNavigationSession?.frozenNativeSession ?? null,
  );
  const [isOffRoute, setIsOffRoute] = useState(false);
  const agencyRoutePointsRef = useRef(agencyRoutePoints);
  agencyRoutePointsRef.current = agencyRoutePoints;
  const lastLocationRef = useRef(lastLocation);
  lastLocationRef.current = lastLocation;
  const puckRef = useRef<NavigationCoordinate | null>(
    lastLocation
      ? { latitude: lastLocation.latitude, longitude: lastLocation.longitude }
      : null,
  );
  /** Full-trip route line — set once at start, reused on every per-leg rematch. */
  const overviewRouteRef = useRef<NavigationCoordinate[] | null>(null);
  const frozenNativeSessionRef = useRef(frozenNativeSession);
  frozenNativeSessionRef.current = frozenNativeSession;

  const stateRef = useRef(state);
  const advancingStopRef = useRef(false);
  const rematchingRef = useRef(false);
  const rematchGenerationRef = useRef(0);
  const rematchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRematchAtRef = useRef(0);
  const lastNativePuckAtRef = useRef(0);
  const ignoreArriveUntilRef = useRef(0);
  const approachedStopIndexRef = useRef<number | null>(null);
  const arrivedStopIndexRef = useRef<number | null>(null);
  const nativeDestIndexRef = useRef(
    persistedNavigationSession?.state.currentStopIndex ?? 0,
  );
  const lastSyncedNextStopKeyRef = useRef<string | null>(
    persistedNavigationSession?.lastSyncedNextStopKey ?? null,
  );
  const nativeProgressRef = useRef<NativeRouteProgress | null>(null);
  const onTripCompletedRef = useRef(onTripCompleted);
  const routeIdRef = useRef<string | null | undefined>(routeId);

  const scheduledStops = useMemo(
    () => resolveNavigableStops(schedule, allStops, nextStop, mapRouteStops, tripOrderedStops),
    [schedule, allStops, nextStop, mapRouteStops, tripOrderedStops],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    onTripCompletedRef.current = onTripCompleted;
  }, [onTripCompleted]);

  useEffect(() => {
    routeIdRef.current = routeId ?? null;
  }, [routeId]);

  useEffect(() => {
    persistActiveNavigationSession({
      state,
      frozenNativeSession,
      lastSyncedNextStopKey: lastSyncedNextStopKeyRef.current,
    });
  }, [state, frozenNativeSession]);

  const clearNativeSession = useCallback(() => {
    setFrozenNativeSession(null);
    nativeProgressRef.current = null;
    setIsOffRoute(false);
    overviewRouteRef.current = null;
  }, []);

  const completeTrip = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'completed') {
      return;
    }

    advancingStopRef.current = false;
    rematchingRef.current = false;
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
      rematchTimerRef.current = null;
    }
    lastSyncedNextStopKeyRef.current = null;
    setIsOffRoute(false);
    onTripCompletedRef.current?.(routeIdRef.current ?? null);

    // Keep the native session + overlay mounted until End navigation / close is tapped.
    const nextState: TurnByTurnNavigationState = {
      ...current,
      status: 'completed',
      progress: null,
      errorMessage: null,
      currentStopIndex: Math.max(0, current.stops.length - 1),
    };
    setState(nextState);
    stateRef.current = nextState;
  }, []);

  const resolvePuckCoordinate = useCallback((): NavigationCoordinate | null => {
    const puck = puckRef.current;
    if (puck && Number.isFinite(puck.latitude) && Number.isFinite(puck.longitude)) {
      return puck;
    }
    const location = lastLocationRef.current;
    if (
      location &&
      Number.isFinite(location.latitude) &&
      Number.isFinite(location.longitude)
    ) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    return null;
  }, []);

  const applyHudIndex = useCallback(
    (targetIndex: number): boolean => {
      const current = stateRef.current;
      if (
        current.status === 'completed' ||
        current.status === 'cancelled' ||
        current.status === 'idle'
      ) {
        return false;
      }
      if (targetIndex < 0) return false;
      if (targetIndex >= current.stops.length) {
        completeTrip();
        return true;
      }
      if (targetIndex <= current.currentStopIndex) return false;

      if (approachedStopIndexRef.current === current.currentStopIndex) {
        approachedStopIndexRef.current = null;
      }
      if (arrivedStopIndexRef.current === current.currentStopIndex) {
        arrivedStopIndexRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        currentStopIndex: targetIndex,
        progress: null,
        status: prev.status === 'arriving' ? 'navigating' : prev.status,
      }));
      stateRef.current = {
        ...stateRef.current,
        currentStopIndex: targetIndex,
        progress: null,
        status:
          stateRef.current.status === 'arriving'
            ? 'navigating'
            : stateRef.current.status,
      };
      return true;
    },
    [completeTrip],
  );

  const startNavigationSession = useCallback(
    (targetIndex: number, origin: NavigationCoordinate) => {
      const current = stateRef.current;
      if (targetIndex < 0 || targetIndex >= current.stops.length) {
        if (targetIndex >= current.stops.length) {
          completeTrip();
        }
        return;
      }

      if (
        targetIndex === nativeDestIndexRef.current &&
        frozenNativeSessionRef.current &&
        (current.status === 'navigating' || current.status === 'arriving')
      ) {
        applyHudIndex(targetIndex);
        return;
      }

      rematchGenerationRef.current += 1;
      const rematchGeneration = rematchGenerationRef.current;
      rematchingRef.current = true;

      const refreshedStops = refreshNavigationStopsFromSchedule(
        current.stops,
        schedule,
        allStops,
      );
      // Remaining schedule for HUD; native session matches only the next stop (per-leg).
      const routeStops = buildMapboxSessionRouteStops(refreshedStops, targetIndex);
      if (routeStops.length === 0) {
        rematchingRef.current = false;
        return;
      }

      const frozen = buildFrozenMapboxNativeSession(
        origin,
        routeStops,
        agencyRoutePointsRef.current,
        overviewRouteRef.current,
      );
      if (!frozen) {
        rematchingRef.current = false;
        // Soft-skip bad legs instead of killing the whole trip UI.
        if (current.status === 'navigating' && targetIndex + 1 < refreshedStops.length) {
          console.warn(
            '[MapboxNavigation] skipping stop with invalid spacing/coords; advancing.',
          );
          setState((prev) => ({
            ...prev,
            stops: refreshedStops,
            currentStopIndex: targetIndex + 1,
            progress: null,
          }));
          stateRef.current = {
            ...stateRef.current,
            stops: refreshedStops,
            currentStopIndex: targetIndex + 1,
            progress: null,
          };
          return;
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage:
            'Unable to build navigation route. Check stop coordinates and ensure stops are spaced apart.',
        }));
        stateRef.current = {
          ...stateRef.current,
          status: 'error',
          errorMessage:
            'Unable to build navigation route. Check stop coordinates and ensure stops are spaced apart.',
        };
        return;
      }

      // Freeze the MapScreen agency polyline once (full path, not per-leg stub).
      if (!overviewRouteRef.current) {
        const agency = agencyRoutePointsRef.current.filter(
          (p) =>
            Number.isFinite(p.latitude) &&
            Number.isFinite(p.longitude) &&
            Math.abs(p.latitude) <= 90 &&
            Math.abs(p.longitude) <= 180,
        );
        if (agency.length >= 2) {
          overviewRouteRef.current = agency.map((p) => ({ ...p }));
        } else if (frozen.overviewRouteCoordinates?.length) {
          overviewRouteRef.current = frozen.overviewRouteCoordinates;
        }
      }

      const nextState = {
        ...current,
        stops: refreshedStops,
        currentStopIndex: targetIndex,
        status: 'navigating' as NavigationStatus,
        route: null,
        progress: null,
        errorMessage: null,
      };

      setIsOffRoute(false);
      nativeDestIndexRef.current = targetIndex;
      lastRematchAtRef.current = Date.now();
      // Keep the same native Mapbox view mounted — only swap the matched leg route.
      // Overview line stays the same reference across legs.
      setFrozenNativeSession({
        ...frozen,
        overviewRouteCoordinates:
          overviewRouteRef.current ?? frozen.overviewRouteCoordinates,
      });
      setState(nextState);
      stateRef.current = nextState;

      setTimeout(() => {
        if (rematchGenerationRef.current === rematchGeneration) {
          rematchingRef.current = false;
        }
      }, 4000);
    },
    [allStops, applyHudIndex, completeTrip, schedule],
  );

  const rematchNativeToHud = useCallback(
    (targetIndex?: number) => {
      const current = stateRef.current;
      if (current.status !== 'navigating' && current.status !== 'arriving') {
        return;
      }
      const index = targetIndex ?? current.currentStopIndex;
      if (index < 0 || index >= current.stops.length) return;
      if (index === nativeDestIndexRef.current && frozenNativeSessionRef.current) {
        return;
      }
      const origin = resolvePuckCoordinate();
      if (!origin) return;
      startNavigationSession(index, origin);
    },
    [resolvePuckCoordinate, startNavigationSession],
  );

  const scheduleNativeRematchToHud = useCallback(() => {
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
    }
    rematchTimerRef.current = setTimeout(() => {
      rematchTimerRef.current = null;
      rematchNativeToHud();
    }, 700);
  }, [rematchNativeToHud]);

  const noteProximityToCurrentStop = useCallback(
    (coordinate: NavigationCoordinate, stopIndex: number, stop: NavigationStop) => {
      const distance = calculateDistance(
        coordinate.latitude,
        coordinate.longitude,
        stop.latitude,
        stop.longitude,
      );
      // Soft approach at near-gate so curb-offset pins still count as visited for
      // leave→advance even when the tighter HUD "Approaching" paint is flaky.
      if (distance <= HUD_NEAR_STOP_METERS) {
        approachedStopIndexRef.current = stopIndex;
      }
      if (distance <= HUD_APPROACHING_METERS) {
        approachedStopIndexRef.current = stopIndex;
      }
      if (distance <= HUD_ARRIVAL_METERS) {
        arrivedStopIndexRef.current = stopIndex;
        approachedStopIndexRef.current = stopIndex;
      }
      return distance;
    },
    [],
  );

  const advanceHudFromPuck = useCallback(
    (coordinate: NavigationCoordinate | null | undefined, rematch: boolean) => {
      const current = stateRef.current;
      if (
        current.status !== 'navigating' &&
        current.status !== 'arriving' &&
        current.status !== 'rerouting'
      ) {
        return;
      }
      if (!coordinate) return;
      if (Date.now() < ignoreArriveUntilRef.current) return;

      const stopIndex = current.currentStopIndex;
      const stop = current.stops[stopIndex];
      if (stop) {
        noteProximityToCurrentStop(coordinate, stopIndex, stop);
      }

      // When puck leaves the current stop toward the next, bottom HUD → index+1.
      const nextIndex = Math.min(
        resolveForwardStopIndex(coordinate, current.stops, stopIndex, {
          hasApproached: approachedStopIndexRef.current === stopIndex,
          hasArrived: arrivedStopIndexRef.current === stopIndex,
        }),
        stopIndex + 1,
      );
      if (nextIndex > stopIndex) {
        applyHudIndex(nextIndex);
        if (rematch) {
          scheduleNativeRematchToHud();
        }
      }
    },
    [applyHudIndex, noteProximityToCurrentStop, scheduleNativeRematchToHud],
  );

  const handleNativeArrive = useCallback(() => {
    setIsOffRoute(false);
    const current = stateRef.current;
    if (nativeDestIndexRef.current !== current.currentStopIndex) {
      return;
    }
    if (Date.now() < ignoreArriveUntilRef.current) {
      return;
    }
    arrivedStopIndexRef.current = current.currentStopIndex;
    approachedStopIndexRef.current = current.currentStopIndex;
    const puck = resolvePuckCoordinate();
    const dest = current.stops[current.currentStopIndex];
    if (puck && dest) {
      const distance = calculateDistance(
        puck.latitude,
        puck.longitude,
        dest.latitude,
        dest.longitude,
      );
      // Mapbox already arrived at this dest — if the puck has left (or is far), advance now.
      if (distance >= HUD_LEAVE_METERS) {
        applyHudIndex(current.currentStopIndex + 1);
        scheduleNativeRematchToHud();
        return;
      }
    }
    advanceHudFromPuck(puck, true);
  }, [advanceHudFromPuck, applyHudIndex, resolvePuckCoordinate, scheduleNativeRematchToHud]);

  const handleNativeRouteProgress = useCallback(
    (nativeProgress: NativeRouteProgress) => {
      const current = stateRef.current;
      if (current.status !== 'navigating' && current.status !== 'arriving') return;
      nativeProgressRef.current = nativeProgress;
      if (nativeDestIndexRef.current !== current.currentStopIndex) return;
      if (Date.now() < ignoreArriveUntilRef.current) return;
      const remaining = nativeProgress.distanceRemaining;
      const fraction = nativeProgress.fractionTraveled;
      if (
        Number.isFinite(remaining) &&
        remaining <= HUD_ARRIVAL_METERS + 15 &&
        (!Number.isFinite(fraction) || fraction >= 0.7)
      ) {
        const puck = resolvePuckCoordinate();
        const dest = current.stops[current.currentStopIndex];
        if (puck && dest) {
          const distance = calculateDistance(
            puck.latitude,
            puck.longitude,
            dest.latitude,
            dest.longitude,
          );
          if (distance > HUD_APPROACHING_METERS) return;
        }
        arrivedStopIndexRef.current = current.currentStopIndex;
        approachedStopIndexRef.current = current.currentStopIndex;
        advanceHudFromPuck(puck, true);
      }
    },
    [advanceHudFromPuck, resolvePuckCoordinate],
  );

  const handleNativeLocationChange = useCallback(
    (location: NativePuckLocation) => {
      if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
        return;
      }
      const puck = { latitude: location.latitude, longitude: location.longitude };
      puckRef.current = puck;
      lastNativePuckAtRef.current = Date.now();
      advanceHudFromPuck(puck, true);
    },
    [advanceHudFromPuck],
  );

  const handleNativeOffRoute = useCallback((offRoute: boolean) => {
    const current = stateRef.current;
    if (
      current.status !== 'navigating' &&
      current.status !== 'arriving' &&
      current.status !== 'rerouting'
    ) {
      return;
    }
    setIsOffRoute(offRoute);
  }, []);

  const handleNativeError = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (isNonFatalMapboxError(trimmed)) {
      console.warn('[MapboxNavigation] non-fatal:', trimmed);
      return;
    }
    if (rematchingRef.current || Date.now() - lastRematchAtRef.current < 4000) {
      console.warn('[MapboxNavigation] ignored rematch error:', trimmed);
      return;
    }
    setState((prev) => ({
      ...prev,
      status: 'error',
      errorMessage: formatMapboxNativeError(trimmed),
    }));
  }, []);

  const handleNativeCancel = useCallback(() => {
    if (rematchingRef.current) return;
    if (Date.now() - lastRematchAtRef.current < 4000) return;

    const current = stateRef.current;
    if (
      current.status === 'completed' ||
      current.status === 'idle' ||
      current.status === 'cancelled'
    ) {
      return;
    }

    const puck = resolvePuckCoordinate();
    const currentIndex = current.currentStopIndex;
    const dest = current.stops[currentIndex];
    if (puck && dest) {
      noteProximityToCurrentStop(puck, currentIndex, dest);
    }
    const forwardIndex = Math.min(
      resolveForwardStopIndex(puck, current.stops, currentIndex, {
        hasApproached: approachedStopIndexRef.current === currentIndex,
        hasArrived: arrivedStopIndexRef.current === currentIndex,
      }),
      currentIndex + 1,
    );
    if (forwardIndex > current.currentStopIndex) {
      applyHudIndex(forwardIndex);
      rematchNativeToHud(forwardIndex);
      return;
    }

    if (current.currentStopIndex >= current.stops.length - 1) {
      completeTrip();
    }
  }, [applyHudIndex, completeTrip, noteProximityToCurrentStop, rematchNativeToHud, resolvePuckCoordinate]);

  // Keep stop names/coords in sync with live schedule (DriverModel enriched data).
  useEffect(() => {
    if (state.status === 'idle' || state.status === 'cancelled' || state.status === 'completed') {
      return;
    }
    if (state.stops.length === 0 || schedule.length === 0) return;

    const refreshed = refreshNavigationStopsFromSchedule(state.stops, schedule, allStops);
    const changed = refreshed.some(
      (stop, index) =>
        stop.longName !== state.stops[index]?.longName ||
        stop.latitude !== state.stops[index]?.latitude ||
        stop.longitude !== state.stops[index]?.longitude,
    );

    if (!changed) return;

    setState((prev) => ({
      ...prev,
      stops: refreshed,
    }));
    stateRef.current = {
      ...stateRef.current,
      stops: refreshed,
    };
  }, [schedule, allStops, state.status, state.stops]);

  // Follow DriverModel nextStop only when a live timetable exists, and only forward.
  useEffect(() => {
    if (state.status !== 'navigating' && state.status !== 'arriving') {
      return;
    }
    if (schedule.length === 0) return;
    if (!nextStop || state.stops.length === 0) return;

    const key = scheduleStopKey(nextStop);
    if (lastSyncedNextStopKeyRef.current === key) return;

    const current = stateRef.current;
    const targetIndex = findNavigationStopIndex(state.stops, nextStop, {
      fromIndex: current.currentStopIndex,
    });

    lastSyncedNextStopKeyRef.current = key;
    if (targetIndex === current.currentStopIndex + 1) {
      applyHudIndex(targetIndex);
      scheduleNativeRematchToHud();
    }
  }, [applyHudIndex, nextStop, schedule, scheduleNativeRematchToHud, state.status, state.stops]);

  // Tablet GPS fallback when native puck events are slow or missing.
  useEffect(() => {
    if (
      state.status !== 'navigating' &&
      state.status !== 'arriving' &&
      state.status !== 'rerouting'
    ) {
      return;
    }
    if (!lastLocation) return;
    if (Date.now() - lastNativePuckAtRef.current < 4000) return;
    const puck = { latitude: lastLocation.latitude, longitude: lastLocation.longitude };
    puckRef.current = puck;
    advanceHudFromPuck(puck, true);
  }, [advanceHudFromPuck, lastLocation, state.status]);

  const startNavigation = useCallback(async () => {
    if (!isMapboxAccessTokenValid()) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Mapbox access token is not configured.',
      }));
      return;
    }

    if (locationError) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: locationError,
      }));
      return;
    }

    const granted = await requestLocationPermission();
    if (!granted) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Location permission is required for navigation.',
      }));
      return;
    }

    // Request before mounting native view so Android 13+ devices don't get an
    // immediate onError that closes the navigation overlay.
    await requestPostNotificationsPermission();

    if (!lastLocation) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Waiting for GPS location. Try again once your position is available.',
      }));
      return;
    }

    const stops = resolveNavigableStops(schedule, allStops, nextStop, mapRouteStops, tripOrderedStops);
    if (stops.length === 0) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'No assigned stops with coordinates are available for navigation.',
      }));
      return;
    }

    const startIndex =
      schedule.length === 0 ? 0 : findNavigationStopIndex(stops, nextStop);
    const startDestination = stops[startIndex];

    const origin = { latitude: lastLocation.latitude, longitude: lastLocation.longitude };
    advancingStopRef.current = false;
    lastSyncedNextStopKeyRef.current = nextStop
      ? scheduleStopKey(nextStop)
      : scheduleStopKey(startDestination);
    nativeDestIndexRef.current = startIndex;
    approachedStopIndexRef.current = null;
    arrivedStopIndexRef.current = null;
    puckRef.current = origin;
    lastNativePuckAtRef.current = Date.now();
    ignoreArriveUntilRef.current = Date.now() + 3000;
    const nextState: TurnByTurnNavigationState = {
      status: 'preparing',
      stops,
      currentStopIndex: startIndex,
      route: null,
      progress: null,
      errorMessage: null,
      isOffline: false,
    };

    setState(nextState);
    stateRef.current = nextState;

    startNavigationSession(startIndex, origin);
  }, [
    lastLocation,
    locationError,
    schedule,
    allStops,
    mapRouteStops,
    tripOrderedStops,
    nextStop,
    startNavigationSession,
  ]);

  const cancelNavigation = useCallback(() => {
    advancingStopRef.current = false;
    rematchingRef.current = false;
    approachedStopIndexRef.current = null;
    arrivedStopIndexRef.current = null;
    if (rematchTimerRef.current) {
      clearTimeout(rematchTimerRef.current);
      rematchTimerRef.current = null;
    }
    lastSyncedNextStopKeyRef.current = null;
    clearPersistedNavigationSession();
    clearNativeSession();
    setState({
      ...INITIAL_STATE,
      status: 'cancelled',
    });
    stateRef.current = INITIAL_STATE;
    setTimeout(() => {
      setState(INITIAL_STATE);
    }, 0);
  }, [clearNativeSession]);

  const canStart =
    scheduledStops.length > 0 &&
    isMapboxAccessTokenValid() &&
    !!lastLocation &&
    !locationError &&
    (state.status === 'idle' ||
      state.status === 'error' ||
      state.status === 'cancelled' ||
      state.status === 'completed');

  const liveStops = useMemo(
    () => refreshNavigationStopsFromSchedule(state.stops, schedule, allStops),
    [state.stops, schedule, allStops],
  );

  const currentDestination = useMemo(() => {
    const stop = liveStops[state.currentStopIndex];
    if (!stop) return null;
    if (nextStop && scheduleStopsMatch(stop, nextStop)) {
      return mergeNavigationStopWithSchedule(stop, schedule, allStops);
    }
    return stop;
  }, [liveStops, state.currentStopIndex, nextStop, schedule, allStops]);

  const upcomingStops = useMemo(() => {
    return liveStops.slice(state.currentStopIndex);
  }, [liveStops, state.currentStopIndex]);

  // Keep overlay open on 'error' and 'completed' until the driver taps End / close.
  const isNavigating =
    state.status === 'preparing' ||
    state.status === 'navigating' ||
    state.status === 'rerouting' ||
    state.status === 'arriving' ||
    state.status === 'completed' ||
    state.status === 'error';

  return {
    ...state,
    stops: liveStops,
    canStart,
    startNavigation,
    cancelNavigation,
    currentDestination,
    upcomingStops,
    isNavigating,
    frozenNativeSession,
    isOffRoute,
    handleNativeArrive,
    handleNativeRouteProgress,
    handleNativeLocationChange,
    handleNativeOffRoute,
    handleNativeError,
    handleNativeCancel,
  };
}
