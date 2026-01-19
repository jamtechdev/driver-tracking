/**
 * Location Service
 * GPS tracking and location management
 * Placeholder - to be implemented in Week 5-6
 */

import Geolocation from '@react-native-community/geolocation';

export const locationService = {
  /**
   * Get current location
   */
  getCurrentLocation: (): Promise<GeolocationResponse> => {
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
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  },

  /**
   * Start watching position
   */
  watchPosition: (
    onSuccess: (position: GeolocationResponse) => void,
    onError: (error: any) => void
  ): number => {
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
        distanceFilter: 10, // Update every 10 meters
        interval: 5000, // Update every 5 seconds
      }
    );
  },

  /**
   * Clear watch
   */
  clearWatch: (watchId: number) => {
    Geolocation.clearWatch(watchId);
  },
};

interface GeolocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
}

