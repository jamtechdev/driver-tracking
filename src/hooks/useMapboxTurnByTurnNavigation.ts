/**
 * In-app Mapbox turn-by-turn navigation via native Mapbox Navigation SDK.
 * Stop progression follows DriverModel nextStop (same source as HomeScreen).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isMapboxAccessTokenValid } from '@/config/mapbox.config';
import type { ScheduleStop } from '@/context/DriverModelContext';
import type { LastLocation } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';
import {
  buildNavigationStopsFromSchedule,
  findNavigationStopIndex,
  mergeNavigationStopWithSchedule,
  refreshNavigationStopsFromSchedule,
  scheduleStopKey,
  scheduleStopsMatch,
} from '@/features/navigation/navigationStopUtils';
import type {
  NavigationCoordinate,
  NavigationStatus,
  NavigationStop,
  TurnByTurnNavigationState,
} from '@/features/navigation/types';
import { requestLocationPermission } from '@/utils/permissions';
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

export interface UseMapboxTurnByTurnNavigationOptions {
  schedule: ScheduleStop[];
  allStops?: StopData[];
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
  handleNativeArrive: () => void;
  handleNativeRouteProgress: (progress: NativeRouteProgress) => void;
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

export function useMapboxTurnByTurnNavigation(
  options: UseMapboxTurnByTurnNavigationOptions,
): UseMapboxTurnByTurnNavigationResult {
  const {
    schedule,
    allStops = [],
    nextStop,
    lastLocation,
    locationError,
    onTripCompleted,
    routeId,
  } = options;

  const [state, setState] = useState<TurnByTurnNavigationState>(INITIAL_STATE);
  const [frozenNativeSession, setFrozenNativeSession] = useState<FrozenMapboxNativeSession | null>(
    null,
  );

  const stateRef = useRef(state);
  const advancingStopRef = useRef(false);
  const lastSyncedNextStopKeyRef = useRef<string | null>(null);
  const nativeProgressRef = useRef<NativeRouteProgress | null>(null);
  const onTripCompletedRef = useRef(onTripCompleted);
  const routeIdRef = useRef<string | null | undefined>(routeId);

  const scheduledStops = useMemo(
    () => buildNavigationStopsFromSchedule(schedule, allStops),
    [schedule, allStops],
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

  const clearNativeSession = useCallback(() => {
    setFrozenNativeSession(null);
    nativeProgressRef.current = null;
  }, []);

  const completeTrip = useCallback(() => {
    advancingStopRef.current = false;
    lastSyncedNextStopKeyRef.current = null;
    clearNativeSession();
    onTripCompletedRef.current?.(routeIdRef.current ?? null);
    setState(INITIAL_STATE);
    stateRef.current = INITIAL_STATE;
  }, [clearNativeSession]);

  const startNavigationSession = useCallback(
    (targetIndex: number, origin: NavigationCoordinate) => {
      const current = stateRef.current;
      if (targetIndex < 0 || targetIndex >= current.stops.length) {
        if (targetIndex >= current.stops.length) {
          completeTrip();
        }
        return;
      }

      const refreshedStops = refreshNavigationStopsFromSchedule(
        current.stops,
        schedule,
        allStops,
      );
      const routeStops = buildMapboxSessionRouteStops(refreshedStops, targetIndex);
      if (routeStops.length === 0) return;

      const frozen = buildFrozenMapboxNativeSession(origin, routeStops);
      if (!frozen) {
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

      const nextState = {
        ...current,
        stops: refreshedStops,
        currentStopIndex: targetIndex,
        status: 'navigating' as NavigationStatus,
        route: null,
        progress: null,
        errorMessage: null,
      };

      setFrozenNativeSession(frozen);
      setState(nextState);
      stateRef.current = nextState;
    },
    [allStops, completeTrip, schedule],
  );

  const syncToStopIndex = useCallback(
    (targetIndex: number) => {
      if (advancingStopRef.current) return;

      const current = stateRef.current;
      if (targetIndex < 0 || targetIndex >= current.stops.length) {
        if (targetIndex >= current.stops.length) {
          completeTrip();
        }
        return;
      }

      if (targetIndex === current.currentStopIndex) return;

      // Native multi-stop route already includes upcoming legs — only update UI index.
      if (current.status === 'navigating' || current.status === 'arriving') {
        setState((prev) => ({
          ...prev,
          currentStopIndex: targetIndex,
          progress: null,
        }));
        stateRef.current = {
          ...stateRef.current,
          currentStopIndex: targetIndex,
          progress: null,
        };
      }
    },
    [completeTrip],
  );

  const advanceAfterArrival = useCallback(() => {
    const current = stateRef.current;
    const nextIndex = current.currentStopIndex + 1;
    if (nextIndex >= current.stops.length) {
      completeTrip();
      return;
    }

    setState((prev) => ({
      ...prev,
      currentStopIndex: nextIndex,
      progress: null,
    }));
    stateRef.current = {
      ...current,
      currentStopIndex: nextIndex,
      progress: null,
    };
  }, [completeTrip]);

  const handleNativeArrive = useCallback(() => {
    advanceAfterArrival();
  }, [advanceAfterArrival]);

  const handleNativeRouteProgress = useCallback((nativeProgress: NativeRouteProgress) => {
    const current = stateRef.current;
    if (current.status !== 'navigating') return;
    nativeProgressRef.current = nativeProgress;
  }, []);

  const handleNativeError = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      status: 'error',
      errorMessage: trimmed,
    }));
  }, []);

  const handleNativeCancel = useCallback(() => {
    lastSyncedNextStopKeyRef.current = null;
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

  // Follow DriverModel nextStop — same source as HomeScreen.
  useEffect(() => {
    if (state.status !== 'navigating' && state.status !== 'arriving') {
      return;
    }
    if (!nextStop || state.stops.length === 0) return;

    const key = scheduleStopKey(nextStop);
    if (lastSyncedNextStopKeyRef.current === key) return;

    const current = stateRef.current;
    const targetIndex = findNavigationStopIndex(state.stops, nextStop, {
      fromIndex: current.currentStopIndex,
    });

    if (targetIndex === current.currentStopIndex && scheduleStopsMatch(current.stops[targetIndex], nextStop)) {
      lastSyncedNextStopKeyRef.current = key;
      return;
    }

    if (targetIndex !== current.currentStopIndex) {
      lastSyncedNextStopKeyRef.current = key;
      syncToStopIndex(targetIndex);
    }
  }, [nextStop, state.status, state.stops, syncToStopIndex]);

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

    if (!lastLocation) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Waiting for GPS location. Try again once your position is available.',
      }));
      return;
    }

    const stops = buildNavigationStopsFromSchedule(schedule, allStops);
    if (stops.length === 0) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'No assigned stops with coordinates are available for navigation.',
      }));
      return;
    }

    const startIndex = findNavigationStopIndex(stops, nextStop);
    const startDestination = stops[startIndex];

    advancingStopRef.current = false;
    lastSyncedNextStopKeyRef.current = nextStop
      ? scheduleStopKey(nextStop)
      : scheduleStopKey(startDestination);

    const origin = { latitude: lastLocation.latitude, longitude: lastLocation.longitude };
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
  }, [lastLocation, locationError, schedule, allStops, nextStop, startNavigationSession]);

  const cancelNavigation = useCallback(() => {
    advancingStopRef.current = false;
    lastSyncedNextStopKeyRef.current = null;
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

  const isNavigating =
    state.status === 'preparing' ||
    state.status === 'navigating' ||
    state.status === 'rerouting' ||
    state.status === 'arriving';

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
    handleNativeArrive,
    handleNativeRouteProgress,
    handleNativeError,
    handleNativeCancel,
  };
}
