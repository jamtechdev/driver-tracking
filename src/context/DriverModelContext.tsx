/**
 * DriverModel Context – Map/location flow on the driver side
 * Owns GPS (lastLocation), decides when to send position to the server,
 * and calls MDT update (10s) and vehicle update (5s when tracking).
 * UI can use lastLocation for the map; DirectionModel/route logic can use it for adherence.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Platform, AppState, AppStateStatus, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { coerceDriverIdForApi, getOutboundDriverId } from '@/utils/outboundDriverId';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { locationService } from '@/services/location.service';
import {
  requestLocationPermission,
  requestBackgroundLocationPermission,
  hasBackgroundLocationPermission,
} from '@/utils/permissions';
import { deviceService } from '@/services/device.service';
import { mdtUpdate, vehicleUpdate, speedMpsToMph, type MdtUpdateParams, type VehicleUpdateParams } from '@/api/position.api';
import { APP_CONSTANTS } from '@/utils/constants';
import { useDriverData } from './DriverDataContext';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { getRouteSchedule } from '@/api/schedule.api';
import { parseVehicleUpdateMinsLate, shouldApplyMinsLateUpdate } from '@/utils/gaugeImage';
import { calculateDistance, isAssignedRouteId } from '@/utils/helpers';
import { useMapAssignment } from '@/hooks/useMapAssignment';
import { headingBetween } from '@/features/adherence/linkGeometry';
import {
  DirectionModel,
  directionItemToContextStop,
  MINS_LATE_UNKNOWN,
} from '@/features/adherence';
import {
  findGeofenceAtLocation,
  isSilentGeofence,
  isWarningGeofence,
  type GeofenceData,
} from '@/utils/geofence';
import { notificationService } from '@/services/notification.service';
import BackgroundService from 'react-native-background-actions';
import { backgroundTrackingService } from '@/services/background-tracking.service';
import { mdtVehicleIdForApi } from '@/utils/mdtId';

const HORIZ_ACCUR_UPPER_LIMIT = APP_CONSTANTS.LOCATION_ACCURACY_THRESHOLD ?? 50; // meters; above = "ACQUIRING SAT"
const TIME_BETWEEN_SERVER_CALLS = APP_CONSTANTS.LOCATION_UPDATE_INTERVAL ?? 5000; // 5 seconds
const MDT_INTERVAL_MS = 10000; // 10 seconds heartbeat
const VEHICLE_UPDATE_BACKOFF_MS = 60000; // 1 min backoff after 5xx to avoid flooding

export type TrackingMode = 'off' | 'auto' | 'on';

export interface LastLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  altitude?: number;
}

/** Fallback coords when GPS has not delivered a fix yet (native still sends MDT heartbeat). */
const MDT_FALLBACK_LOCATION: LastLocation = {
  latitude: 0,
  longitude: 0,
  accuracy: 999,
  timestamp: 0,
  speed: 0,
  heading: 0,
};

export interface ScheduleStop {
  blockID: number;
  calculatedArrivalTime: number;
  departureTime: number;
  link: number;
  unscheduled: number;
  longName: string;
  tripID: number;
  lat?: number;
  lng?: number;
  [key: string]: unknown;
}

/** Active geofence UI (non-silent warn levels only — iOS geofenceAlert). */
export interface GeofenceAlertState {
  geofenceID: string;
  name: string;
  isWarning: boolean;
}

/** Stop geofence the tablet is inside (any warn level, including silent stop geofences). */
export interface CurrentStopGeofence {
  geofenceID: string;
  name: string;
}

interface DriverModelContextType {
  /** Latest `alert` value from vehicle update response (0 = cleared, 1 = active, null = not yet received). */
  serverAlert: number | null;
  /** Current GPS position (for map and route adherence). Map updates from this; no separate "get position" API. */
  lastLocation: LastLocation | null;
  /** True when horizontal accuracy > 50m (not sent to server). */
  isAcquiringSat: boolean;
  /** off = no position sent; auto = send when vehicle selected & GPS good; on = send when GPS good. */
  trackingMode: TrackingMode;
  setTrackingMode: (mode: TrackingMode) => void;
  /** Last time we successfully sent vehicle position (for UI/throttle). */
  lastVehicleSendTime: number | null;
  /** Location/GPS error message if any. */
  locationError: string | null;
  /** Battery level 0–100 for API. */
  batteryLevel: number;
  /** Battery state (e.g. 2 = charging). */
  batteryState: number;
  /** Optional: called after vehicle position was successfully sent (locationXmit equivalent). */
  setOnLocationXmit: (cb: ((location: LastLocation) => void) | null) => void;
  /** Minutes late from the server response. */
  minsLate: number | null;
  /** Current route schedule. */
  schedule: ScheduleStop[];
  /** The calculated next stop. */
  nextStop: ScheduleStop | null;
  /** Average time in seconds between route links/points. */
  linkAverages: number[];
  /** Non-silent geofence alert (warn 0 or 1). Null when outside geofence. */
  geofenceAlert: GeofenceAlertState | null;
  /** Geofence at current GPS fix (silent + non-silent). Drives stop name when inside. */
  currentStopGeofence: CurrentStopGeofence | null;
  /** iOS: nextStop label hidden while geofence alert is showing. */
  hideNextStopForGeofence: boolean;
}

const DriverModelContext = createContext<DriverModelContextType | null>(null);

const MDT_ID_KEY = '@driver_tracking:mdt_id';
const TRACKING_MODE_KEY = '@driver_tracking:tracking_mode';

export const DriverModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    vehicleId,
    driver,
    selectedRouteId,
    selectedManifestId,
    setVehicleId,
    setVehicleName,
    setPassengerCount,
    resolveVehicleName,
    getMdtDriverId,
    getMdtRouteId,
    getVehicleAssignmentUpdated,
    isAssignmentBootstrapDone,
  } = useAuth();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);
  const outboundDriverId = getOutboundDriverId(driver);
  const { routes, stops, geofences } = useDriverData();
  const { effectiveRouteId: mapEffectiveRouteId } = useMapAssignment();
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isAcquiringSat, setIsAcquiringSat] = useState(false);
  const [trackingMode, setTrackingModeState] = useState<TrackingMode>('auto');
  const [lastVehicleSendTime, setLastVehicleSendTime] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryState, setBatteryState] = useState(2); // 2 = charging
  const [mdtUuid, setMdtUuid] = useState<string>('');
  const [minsLate, setMinsLate] = useState<number | null>(null);
  const [serverAlert, setServerAlert] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<ScheduleStop[]>([]);
  const [nextStop, setNextStop] = useState<ScheduleStop | null>(null);
  const [linkAverages, setLinkAverages] = useState<number[]>([]);
  const [geofenceAlert, setGeofenceAlert] = useState<GeofenceAlertState | null>(null);
  const [currentStopGeofence, setCurrentStopGeofence] = useState<CurrentStopGeofence | null>(null);

  const directionModelRef = useRef(new DirectionModel());
  const localMinsLateRef = useRef<number>(MINS_LATE_UNKNOWN);
  const triggeredGeofenceIdRef = useRef<string | null>(null);
  const currentStopGeofenceRef = useRef<CurrentStopGeofence | null>(null);
  const scheduleRefetchInFlightRef = useRef(false);
  const loadRouteScheduleRef = useRef<((routeId: string) => Promise<void>) | null>(null);
  const geofencesRef = useRef<GeofenceData[]>([]);
  const previousLocationRef = useRef<LastLocation | null>(null);
  const isAcquiringSatRef = useRef(false);
  const atLinkRef = useRef<number>(-1);
  const magnetometerHeadingRef = useRef<number>(0);

  /** Route for schedule/shape — includes block manifest primary route (same as map). */
  const effectiveRouteId = mapEffectiveRouteId;

  const lastLocationRef = useRef<LastLocation | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const mdtIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMdtSendRef = useRef<number>(0);
  const lastVehicleSendRef = useRef<number>(0);
  const onLocationXmitRef = useRef<((location: LastLocation) => void) | null>(null);
  const trySendVehicleUpdateRef = useRef<((position?: LastLocation | null) => Promise<void>) | null>(null);
  const hasSentFirstMdtRef = useRef(false);
  // Track app foreground/background state so vehicle updates fire in both modes
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const notificationInitializedRef = useRef(false);
  // Refs to hold latest values for background GPS callback (avoids stale closure)
  const vehicleIdRef = useRef(vehicleId);
  const driverIdRef = useRef(String(outboundDriverId));
  const telemetryDriverIdRef = useRef(String(outboundDriverId));
  const selectedRouteIdRef = useRef(selectedRouteId);
  const selectedManifestIdRef = useRef(selectedManifestId);
  const minsLateRef = useRef(minsLate);
  const assignmentKeyRef = useRef('');
  const scheduleRef = useRef<ScheduleStop[]>([]);
  const nextStopRef = useRef<ScheduleStop | null>(null);
  const batteryLevelRef = useRef(batteryLevel);
  const batteryStateRef = useRef(batteryState);
  const trackingModeRef = useRef(trackingMode);
  /** Foreground GPS watch; paused while native background task owns the watch. */
  const [foregroundGpsActive, setForegroundGpsActive] = useState(true);

  const trySendMdtUpdate = useCallback(async (loc: LastLocation) => {
    if (driver?.role === 'supervisor') {
      return;
    }
    if (!isAssignmentBootstrapDone) {
      return;
    }

    const effectiveVehicleId = mdtVehicleIdForApi(vehicleId);
    const driverID = coerceDriverIdForApi(getMdtDriverId());
    const driverIdStr = String(driverID);
    telemetryDriverIdRef.current = driverIdStr;
    driverIdRef.current = driverIdStr;

    try {
      const brightness = await deviceService.getBrightness();
      const netState = await NetInfo.fetch();
      const powerState = await DeviceInfo.getPowerState();
      const deviceName = await DeviceInfo.getDeviceName();
      const deviceSerial = DeviceInfo.getUniqueIdSync();

      const params: MdtUpdateParams = {
        agencyID,
        vehicleID: effectiveVehicleId,
        vehicleAssignmentUpdated: getVehicleAssignmentUpdated(),
        driverID,
        lat: loc.latitude,
        lng: loc.longitude,
        // course: loc.heading ?? 0,
        speed: Math.round(speedMpsToMph(loc.speed)), // mph
        horizontalAccuracy: loc.accuracy,
        verticalAccuracy: 0,
        osVersion: DeviceInfo.getSystemVersion(),
        thermalState: 0, // Fallback
        batteryLevel: Math.round((powerState.batteryLevel ?? 1) * 100),
        batteryState: powerState.batteryState === 'charging' ? 2 : 1,
        d: 1,
        screenBrightness: brightness,
        connectionType: netState.type,
        ssid: (netState.details as any)?.ssid || '',
        mdtUUID: mdtUuid,
        deviceSerial: deviceSerial,
        deviceName: deviceName,
        appVersion: DeviceInfo.getVersion(),
        updating: false,
        isLocationServiceOn: 1,
        locationAuthStatus: 'always',
      };

      console.log('[MDT Update] Data before sending:', params);
      const resp: any = await mdtUpdate(params);
      console.log('[MDT Update] Response:', resp);
      if (resp && resp.vehicleID && String(resp.vehicleID) !== '0') {
        const vId = String(resp.vehicleID);
        const vName = await resolveVehicleName(vId);
        setVehicleId(vId);
        setVehicleName(vName);
      }
      lastMdtSendRef.current = Date.now();
      hasSentFirstMdtRef.current = true;
    } catch (e: any) {
      console.warn('[DriverModel] MDT update failed', e?.response?.data || e);
    }
  }, [
    vehicleId,
    agencyID,
    mdtUuid,
    driver,
    isAssignmentBootstrapDone,
    getMdtDriverId,
    getVehicleAssignmentUpdated,
    resolveVehicleName,
    setVehicleId,
    setVehicleName,
  ]);

  const setTrackingMode = useCallback((mode: TrackingMode) => {
    setTrackingModeState(mode);
    AsyncStorage.setItem(TRACKING_MODE_KEY, mode).catch(() => { });
  }, []);

  // Keep refs in sync with latest state for background GPS callback
  useEffect(() => { vehicleIdRef.current = vehicleId; }, [vehicleId]);
  useEffect(() => { geofencesRef.current = geofences; }, [geofences]);
  useEffect(() => {
    const local = String(outboundDriverId);
    if (local !== '0') {
      telemetryDriverIdRef.current = local;
      driverIdRef.current = local;
    }
  }, [outboundDriverId]);

  useEffect(() => {
    if (!vehicleId || vehicleId === '110' || !isAssignmentBootstrapDone) return;
    const id = String(coerceDriverIdForApi(getMdtDriverId()));
    telemetryDriverIdRef.current = id;
    driverIdRef.current = id;
    if (backgroundTrackingService.isTracking()) {
      backgroundTrackingService.updateTrackingData({ driverID: id });
    }
  }, [vehicleId, driver, isAssignmentBootstrapDone, getMdtDriverId]);
  useEffect(() => { selectedRouteIdRef.current = selectedRouteId; }, [selectedRouteId]);
  useEffect(() => { selectedManifestIdRef.current = selectedManifestId; }, [selectedManifestId]);
  useEffect(() => { minsLateRef.current = minsLate; }, [minsLate]);
  useEffect(() => { batteryLevelRef.current = batteryLevel; }, [batteryLevel]);
  useEffect(() => { batteryStateRef.current = batteryState; }, [batteryState]);
  useEffect(() => { trackingModeRef.current = trackingMode; }, [trackingMode]);

  // Restore tracking mode from storage
  useEffect(() => {
    AsyncStorage.getItem(TRACKING_MODE_KEY).then((stored) => {
      if (stored === 'off' || stored === 'auto' || stored === 'on') {
        setTrackingModeState(stored);
      }
    }).catch(() => { });
  }, []);

  // MDT UUID (device id for API)
  useEffect(() => {
    (async () => {
      try {
        const storedId = await AsyncStorage.getItem(MDT_ID_KEY);
        if (storedId) {
          setMdtUuid(storedId);
        } else {
          const uniqueId = await DeviceInfo.getUniqueId();
          const cleanId = uniqueId.replace(/[^A-Z0-9]/gi, '').toUpperCase();
          // Format as BPT-XXXXXXXX-XXXX-XXXX-XXXX
          const formattedId = `BPT-${cleanId.slice(0, 8)}-${cleanId.slice(8, 12)}-${cleanId.slice(12, 16)}-${cleanId.slice(16, 20)}`;
          setMdtUuid(formattedId);
          await AsyncStorage.setItem(MDT_ID_KEY, formattedId);
        }
      } catch (error) {
        console.error('Error getting MDT ID in DriverModelContext:', error);
        // Fallback to random if device info fails
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const segment = (len: number) =>
          Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const fallbackId = `BPT-${segment(8)}-${segment(4)}-${segment(4)}-${segment(4)}`;
        setMdtUuid(fallbackId);
        await AsyncStorage.setItem(MDT_ID_KEY, fallbackId);
      }
    })();
  }, []);

  const enrichScheduleWithStopCoords = useCallback((list: ScheduleStop[]) => {
    return list.map((item) => {
      const match = stops.find(
        (s) =>
          s.longName === item.longName || String(s.stopID) === String(item.link),
      );
      if (match) {
        return { ...item, lat: match.lat, lng: match.lng };
      }
      return item;
    });
  }, [stops]);

  const getRoutePointsForId = useCallback(
    (routeId: string): string => {
      const route = routes.find((r) => String(r.routeID) === String(routeId));
      if (route?.points != null && typeof route.points === 'string') {
        return route.points;
      }
      return '';
    },
    [routes],
  );

  const syncRouteGraphFromPoints = useCallback(
    (points: string): number => {
      return directionModelRef.current.loadLinksFromPoints(points).length;
    },
    [],
  );

  const toContextStopFromDirection = useCallback(
    (item: ReturnType<typeof directionItemToContextStop> | null): ScheduleStop | null => {
      if (!item) return null;
      const base = item as ScheduleStop;
      const match = stops.find(
        (s) =>
          s.longName === base.longName || String(s.stopID) === String(base.link),
      );
      if (match) {
        return { ...base, lat: match.lat, lng: match.lng };
      }
      return base;
    },
    [stops],
  );

  const applyNextStopFromDirection = useCallback(
    (result: ReturnType<DirectionModel['updateFromLocation']>) => {
      localMinsLateRef.current = result.minsLate;
      atLinkRef.current = result.atLink;

      const ctxStop = toContextStopFromDirection(
        result.nextStop ? directionItemToContextStop(result.nextStop) : null,
      );

      const prev = nextStopRef.current;
      if (
        prev?.link === ctxStop?.link &&
        prev?.longName === ctxStop?.longName &&
        prev?.calculatedArrivalTime === ctxStop?.calculatedArrivalTime &&
        prev?.tripID === ctxStop?.tripID
      ) {
        return;
      }

      nextStopRef.current = ctxStop;
      setNextStop(ctxStop);
    },
    [toContextStopFromDirection],
  );

  const runDirectionUpdate = useCallback(
    (loc: LastLocation) => {
      const model = directionModelRef.current;
      if (model.links.length === 0 || model.routeSchedule.length === 0) {
        return;
      }

      const result = model.updateFromLocation(
        loc.latitude,
        loc.longitude,
        loc.heading ?? 0,
      );
      applyNextStopFromDirection(result);
    },
    [applyNextStopFromDirection],
  );

  // Load route shape when route or driver-data routes update — iOS loadLinksWithPoints
  useEffect(() => {
    if (!effectiveRouteId) {
      directionModelRef.current.clear();
      localMinsLateRef.current = MINS_LATE_UNKNOWN;
      return;
    }

    const points = getRoutePointsForId(effectiveRouteId);
    const linkCount = syncRouteGraphFromPoints(points);

    if (linkCount > 0 && directionModelRef.current.routeSchedule.length > 0) {
      const loc = lastLocationRef.current;
      if (loc) {
        runDirectionUpdate(loc);
      }
    }
  }, [effectiveRouteId, routes, getRoutePointsForId, syncRouteGraphFromPoints, runDirectionUpdate]);

  /** iOS routefordriver fetch + DirectionModel.setSchedule */
  const loadRouteSchedule = useCallback(
    async (routeId: string) => {
      try {
        const response = await getRouteSchedule(agencyID, routeId);
        const list = Array.isArray(response.schedule) ? response.schedule : [];
        const averages = Array.isArray(response.linkAverages) ? response.linkAverages : [];
        const totalRouteTime =
          typeof response.totalRouteTime === 'number' && response.totalRouteTime > 0
            ? response.totalRouteTime
            : 3600;

        setLinkAverages(averages);

        const enriched = enrichScheduleWithStopCoords(list);
        console.log('enriched======>>>>>>', enriched);
        setSchedule(enriched);
        scheduleRef.current = enriched;

        const points = getRoutePointsForId(routeId);
        syncRouteGraphFromPoints(points);

        directionModelRef.current.setSchedule(routeId, averages, totalRouteTime, enriched);

        const loc = lastLocationRef.current;
        if (loc) {
          runDirectionUpdate(loc);
        }
      } catch (e) {
        console.warn('[DriverModel] Failed to fetch schedule:', e);
        setSchedule([]);
        setNextStop(null);
        setLinkAverages([]);
        directionModelRef.current.clear();
      }
    },
    [
      agencyID,
      enrichScheduleWithStopCoords,
      getRoutePointsForId,
      syncRouteGraphFromPoints,
      runDirectionUpdate,
    ],
  );

  loadRouteScheduleRef.current = loadRouteSchedule;

  // Fetch schedule when route changes — iOS routefordriver + updateAdherence
  useEffect(() => {
    setSchedule([]);
    setNextStop(null);
    scheduleRef.current = [];
    nextStopRef.current = null;

    if (!effectiveRouteId) {
      directionModelRef.current.clear();
      return;
    }

    void loadRouteSchedule(effectiveRouteId);
  }, [effectiveRouteId, loadRouteSchedule]);

  // Reset OTP gauge and force vehicle update when route/block assignment changes.
  useEffect(() => {
    const key = `${vehicleId ?? ''}:${effectiveRouteId ?? ''}:${selectedManifestId ?? ''}`;
    if (assignmentKeyRef.current === key) return;
    assignmentKeyRef.current = key;

    setMinsLate(null);
    minsLateRef.current = null;
    localMinsLateRef.current = MINS_LATE_UNKNOWN;
    lastVehicleSendRef.current = 0;
    triggeredGeofenceIdRef.current = null;
    currentStopGeofenceRef.current = null;
    setGeofenceAlert(null);
    setCurrentStopGeofence(null);

    const loc = lastLocationRef.current;
    if (loc && vehicleId && vehicleId !== 'unassigned' && effectiveRouteId) {
      trySendVehicleUpdateRef.current?.(loc);
    }
  }, [vehicleId, effectiveRouteId, selectedManifestId]);

  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  useEffect(() => {
    nextStopRef.current = nextStop;
  }, [nextStop]);

  const clearStopGeofenceState = useCallback(() => {
    if (currentStopGeofenceRef.current != null) {
      currentStopGeofenceRef.current = null;
      setCurrentStopGeofence(null);
    }
    if (triggeredGeofenceIdRef.current != null) {
      triggeredGeofenceIdRef.current = null;
      setGeofenceAlert(null);
    }
  }, []);

  /** iOS manual geofence check on each GPS fix. */
  const applyGeofenceFromLocation = useCallback((loc: LastLocation) => {
    const vId = vehicleIdRef.current;
    if (!vId || vId === 'unassigned') {
      clearStopGeofenceState();
      return;
    }

    const hit = findGeofenceAtLocation(
      loc.latitude,
      loc.longitude,
      vId,
      geofencesRef.current,
    );

    if (!hit) {
      clearStopGeofenceState();
      return;
    }

    const hitId = String(hit.geofenceID);
    const snapshot: CurrentStopGeofence = { geofenceID: hitId, name: hit.name };
    if (
      currentStopGeofenceRef.current?.geofenceID !== hitId ||
      currentStopGeofenceRef.current?.name !== hit.name
    ) {
      currentStopGeofenceRef.current = snapshot;
      setCurrentStopGeofence(snapshot);
    }

    if (triggeredGeofenceIdRef.current === hitId) {
      return;
    }

    triggeredGeofenceIdRef.current = hitId;

    if (isSilentGeofence(hit)) {
      setGeofenceAlert(null);
      return;
    }

    setGeofenceAlert({
      geofenceID: hitId,
      name: hit.name,
      isWarning: isWarningGeofence(hit),
    });
  }, [clearStopGeofenceState]);

  /** Infer travel heading from movement when GPS course is unreliable (low speed). */
  const enrichLocationHeading = useCallback((loc: LastLocation): LastLocation => {
    const prev = previousLocationRef.current;
    previousLocationRef.current = loc;

    const speed = loc.speed ?? 0;
    if (speed > 1 && loc.heading != null && Number.isFinite(loc.heading)) {
      return loc;
    }

    if (!prev) {
      return { ...loc, heading: loc.heading ?? magnetometerHeadingRef.current };
    }

    const movedM = calculateDistance(
      prev.latitude,
      prev.longitude,
      loc.latitude,
      loc.longitude,
    );
    if (movedM < 3) {
      return { ...loc, heading: loc.heading ?? prev.heading ?? magnetometerHeadingRef.current };
    }

    return {
      ...loc,
      heading: headingBetween(prev.latitude, prev.longitude, loc.latitude, loc.longitude),
    };
  }, []);

  /** iOS findCurrentLinkWithLocation — next stop + stale schedule refetch (30 min). */
  const applyDirectionFromLocation = useCallback(
    (loc: LastLocation) => {
      const routeId = effectiveRouteId;
      if (routeId && directionModelRef.current.isStale() && !scheduleRefetchInFlightRef.current) {
        scheduleRefetchInFlightRef.current = true;
        void loadRouteSchedule(routeId).finally(() => {
          scheduleRefetchInFlightRef.current = false;
        });
      }

      if (directionModelRef.current.links.length === 0 && routeId) {
        const points = getRoutePointsForId(routeId);
        syncRouteGraphFromPoints(points);
      }

      runDirectionUpdate(loc);
    },
    [
      effectiveRouteId,
      loadRouteSchedule,
      getRoutePointsForId,
      syncRouteGraphFromPoints,
      runDirectionUpdate,
    ],
  );

  const processLocationUpdate = useCallback(
    (rawLoc: LastLocation): LastLocation => {
      const loc = enrichLocationHeading(rawLoc);
      lastLocationRef.current = loc;
      applyGeofenceFromLocation(loc);
      applyDirectionFromLocation(loc);
      return loc;
    },
    [enrichLocationHeading, applyGeofenceFromLocation, applyDirectionFromLocation],
  );

  // Battery
  useEffect(() => {
    const remove = deviceService.addBatteryListener((state: { level: number; charging: boolean }) => {
      setBatteryLevel(Math.round((state.level ?? 1) * 100));
      setBatteryState(state.charging ? 2 : 1);
    });
    deviceService.isCharging().then((charging) => setBatteryState(charging ? 2 : 1));
    return remove;
  }, []);

  // Should we send vehicle position? (tracking on/auto + vehicle selected for auto + GPS good)
  const shouldSendVehicle = useCallback((): boolean => {
    if (trackingMode === 'off') return false;
    if (!lastLocation) return false;
    if (isAcquiringSat) return false;
    if (trackingMode === 'auto' && !vehicleId) return false;
    return true;
  }, [trackingMode, lastLocation, isAcquiringSat, vehicleId]);

  const applyMinsLateFromResponse = useCallback((resp: unknown) => {
    const parsed = parseVehicleUpdateMinsLate(resp);
    if (!shouldApplyMinsLateUpdate(minsLateRef.current, parsed)) return;
    minsLateRef.current = parsed;
    setMinsLate(parsed);
    if (backgroundTrackingService.isTracking()) {
      backgroundTrackingService.updateTrackingData({ minsLate: parsed });
    }
  }, []);

  const buildBackgroundTrackingData = useCallback(() => ({
    agencyID,
    vehicleID: vehicleId && vehicleId !== 'unassigned' && vehicleId !== '110' ? String(vehicleId) : '0',
    driverID: telemetryDriverIdRef.current,
    routeID: String(coerceDriverIdForApi(getMdtRouteId())),
    mdtUuid,
    minsLate: minsLateRef.current ?? 0,
  }), [agencyID, vehicleId, getMdtRouteId, mdtUuid]);

  const shouldRunBackgroundTracking = useCallback((): boolean => {
    if (trackingModeRef.current === 'off') return false;
    if (!vehicleId || vehicleId === 'unassigned') return false;
    if (driver?.role === 'supervisor') return false;
    return true;
  }, [vehicleId, driver?.role]);

  // Send vehicle update (throttled 5s). Pass position from callback to use latest fix.
  const trySendVehicleUpdate = useCallback(async (position?: LastLocation | null) => {
    const loc = position ?? lastLocation;
    if (!loc || !vehicleId || vehicleId === 'unassigned' || vehicleId === '110') return;
    if (trackingMode === 'off') return;
    // If auto mode, we only send if a real vehicle is selected
    // if (trackingMode === 'auto' && (!vehicleId || vehicleId === '110')) return;
    const now = Date.now();
    if (now - lastVehicleSendRef.current < TIME_BETWEEN_SERVER_CALLS - 500) return;

    if (!isAssignmentBootstrapDone) {
      return;
    }
    const driverID = coerceDriverIdForApi(getMdtDriverId());
    const driverIdStr = String(driverID);
    telemetryDriverIdRef.current = driverIdStr;
    driverIdRef.current = driverIdStr;

    const routeID = coerceDriverIdForApi(getMdtRouteId());

    const params: VehicleUpdateParams = {
      agencyID,
      vehicleID: vehicleId ? vehicleId : 0,
      routeID,
      driverID,
      lat: loc.latitude,
      lng: loc.longitude,
      course: loc.heading != null ? Math.round(loc.heading) : 0,
      speed: Math.round(speedMpsToMph(loc.speed)), // m/s -> mph per API spec
      batteryLevel,
      batteryState,
      source: 'MDT',
      d: 1,
      minsLate:
        localMinsLateRef.current !== MINS_LATE_UNKNOWN
          ? localMinsLateRef.current
          : minsLate ?? undefined,
    };
    try {
      console.log('[DriverModel] vehicle update params--==--===>>>>', params);
      const resp: any = await vehicleUpdate(params);
      console.log('[DriverModel] vehicle update response--==--===>>>>', resp);
      applyMinsLateFromResponse(resp);
      if (resp && typeof resp.alert !== 'undefined') {
        setServerAlert(Number(resp.alert));
      }
      // Sync APC count from server response
      if (resp && resp.APCCount !== undefined && resp.APCCount !== null) {
        const serverApc = Number(resp.APCCount) || 0;
        setPassengerCount(serverApc);
      }
      lastVehicleSendRef.current = now;
      setLastVehicleSendTime(now);
      onLocationXmitRef.current?.(loc);
      if (__DEV__) {
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status >= 500 && status < 600) {
        lastVehicleSendRef.current = now + VEHICLE_UPDATE_BACKOFF_MS;
      }
      if (__DEV__) {
        console.warn(
          '[DriverModel] vehicle update failed',
          e?.response?.data ?? e?.message ?? e,
        );
      }
    }
  }, [
    lastLocation,
    vehicleId,
    trackingMode,
    effectiveRouteId,
    agencyID,
    batteryLevel,
    batteryState,
    applyMinsLateFromResponse,
    driver,
    isAssignmentBootstrapDone,
    getMdtDriverId,
    getMdtRouteId,
    setPassengerCount,
  ]);

  trySendVehicleUpdateRef.current = trySendVehicleUpdate;

  useEffect(() => {
    isAcquiringSatRef.current = isAcquiringSat;
  }, [isAcquiringSat]);

  // Permissions + notification channel (required for Android foreground service)
  useEffect(() => {
    const initPermissions = async () => {
      const granted = await requestLocationPermission();
      if (!granted) return;
      await requestBackgroundLocationPermission();
      await notificationService.initialize();
      notificationInitializedRef.current = true;
    };
    initPermissions();
  }, []);

  // Background task: GPS + MDT only; vehicle update uses the same path as foreground.
  useEffect(() => {
    backgroundTrackingService.setLocationUpdateHandler((payload) => {
      const speed = payload.speed ?? 0;
      const heading =
        speed > 1 && payload.heading !== undefined
          ? payload.heading
          : magnetometerHeadingRef.current;
      const loc: LastLocation = {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        heading,
        speed,
        timestamp: Date.now(),
        altitude: payload.altitude ?? 0,
      };
      setIsAcquiringSat(false);
      isAcquiringSatRef.current = false;
      setLocationError(null);
      if (payload.accuracy <= HORIZ_ACCUR_UPPER_LIMIT) {
        const enriched = processLocationUpdate(loc);
        setLastLocation(enriched);
        trySendVehicleUpdateRef.current?.(enriched);
      }
    });
    return () => {
      backgroundTrackingService.setLocationUpdateHandler(null);
    };
  }, [processLocationUpdate]);

  // Keep background task payload in sync while it is running
  useEffect(() => {
    if (!backgroundTrackingService.isTracking()) return;
    backgroundTrackingService.updateTrackingData(buildBackgroundTrackingData());
  }, [vehicleId, driver?.id, effectiveRouteId, mdtUuid, minsLate, buildBackgroundTrackingData]);

  const startBackgroundTrackingIfNeeded = useCallback(async (): Promise<void> => {
    if (!shouldRunBackgroundTracking() || !notificationInitializedRef.current) return;
    if (backgroundTrackingService.isTracking()) {
      backgroundTrackingService.updateTrackingData(buildBackgroundTrackingData());
      return;
    }
    const hasPermission = await hasBackgroundLocationPermission();
    if (!hasPermission) {
      console.warn('[DriverModel] Background location permission not granted');
      return;
    }
    const started = await backgroundTrackingService.start(buildBackgroundTrackingData());
    if (started) {
      setForegroundGpsActive(false);
      if (__DEV__) {
        console.log('[DriverModel] Background tracking service started');
      }
    }
  }, [shouldRunBackgroundTracking, buildBackgroundTrackingData]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (__DEV__) {
        console.log('[DriverModel] AppState changed ->', prevState, '->', nextState);
      }

      try {
        const enteringBackground =
          nextState === 'background' || nextState === 'inactive';
        const returningForeground =
          nextState === 'active' &&
          (prevState === 'background' || prevState === 'inactive');

        if (enteringBackground && shouldRunBackgroundTracking()) {
          await startBackgroundTrackingIfNeeded();
        } else if (returningForeground) {
          if (backgroundTrackingService.isTracking()) {
            const data = backgroundTrackingService.getCurrentData();
            if (data?.vehicleID && data.vehicleID !== '0' && data.vehicleID !== String(vehicleId)) {
              setVehicleId(data.vehicleID);
              setVehicleName(data.vehicleID);
            }
            await backgroundTrackingService.stop();
            setForegroundGpsActive(true);
            if (__DEV__) {
              console.log('[DriverModel] Background tracking service stopped (app active)');
            }
          }
        }

        if (!shouldRunBackgroundTracking() && backgroundTrackingService.isTracking()) {
          await backgroundTrackingService.stop();
          setForegroundGpsActive(true);
        }
      } catch (err) {
        console.warn('[DriverModel] Background service error:', err);
      }
    });

    return () => {
      sub.remove();
      if (BackgroundService.isRunning()) {
        BackgroundService.stop().catch(() => {});
      }
      backgroundTrackingService.stop().catch(() => {});
    };
  }, [
    trackingMode,
    vehicleId,
    driver?.id,
    driver?.role,
    shouldRunBackgroundTracking,
    startBackgroundTrackingIfNeeded,
    setVehicleId,
    setVehicleName,
  ]);

  // Magnetometer for device heading (compass)
  useEffect(() => {
    let subscription: any;
    try {
      const { magnetometer, setUpdateIntervalForType, SensorTypes } = require('react-native-sensors');
      const { map } = require('rxjs/operators');

      setUpdateIntervalForType(SensorTypes.magnetometer, 100); // 100ms update for smoother UI

      subscription = magnetometer
        .pipe(
          map(({ x, y, z }: any) => {
            // Calculate heading from magnetometer
            let heading = Math.atan2(y, x) * (180 / Math.PI);
            if (heading > 0) {
              heading -= 90;
            } else {
              heading += 270;
            }
            return heading;
          })
        )
        .subscribe(
          (heading: number) => {
            magnetometerHeadingRef.current = heading;
            // Update lastLocation with the new heading if speed is low
            setLastLocation((prev) => {
              if (!prev) return prev;
              // If speed is meaningful (> 1 m/s ~= 3.6 km/h), prefer GPS heading
              if (prev.speed && prev.speed > 1) {
                return prev;
              }
              // Otherwise use magnetometer heading
              return {
                ...prev,
                heading: heading
              }
            });
          },
          (error: any) => {
            console.log("Magnetometer not available", error);
          }
        );
    } catch (e) {
      console.log('Sensors package not linked or available', e);
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // Foreground GPS via react-native-geolocation-service (paused when background task runs).
  useEffect(() => {
    if (!foregroundGpsActive) {
      if (watchIdRef.current != null) {
        locationService.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    let isMounted = true;

    locationService.getCurrentLocation()
      .then(pos => {
        if (!isMounted) return;
        const ts = Date.now();
        const loc: LastLocation = {
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
          heading: pos.heading ?? 0,
          speed: pos.speed ?? 0,
          timestamp: ts,
          altitude: pos.altitude ?? 0,
        };
        if (pos.accuracy <= HORIZ_ACCUR_UPPER_LIMIT) {
          const enriched = processLocationUpdate(loc);
          setLastLocation(enriched);
        } else {
          lastLocationRef.current = loc;
          setLastLocation(loc);
        }
      })
      .catch(err => console.log('[DriverModel] Initial fix failed:', err.message));

    const onSuccess = (position: {
      latitude: number;
      longitude: number;
      accuracy: number;
      heading?: number;
      speed?: number;
      altitude?: number;
    }) => {
      const ts = Date.now();
      const speed = position.speed ?? 0;
      // If moving (>1m/s), use GPS heading. Else use magnetometer heading.
      const heading = (speed > 1 && position.heading !== undefined)
        ? position.heading
        : magnetometerHeadingRef.current;

      const loc: LastLocation = {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        heading: heading,
        speed: speed,
        timestamp: ts,
        altitude: position.altitude ?? 0,
      };

      const acquiring = position.accuracy > HORIZ_ACCUR_UPPER_LIMIT;
      setIsAcquiringSat(acquiring);
      isAcquiringSatRef.current = acquiring;
      setLocationError(null);

      if (!acquiring) {
        const enriched = processLocationUpdate(loc);
        setLastLocation(enriched);
        trySendVehicleUpdateRef.current?.(enriched);
        const now = Date.now();
        if (now - lastMdtSendRef.current >= MDT_INTERVAL_MS - 500) {
          trySendMdtUpdate(loc);
          lastMdtSendRef.current = now;
        }
      }

    };

    // ... rest of the effect
    const onError = (error: { message?: string }) => {
      setLocationError(error?.message ?? 'Location unavailable');
    };

    const watchId = locationService.watchPosition(onSuccess, onError);
    if (watchId === -1) {
      setLocationError('Geolocation not linked. Run "pod install" in ios/ and rebuild the app.');
    }
    watchIdRef.current = watchId === -1 ? null : watchId;
    return () => {
      isMounted = false;
      if (watchIdRef.current != null) {
        locationService.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [vehicleId, driver?.id, trackingMode, foregroundGpsActive, trySendMdtUpdate, processLocationUpdate]);

  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  // If tracking is enabled while app is already backgrounded, start the native task
  useEffect(() => {
    const isBackground =
      appStateRef.current === 'background' || appStateRef.current === 'inactive';
    if (isBackground && shouldRunBackgroundTracking()) {
      startBackgroundTrackingIfNeeded();
    }
  }, [trackingMode, vehicleId, driver?.role, shouldRunBackgroundTracking, startBackgroundTrackingIfNeeded]);

  // Heartbeat: vehicle (5s) when assigned; MDT (10s) always (matches native iOS timer).
  useEffect(() => {
    const runHeartbeat = () => {
      const loc = lastLocationRef.current ?? MDT_FALLBACK_LOCATION;

      if (loc !== MDT_FALLBACK_LOCATION && !isAcquiringSatRef.current) {
        processLocationUpdate(loc);
      }

      const now = Date.now();
      trySendVehicleUpdateRef.current?.(loc);

      if (!backgroundTrackingService.isTracking() && now - lastMdtSendRef.current >= MDT_INTERVAL_MS - 500) {
        trySendMdtUpdate(loc);
        lastMdtSendRef.current = now;
      }
    };

    runHeartbeat();
    const id = setInterval(runHeartbeat, 5000);
    return () => clearInterval(id);
  }, [vehicleId, driver?.id, isAssignmentBootstrapDone, trySendMdtUpdate, processLocationUpdate]);

  // Send first MDT heartbeat as soon as bootstrap completes (native updateMDTData on init).
  useEffect(() => {
    if (!isAssignmentBootstrapDone || driver?.role === 'supervisor') return;
    const loc = lastLocationRef.current ?? MDT_FALLBACK_LOCATION;
    trySendMdtUpdate(loc);
  }, [isAssignmentBootstrapDone, driver?.role, trySendMdtUpdate]);

  const setOnLocationXmit = useCallback((cb: ((location: LastLocation) => void) | null) => {
    onLocationXmitRef.current = cb;
  }, []);

  const hideNextStopForGeofence = geofenceAlert != null;

  const value = useMemo<DriverModelContextType>(
    () => ({
      lastLocation,
      isAcquiringSat,
      trackingMode,
      setTrackingMode,
      lastVehicleSendTime,
      locationError,
      batteryLevel,
      batteryState,
      setOnLocationXmit,
      serverAlert,
      minsLate,
      schedule,
      nextStop,
      linkAverages,
      geofenceAlert,
      currentStopGeofence,
      hideNextStopForGeofence,
    }),
    [
      lastLocation,
      isAcquiringSat,
      trackingMode,
      setTrackingMode,
      lastVehicleSendTime,
      locationError,
      batteryLevel,
      batteryState,
      setOnLocationXmit,
      serverAlert,
      minsLate,
      schedule,
      nextStop,
      linkAverages,
      geofenceAlert,
      currentStopGeofence,
      hideNextStopForGeofence,
    ],
  );

  return (
    <DriverModelContext.Provider value={value}>
      {children}
    </DriverModelContext.Provider>
  );
};

export function useDriverModel(): DriverModelContextType {
  const ctx = useContext(DriverModelContext);
  if (!ctx) {
    throw new Error('useDriverModel must be used within DriverModelProvider');
  }
  return ctx;
}
