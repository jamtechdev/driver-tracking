/**
 * Location Service
 * GPS via react-native-geolocation-service (foreground and background).
 */

import Geolocation from 'react-native-geolocation-service';

export interface GeolocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  altitude?: number;
  /**
   * Native GPS fix time (ms since epoch).
   * Emulator GPX playback often uses the track's historical `<time>` values.
   */
  timestamp?: number;
  /** Wall-clock time when the app received this fix (use for upload freshness). */
  receivedAt: number;
}

/** How long a received fix may sit before vehicle/MDT heartbeats skip it. */
export const GPS_MAX_FIX_AGE_MS = 15_000;

/**
 * Upload / heartbeat freshness — based on when the app received the fix,
 * not the native GPS clock (GPX files often embed old `<time>` stamps).
 */
export function isFreshGpsFix(
  receivedAtMs: number | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (receivedAtMs == null || !Number.isFinite(receivedAtMs)) return true;
  return nowMs - receivedAtMs <= GPS_MAX_FIX_AGE_MS;
}

/**
 * Accept a newly delivered native fix into app state.
 * Allows GPX replay with historical timestamps (monotonic or loop restart),
 * rejects small timestamp rewinds that indicate an Android cached fix.
 */
export function shouldAcceptGpsFix(
  fixTimestampMs: number | undefined,
  lastAcceptedNativeTimestampMs: number | null | undefined,
): boolean {
  if (fixTimestampMs == null || !Number.isFinite(fixTimestampMs)) return true;
  if (
    lastAcceptedNativeTimestampMs == null ||
    !Number.isFinite(lastAcceptedNativeTimestampMs)
  ) {
    return true;
  }
  if (fixTimestampMs >= lastAcceptedNativeTimestampMs) return true;
  // Large backward jump → new GPX loop / session restart
  if (lastAcceptedNativeTimestampMs - fixTimestampMs > GPS_MAX_FIX_AGE_MS) {
    return true;
  }
  return false;
}

/** Shared watch options for foreground and background tasks. */
export const GEOLOCATION_WATCH_OPTIONS: Geolocation.GeoWatchOptions = {
  enableHighAccuracy: true,
  distanceFilter: 0,
  interval: 1000,
  fastestInterval: 500,
  maximumAge: 0,
  showsBackgroundLocationIndicator: true,
  forceRequestLocation: true,
};

function toResponse(position: Geolocation.GeoPosition): GeolocationResponse {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: position.coords.heading ?? undefined,
    speed: position.coords.speed ?? undefined,
    altitude: position.coords.altitude ?? undefined,
    timestamp: position.timestamp,
    receivedAt: Date.now(),
  };
}

export const locationService = {
  isAvailable(): boolean {
    return true;
  },

  getCurrentLocation(): Promise<GeolocationResponse> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => resolve(toResponse(position)),
        (err) => {
          if (err.code === 3) {
            Geolocation.getCurrentPosition(
              (pos) => resolve(toResponse(pos)),
              reject,
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
            );
          } else {
            reject(err);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        },
      );
    });
  },

  watchPosition(
    onSuccess: (position: GeolocationResponse) => void,
    onError: (error: { message?: string }) => void,
    options?: Partial<Geolocation.GeoWatchOptions>,
  ): number {
    try {
      return Geolocation.watchPosition(
        (position) => onSuccess(toResponse(position)),
        (error) => onError({ message: error?.message ?? 'Location unavailable' }),
        { ...GEOLOCATION_WATCH_OPTIONS, ...options },
      );
    } catch (e) {
      onError({
        message: e instanceof Error ? e.message : 'Geolocation not available.',
      });
      return -1;
    }
  },

  clearWatch(watchId: number): void {
    if (watchId === -1) return;
    try {
      Geolocation.clearWatch(watchId);
    } catch {
      // ignore
    }
  },
};
