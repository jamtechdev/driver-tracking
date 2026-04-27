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
import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import { locationService } from '@/services/location.service';
import { requestLocationPermission } from '@/utils/permissions';
import { deviceService } from '@/services/device.service';
import { mdtUpdate, vehicleUpdate, speedMpsToMph, selfUpdateAssignment, type MdtUpdateParams, type VehicleUpdateParams } from '@/api/position.api';
import { APP_CONSTANTS } from '@/utils/constants';
import { useDriverData } from './DriverDataContext';
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { getRouteSchedule } from '@/api/schedule.api';
import { calculateDistance } from '@/utils/helpers';
import { notificationService } from '@/services/notification.service';
import BackgroundService from 'react-native-background-actions';
import { backgroundTrackingService } from '@/services/background-tracking.service';

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
  /** Minutes late from the server response. */
  minsLate: number | null;
  /** Current route schedule. */
  schedule: ScheduleStop[];
  /** The calculated next stop. */
  nextStop: ScheduleStop | null;
  /** Average time in seconds between route links/points. */
  linkAverages: number[];
}

const DriverModelContext = createContext<DriverModelContextType | null>(null);

const MDT_ID_KEY = '@driver_tracking:mdt_id';
const TRACKING_MODE_KEY = '@driver_tracking:tracking_mode';

export const DriverModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    vehicleId,
    driver,
    selectedRouteId,
    setVehicleId,
    setVehicleName,
  } = useAuth();
  const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);
  const { vehicles, routes, drivers, stops, isLoading } = useDriverData();
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);
  const [isAcquiringSat, setIsAcquiringSat] = useState(false);
  const [trackingMode, setTrackingModeState] = useState<TrackingMode>('auto');
  const [lastVehicleSendTime, setLastVehicleSendTime] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [batteryState, setBatteryState] = useState(2); // 2 = charging
  const [mdtUuid, setMdtUuid] = useState<string>('');
  const [minsLate, setMinsLate] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<ScheduleStop[]>([]);
  const [nextStop, setNextStop] = useState<ScheduleStop | null>(null);
  const [visitedLinks, setVisitedLinks] = useState<Set<number>>(new Set());
  const [linkAverages, setLinkAverages] = useState<number[]>([]);

  // Self-dispatch when a valid vehicle and route are selected
  useEffect(() => {
    if (vehicleId && vehicleId !== '110' && selectedRouteId && selectedRouteId !== 'Out of Service') {
      selfUpdateAssignment({
        agencyID,
        vehicleID: vehicleId,
        routeID: selectedRouteId,
        driverID: driver?.id || 0,
      }).catch((err: any) => {
        console.warn('[DriverModel] Self-dispatch auto-assignment failed:', err);
      });
    }
  }, [vehicleId, selectedRouteId, driver?.id, agencyID]);

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

  const trySendMdtUpdate = useCallback(async (loc: LastLocation) => {
    if (driver?.role === 'supervisor') {
      return;
    }
    try {
      const brightness = await deviceService.getBrightness();
      const netState = await NetInfo.fetch();
      const powerState = await DeviceInfo.getPowerState();
      const deviceName = await DeviceInfo.getDeviceName();
      const deviceSerial = DeviceInfo.getUniqueIdSync();

      const params: MdtUpdateParams = {
        agencyID,
        vehicleID: vehicleId ? vehicleId : 0,
        vehicleAssignmentUpdated: 0,
        driverID: (driver?.id && driver.id !== 'unassigned') ? driver.id : 0,
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
      if (resp && resp.vehicleID) {
        setVehicleId(String(resp.vehicleID));
        setVehicleName(String(resp.vehicleID));
      }
      lastMdtSendRef.current = Date.now();
      hasSentFirstMdtRef.current = true;
    } catch (e: any) {
      console.warn('[DriverModel] MDT update failed', e?.response?.data || e);
    }
  }, [vehicleId, driver?.id, agencyID, mdtUuid]);

  const setTrackingMode = useCallback((mode: TrackingMode) => {
    setTrackingModeState(mode);
    AsyncStorage.setItem(TRACKING_MODE_KEY, mode).catch(() => { });
  }, []);

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

  // Fetch Schedule when route changes
  useEffect(() => {
    // Clear previous schedule states immediately on route change
    setSchedule([]);
    setNextStop(null);
    setVisitedLinks(new Set());

    if (!selectedRouteId || selectedRouteId === 'Out of Service') {
      return;
    }

    const loadSchedule = async () => {
      try {
        const response = await getRouteSchedule(agencyID, selectedRouteId);
        const list = Array.isArray(response.schedule) ? response.schedule : [];
        const averages = Array.isArray(response.linkAverages) ? (response.linkAverages as number[]) : [];
        console.log('list======>>>>>>', list);
        setLinkAverages(averages);

        // Enrich schedule with coordinates from the static stops list
        const enriched = list.map(item => {
          const match = stops.find(s =>
            s.longName === item.longName ||
            String(s.stopID) === String(item.link)
          );
          if (match) {
            return { ...item, lat: match.lat, lng: match.lng };
          }
          return item;
        });

        setSchedule(enriched);
        // Initially, the first stop is next if available
        if (enriched.length > 0) {
          setNextStop(enriched[0]);
        } else {
          setNextStop(null);
        }
      } catch (e) {
        console.warn('[DriverModel] Failed to fetch schedule:', e);
        setSchedule([]);
        setNextStop(null);
        setLinkAverages([]);
      }
    };

    loadSchedule();
  }, [selectedRouteId, agencyID, stops]);

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
    if (!loc || !vehicleId) return;
    if (trackingMode === 'off') return;
    // If auto mode, we only send if a real vehicle is selected
    // if (trackingMode === 'auto' && (!vehicleId || vehicleId === '110')) return;
    const now = Date.now();
    if (now - lastVehicleSendRef.current < TIME_BETWEEN_SERVER_CALLS - 500) return;

    const params: VehicleUpdateParams = {
      agencyID,
      vehicleID: vehicleId ? vehicleId : 0,
      routeID: selectedRouteId ?? 0,
      driverID: (driver?.id && driver.id !== 'unassigned') ? driver.id : 0,
      lat: loc.latitude,
      lng: loc.longitude,
      course: loc.heading != null ? Math.round(loc.heading) : 0,
      speed: Math.round(speedMpsToMph(loc.speed)), // m/s -> mph per API spec
      batteryLevel,
      batteryState,
      source: 'MDT',
      d: 1,
      minsLate: minsLate ?? undefined,
    };
    try {
      console.log('[DriverModel] vehicle update params--==--===>>>>', params);
      const resp: any = await vehicleUpdate(params);
      console.log('[DriverModel] vehicle update response--==--===>>>>', resp);
      if (resp && typeof resp.minsLate !== 'undefined') {
        setMinsLate(Number(resp.minsLate));
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
        console.warn('[DriverModel] vehicle update failed', e.response.data);
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

  trySendVehicleUpdateRef.current = trySendVehicleUpdate;

  // 1. Initial Permission Request (Handled in App.tsx)
  useEffect(() => {
    // If the user handles initialization in App.tsx, we can just mark it as ready here.
    notificationInitializedRef.current = true;
  }, []);



  const sleep = (time: any) => new Promise(resolve => setTimeout(resolve, time));

  // The background tracking is now handled by BackgroundTrackingService

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (__DEV__) {
        console.log('[DriverModel] AppState changed ->', nextState);
      }

      const isTrackingActive = trackingMode !== 'off';
      const isReadyForNotify = notificationInitializedRef.current;

      const options = {
        taskName: 'DriverTracking',
        taskTitle: 'GPS Tracking Active',
        taskDesc: 'Broadcasting location to server',
        taskIcon: {
          name: 'ic_launcher',
          type: 'mipmap',
        },
        color: '#000000',
        linkingURI: 'drivertracking://',
        parameters: {
          delay: 5000,
        },
      };

      try {
        if (isTrackingActive && isReadyForNotify) {
          if (
            (nextState === 'background' || nextState === 'inactive') &&
            !backgroundTrackingService.isTracking()
          ) {
            await backgroundTrackingService.start({
              agencyID,
              vehicleID: (vehicleId && vehicleId !== '110') ? String(vehicleId) : '0',
              driverID: (driver?.id && driver.id !== 'unassigned') ? String(driver.id) : '0',
              routeID: String(selectedRouteId || 0),
              mdtUuid,
              minsLate: minsLate || 0,
            });

            if (__DEV__) {
              console.log('[DriverModel] Background tracking service started');
            }
          } else if (
            nextState === 'active' &&
            (prevState === 'background' || prevState === 'inactive')
          ) {
            if (backgroundTrackingService.isTracking()) {
              const data = backgroundTrackingService.getCurrentData();
              if (data && data.vehicleID && data.vehicleID !== String(vehicleId)) {
                setVehicleId(data.vehicleID);
                setVehicleName(data.vehicleID);
              }
              await backgroundTrackingService.stop();

              if (__DEV__) {
                console.log('[DriverModel] Background tracking service stopped (app active)');
              }
            }
          }
        } else {
          if (backgroundTrackingService.isTracking()) {
            await backgroundTrackingService.stop();

            if (__DEV__) {
              console.log('[DriverModel] Background tracking service stopped (conditions false)');
            }
          }
        }
      } catch (err) {
        console.warn('[DriverModel] Background service error:', err);
      }
    });

    return () => {
      sub.remove();
      if (BackgroundService.isRunning()) {
        BackgroundService.stop().catch(() => { });
      }
    };
  }, [trackingMode, vehicleId, driver?.id]);



  // // 2. AppState Listener for Background tracking indicator
  // useEffect(() => {
  //   const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
  //     const prevState = appStateRef.current;
  //     appStateRef.current = nextState;

  //     if (__DEV__) {
  //       console.log('[DriverModel] AppState changed ->', nextState);
  //     }

  //     // Handle background tracking indicator & persistent background task
  //     const isTrackingActive = trackingMode !== 'off' && vehicleId && vehicleId !== '110';
  //     const isReadyForNotify = notificationInitializedRef.current && driver?.id && driver?.id !== 'unassigned';

  //     if (isTrackingActive && isReadyForNotify) {
  //       if (nextState === 'background' || nextState === 'inactive') {
  //         // 1. Android/iOS background task to keep JS loop alive
  //         const options = {
  //           taskName: 'DriverTracking',
  //           taskTitle: 'GPS Tracking Active',
  //           taskDesc: 'Broadcasting location to Peak Transit server',
  //           taskIcon: {
  //             name: 'ic_launcher',
  //             type: 'mipmap',
  //           },
  //           color: '#000000',
  //           parameters: {
  //             delay: 5000,
  //           },
  //         };

  //         BackgroundService.start(backgroundHeartbeatTask, options).catch(err =>
  //           console.warn('[DriverModel] Background service failed to start:', err)
  //         );
  //       } else if (nextState === 'active' && (prevState === 'background' || prevState === 'inactive')) {
  //         // Restore to foreground
  //         BackgroundService.stop().catch(() => { });
  //       }
  //     } else {
  //       BackgroundService.stop().catch(() => { });
  //     }
  //   });

  //   return () => {
  //     sub.remove();
  //     BackgroundService.stop().catch(() => { });
  //   };
  // }, [trackingMode, vehicleId, driver?.id]);

  // const backgroundHeartbeatTask = async (taskDataArguments: any) => {
  //   const { delay } = taskDataArguments;

  //   // We run an infinite loop as long as the service is active
  //   await new Promise(async (resolve) => {
  //     while (BackgroundService.isRunning()) {
  //       try {
  //         // Manually request a fresh GPS fix to keep hardware active in background
  //         const pos = await locationService.getCurrentLocation();

  //         if (pos) {
  //           // Map GeolocationResponse to LastLocation format expected by the API
  //           const ts = Date.now();
  //           const loc: LastLocation = {
  //             latitude: pos.latitude,
  //             longitude: pos.longitude,
  //             accuracy: pos.accuracy,
  //             heading: pos.heading ?? 0,
  //             speed: pos.speed ?? 0,
  //             altitude: pos.altitude ?? 0,
  //             timestamp: ts,
  //           };

  //           // Sync the main app state if possible (though it's usually throttled)
  //           setLastLocation(loc);

  //           // Send the update to the server immediately
  //           await trySendVehicleUpdateRef.current?.(loc);

  //           if (__DEV__) {
  //             console.log('[BackgroundHeartbeat] Sent update at', new Date(ts).toLocaleTimeString());
  //           }
  //         }
  //       } catch (err) {
  //         if (__DEV__) console.warn('[BackgroundHeartbeat] Fix failed:', err);
  //       }

  //       // Wait for the next 5-second interval
  //       await new Promise((r) => setTimeout(r, delay));
  //     }
  //   });
  // };

  const magnetometerHeadingRef = useRef<number>(0);

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

  // Location updates from GPS (effect does not depend on trySendVehicleUpdate to avoid re-subscribing on every location change)
  useEffect(() => {
    let isMounted = true;

    // Proactive initial fix
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
        setLastLocation(loc);
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

      setLastLocation(loc);

      const acquiring = position.accuracy > HORIZ_ACCUR_UPPER_LIMIT;
      setIsAcquiringSat(acquiring);
      setLocationError(null);

      // ── Vehicle update on every GPS fix (foreground AND background) ──
      // The throttle inside trySendVehicleUpdate (5 s) prevents flooding.
      if (!acquiring) {
        trySendVehicleUpdateRef.current?.(loc);
      }

      // Next Stop Logic: Proximity check
      if (!acquiring && schedule.length > 0) {
        // Find the first non-visited stop that we are close to
        const arrivalThreshold = 100; // meters

        let updatedVisited = false;
        const newVisited = new Set(visitedLinks);

        schedule.forEach((stop) => {
          if (stop.lat && stop.lng && !newVisited.has(stop.link)) {
            const dist = calculateDistance(
              loc.latitude,
              loc.longitude,
              stop.lat,
              stop.lng
            );
            if (dist < arrivalThreshold) {
              newVisited.add(stop.link);
              updatedVisited = true;
            }
          }
        });

        if (updatedVisited) {
          setVisitedLinks(newVisited);
          // Find the new "next stop"
          const firstRemaining = schedule.find(s => !newVisited.has(s.link));
          setNextStop(firstRemaining || null);
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
  }, [vehicleId, driver?.id, trackingMode]);

  const lastLocationRef = useRef<LastLocation | null>(null);
  useEffect(() => {
    lastLocationRef.current = lastLocation;
  }, [lastLocation]);

  // Heartbeat: MDT (10s) and Vehicle (5s)
  useEffect(() => {
    const runHeartbeat = () => {
      const loc = lastLocationRef.current;
      if (!loc) return;

      const now = Date.now();

      // Vehicle Position update (every 5s)
      trySendVehicleUpdateRef.current?.(loc);

      // MDT heartbeat (every 10s)
      if (now - lastMdtSendRef.current >= MDT_INTERVAL_MS - 500) {
        trySendMdtUpdate(loc);
      }
    };

    // Initial check
    runHeartbeat();

    const id = setInterval(runHeartbeat, 5000);
    return () => clearInterval(id);
  }, [vehicleId, driver?.id, trySendMdtUpdate]);

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
    minsLate: minsLate,
    schedule,
    nextStop,
    linkAverages,
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
