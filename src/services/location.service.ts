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
}

/** Shared watch options for foreground and background tasks. */
export const GEOLOCATION_WATCH_OPTIONS: Geolocation.GeoWatchOptions = {
  enableHighAccuracy: true,
  distanceFilter: 3,
  interval: 5000,
  fastestInterval: 2000,
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
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
            );
          } else {
            reject(err);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 60000,
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
