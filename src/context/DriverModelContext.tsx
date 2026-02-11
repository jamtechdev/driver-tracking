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
} from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { locationService } from '@/services/location.service';
import { requestLocationPermission } from '@/utils/permissions';
import { deviceService } from '@/services/device.service';
import { mdtUpdate, vehicleUpdate, speedMpsToMph, type MdtUpdateParams, type VehicleUpdateParams } from '@/api/position.api';
import { APP_CONSTANTS } from '@/utils/constants';

const HORIZ_ACCUR_UPPER_LIMIT = APP_CONSTANTS.LOCATION_ACCURACY_THRESHOLD ?? 50; // meters; above = "ACQUIRING SAT"
const TIME_BETWEEN_SERVER_CALLS = APP_CONSTANTS.LOCATION_UPDATE_INTERVAL ?? 5000; // 5 seconds
const MDT_INTERVAL_MS = 10000; // 10 seconds heartbeat

export type TrackingMode = 'off' | 'auto' | 'on';

export interface LastLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

interface DriverModelContextType {
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
}

const DriverModelContext = createContext<DriverModelContextType | null>(null);

const MDT_UUID_KEY = '@driver_tracking:mdt_uuid';
const TRACKING_MODE_KEY = '@driver_tracking:tracking_mode';

function getMdtUuid(): string {
  try {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    return uuid;
  } catch {
    return 'mdt-' + Date.now();
  }
}

export const DriverModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    vehicleId,
    driver,
    selectedRouteId,
  } = useAuth();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isAcquiringSat, setIsAcquiringSat] = useState(false);
  const [trackingMode, setTrackingModeState] = useState<TrackingMode>('auto');
  const [lastVehicleSendTime, setLastVehicleSendTime] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryState, setBatteryState] = useState(2); // 2 = charging
  const [mdtUuid, setMdtUuid] = useState<string>('');

  const watchIdRef = useRef<number | null>(null);
  const mdtIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMdtSendRef = useRef<number>(0);
  const lastVehicleSendRef = useRef<number>(0);
  const onLocationXmitRef = useRef<((location: LastLocation) => void) | null>(null);

  const setTrackingMode = useCallback((mode: TrackingMode) => {
    setTrackingModeState(mode);
    AsyncStorage.setItem(TRACKING_MODE_KEY, mode).catch(() => {});
  }, []);

  // Restore tracking mode from storage
  useEffect(() => {
    AsyncStorage.getItem(TRACKING_MODE_KEY).then((stored) => {
      if (stored === 'off' || stored === 'auto' || stored === 'on') {
        setTrackingModeState(stored);
      }
    }).catch(() => {});
  }, []);

  // MDT UUID (device id for API)
  useEffect(() => {
    AsyncStorage.getItem(MDT_UUID_KEY).then((stored) => {
      if (stored) {
        setMdtUuid(stored);
      } else {
        const id = getMdtUuid();
        setMdtUuid(id);
        AsyncStorage.setItem(MDT_UUID_KEY, id).catch(() => {});
      }
    }).catch(() => setMdtUuid(getMdtUuid()));
  }, []);

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

  // Send vehicle update (throttled 5s). Pass position from callback to use latest fix.
  const trySendVehicleUpdate = useCallback(async (position?: LastLocation | null) => {
    const loc = position ?? lastLocation;
    if (!loc || !vehicleId || !driver?.id) return;
    if (trackingMode === 'off') return;
    if (trackingMode === 'auto' && !vehicleId) return;
    const now = Date.now();
    if (now - lastVehicleSendRef.current < TIME_BETWEEN_SERVER_CALLS) return;

    const params: VehicleUpdateParams = {
      agencyID,
      vehicleID: vehicleId,
      routeID: selectedRouteId ?? 0,
      driverID: driver.id,
      lat: loc.latitude,
      lng: loc.longitude,
      course: loc.heading != null ? Math.round(loc.heading) : 0,
      speed: Math.round(speedMpsToMph(loc.speed)), // m/s -> mph per API spec
      batteryLevel,
      batteryState,
      source: 'MDT',
      d: 1,
      minsLate: 0,
    };
    try {
      await vehicleUpdate(params);
      lastVehicleSendRef.current = now;
      setLastVehicleSendTime(now);
      onLocationXmitRef.current?.(loc);
      if (__DEV__) {
        console.log('[DriverModel] vehicle update sent', loc.latitude, loc.longitude);
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[DriverModel] vehicle update failed', e);
      }
    }
  }, [
    lastLocation,
    vehicleId,
    driver?.id,
    trackingMode,
    selectedRouteId,
    agencyID,
    batteryLevel,
    batteryState,
  ]);

  // Location updates from GPS
  useEffect(() => {
    const onSuccess = (position: {
      latitude: number;
      longitude: number;
      accuracy: number;
      heading?: number;
      speed?: number;
    }) => {
      const ts = Date.now();
      const loc: LastLocation = {
        latitude: position.latitude,
        longitude: position.longitude,
        accuracy: position.accuracy,
        heading: position.heading,
        speed: position.speed,
        timestamp: ts,
      };
      setLastLocation(loc);
      const acquiring = position.accuracy > HORIZ_ACCUR_UPPER_LIMIT;
      setIsAcquiringSat(acquiring);
      setLocationError(null);

      if (!acquiring && shouldSendVehicle() && vehicleId && driver?.id) {
        if (ts - lastVehicleSendRef.current >= TIME_BETWEEN_SERVER_CALLS) {
          trySendVehicleUpdate(loc);
        }
      }
    };

    const onError = (error: { message?: string }) => {
      setLocationError(error?.message ?? 'Location unavailable');
    };

    const watchId = locationService.watchPosition(onSuccess, onError);
    if (watchId === -1) {
      setLocationError('Geolocation not linked. Run "pod install" in ios/ and rebuild the app.');
    }
    watchIdRef.current = watchId === -1 ? null : watchId;
    return () => {
      if (watchIdRef.current != null) {
        locationService.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [vehicleId, driver?.id, shouldSendVehicle, trySendVehicleUpdate]);

  // MDT heartbeat every 10s (device + lat/lng)
  useEffect(() => {
    const runMdt = async () => {
      if (!lastLocation || !vehicleId || !driver?.id) return;
      const now = Date.now();
      if (now - lastMdtSendRef.current < MDT_INTERVAL_MS - 500) return;
      const params: MdtUpdateParams = {
        agencyID,
        vehicleID: vehicleId,
        vehicleAssignmentUpdated: 0,
        driverID: driver.id,
        lat: lastLocation.latitude,
        lng: lastLocation.longitude,
        course: lastLocation.heading ?? 0,
        speed: lastLocation.speed != null ? lastLocation.speed * 3.6 : 0,
        horizontalAccuracy: lastLocation.accuracy,
        verticalAccuracy: 0,
        batteryLevel,
        batteryState,
        d: 1,
        mdtUUID: mdtUuid || undefined,
        deviceName: 'MDT',
        appVersion: '0.0.1',
        isLocationServiceOn: 1,
        locationAuthStatus: 'authorized',
      };
      try {
        await mdtUpdate(params);
        lastMdtSendRef.current = now;
      } catch (_e) {
        // silent fail for heartbeat
      }
    };

    const id = setInterval(runMdt, MDT_INTERVAL_MS);
    mdtIntervalRef.current = id;
    return () => {
      if (mdtIntervalRef.current) clearInterval(mdtIntervalRef.current);
      mdtIntervalRef.current = null;
    };
  }, [lastLocation, vehicleId, driver?.id, agencyID, batteryLevel, batteryState, mdtUuid]);

  const setOnLocationXmit = useCallback((cb: ((location: LastLocation) => void) | null) => {
    onLocationXmitRef.current = cb;
  }, []);

  const value: DriverModelContextType = {
    lastLocation,
    isAcquiringSat,
    trackingMode,
    setTrackingMode,
    lastVehicleSendTime,
    locationError,
    batteryLevel,
    batteryState,
    setOnLocationXmit,
  };

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
