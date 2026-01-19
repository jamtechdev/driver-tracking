/**
 * App Constants
 */

export const APP_CONSTANTS = {
  // Passenger/Fare
  MAX_PASSENGER_COUNT: 999,
  MIN_PASSENGER_COUNT: 0,
  
  // Volume
  VOLUME_WARNING_THRESHOLD: 15,
  MIN_VOLUME: 0,
  MAX_VOLUME: 100,
  
  // Brightness
  MIN_BRIGHTNESS: 0,
  MAX_BRIGHTNESS: 100,
  
  // Location
  LOCATION_UPDATE_INTERVAL: 5000, // 5 seconds
  BACKGROUND_UPDATE_INTERVAL: 30000, // 30 seconds
  LOCATION_ACCURACY_THRESHOLD: 50, // meters
  
  // Messaging
  MESSAGE_POLL_INTERVAL: 10000, // 10 seconds
  TTS_RATE: 0.5,
  TTS_PITCH: 1.0,
  
  // Timeouts
  API_TIMEOUT: 30000,
  DEBOUNCE_DELAY: 300,
  
  // Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: '@driver_tracking:auth_token',
    REFRESH_TOKEN: '@driver_tracking:refresh_token',
    USER_DATA: '@driver_tracking:user_data',
    SETTINGS: '@driver_tracking:settings',
  },
};

export const FARE_TYPES = [
  { id: 'adult', name: 'Adult', amount: 2.5 },
  { id: 'child', name: 'Child', amount: 1.25 },
  { id: 'senior', name: 'Senior', amount: 1.25 },
  { id: 'student', name: 'Student', amount: 1.5 },
  { id: 'free', name: 'Free', amount: 0 },
];

