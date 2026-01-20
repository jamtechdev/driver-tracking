/**
 * Google Maps Configuration
 */

import { env } from './env';

/**
 * Check if Google Maps API key is valid
 */
export const isMapsApiKeyValid = (): boolean => {
  const apiKey = env.GOOGLE_MAPS_API_KEY;
  return (
    !!apiKey &&
    apiKey.trim() !== '' &&
    apiKey !== 'YOUR_GOOGLE_MAPS_API_KEY' &&
    apiKey.length > 20 // Basic validation - real API keys are longer
  );
};

/**
 * Check if maps are available for use
 */
export const isMapsAvailable = (): boolean => {
  return isMapsApiKeyValid();
};

export const MAPS_CONFIG = {
  API_KEY: env.GOOGLE_MAPS_API_KEY,
  IS_AVAILABLE: isMapsApiKeyValid(),
  DEFAULT_REGION: {
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  },
  ZOOM_LEVELS: {
    DEFAULT: 15,
    ROUTE_OVERVIEW: 13,
    STOP_DETAIL: 18,
  },
  UPDATE_INTERVAL: 5000, // 5 seconds
  BACKGROUND_UPDATE_INTERVAL: 30000, // 30 seconds
};

