/**
 * Google Maps Configuration
 */

import { env } from './env';

export const MAPS_CONFIG = {
  API_KEY: env.GOOGLE_MAPS_API_KEY,
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

