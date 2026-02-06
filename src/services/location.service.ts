/**
 * Location Service
 * GPS tracking and location management.
 * Lazy-loads @react-native-community/geolocation so the app does not crash if the native module is not linked.
 */

export interface GeolocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
}

let _geolocation: typeof import('@react-native-community/geolocation').default | null | 'failed' = null;

function getGeolocation(): typeof import('@react-native-community/geolocation').default | null {
  if (_geolocation === 'failed') return null;
  if (_geolocation !== null) return _geolocation;
  try {
    const mod = require('@react-native-community/geolocation');
    if (!mod) {
      _geolocation = 'failed';
      return null;
    }
    const Default = mod.default;
    if (!Default) {
      _geolocation = 'failed';
      return null;
    }
    _geolocation = Default;
    return _geolocation;
  } catch (_e) {
    _geolocation = 'failed';
    return null;
  }
}

export const locationService = {
  /**
   * Whether the native geolocation module is available (linked).
   */
  isAvailable(): boolean {
    return getGeolocation() !== null;
  },

  /**
   * Get current location
   */
  getCurrentLocation: (): Promise<GeolocationResponse> => {
    const Geolocation = getGeolocation();
    if (!Geolocation) {
      return Promise.reject(new Error('Geolocation not linked. Run "pod install" and rebuild.'));
    }
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  },

  /**
   * Start watching position. Returns watch ID, or -1 if geolocation is not available.
   */
  watchPosition: (
    onSuccess: (position: GeolocationResponse) => void,
    onError: (error: { message?: string }) => void
  ): number => {
    let Geolocation: typeof import('@react-native-community/geolocation').default | null = null;
    try {
      Geolocation = getGeolocation();
    } catch (_e) {
      onError({ message: 'Geolocation not linked. Run "pod install" in ios/ and rebuild the app.' });
      return -1;
    }
    if (!Geolocation) {
      onError({ message: 'Geolocation not linked. Run "pod install" in ios/ and rebuild the app.' });
      return -1;
    }
    try {
      return Geolocation.watchPosition(
        (position) => {
          onSuccess({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            heading: position.coords.heading ?? undefined,
            speed: position.coords.speed ?? undefined,
          });
        },
        onError,
        {
          enableHighAccuracy: true,
          distanceFilter: 10,
          interval: 5000,
        }
      );
    } catch (e) {
      onError({ message: e instanceof Error ? e.message : 'Geolocation not linked. Run "pod install" and rebuild.' });
      return -1;
    }
  },

  /**
   * Clear watch (no-op if watchId is -1 or native module not linked).
   */
  clearWatch: (watchId: number) => {
    if (watchId === -1) return;
    const Geolocation = getGeolocation();
    if (Geolocation) {
      try {
        Geolocation.clearWatch(watchId);
      } catch (_) {
        // ignore
      }
    }
  },
};

