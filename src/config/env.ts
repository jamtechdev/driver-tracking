/**
 * Environment configuration
 * Note: For production, consider using react-native-config or similar
 * to load from .env files. For now, using constants.
 */

interface EnvConfig {
  API_BASE_URL: string;
  API_BASE_URL_DEV?: string;
  API_BASE_URL_STAGING?: string;
  API_BASE_URL_PROD?: string;
  GOOGLE_MAPS_API_KEY: string;
  APP_VERSION: string;
  ENABLE_LOGGING: boolean;

}

interface AppConstants {
  APP_ID: string;
  APP_KEY: string
  AGENCY_ID: String
}

const constants: AppConstants = {
  APP_ID: 'DR',
  APP_KEY: '005b0274ca5e97ceb3d804077113792c',
  AGENCY_ID: '121'
};

/** Base URL for Peak Transit APIs (no query string). Append &controller=...&action=...&params */
export const PEAK_BASE_URL =
  `https://api.peaktransit.com/v5/index.php/?app_id=${constants.APP_ID}&key=${constants.APP_KEY}`;

/** Default query params for Peak Transit API (when base URL is index.php with no query). */
export const PEAK_DEFAULT_PARAMS = {
  app_id: constants.APP_ID,
  key: constants.APP_KEY,
  controller: 'driver',
  action: 'data',
  agencyID: constants.AGENCY_ID,
};

/** Full URL for driver data API (agency, vehicles, routes, drivers, messages, stops, etc.). */
export const DRIVER_DATA_API_URL =
  `https://api.peaktransit.com/v5/index.php/?app_id=${constants.APP_ID}&key=${constants.APP_KEY}&controller=driver&action=data&agencyID=${constants.AGENCY_ID}`;

/** Base URL for incoming messages (driver getMessages). Append &agencyID=...&vehicleID=... (and to=1). */
export const INCOMING_MESSAGES_BASE_URL =
  `https://api.peaktransit.com/v5/index.php/?app_id=${constants.APP_ID}&key=${constants.APP_KEY}&controller=driver&action=getMessages&to=1`;

/** Base URL for get checklist. Append &vehicleID=...&agencyID=... */
export const CHECKLIST_GET_BASE_URL =
  `https://api.peaktransit.com/v5/index.php/?app_id=${constants.APP_ID}&key=${constants.APP_KEY}&controller=driver&action=getchecklist`;

/** Base URL for submit checklist. Append &vehicleID=...&driverID=...&agencyID=...&hasFail=0|1 */
export const CHECKLIST_SUBMIT_BASE_URL =
  `https://api.peaktransit.com/v5/index.php/?app_id=${constants.APP_ID}&key=${constants.APP_KEY}&controller=driver&action=submitchecklist`;

// Default values - Update these with your actual values
// In production, use react-native-config to load from .env
const defaultConfig: EnvConfig = {
  API_BASE_URL: __DEV__ ? 'http://localhost:3000/api' : 'https://api.example.com/api',
  API_BASE_URL_DEV: 'http://dev-api.example.com/api',
  // Base only (no query) so paths like /passengers/history don't get concatenated into agencyID
  API_BASE_URL_STAGING: `https://api.peaktransit.com/v5/index.php`,
  API_BASE_URL_PROD: 'https://api.example.com/api',
  GOOGLE_MAPS_API_KEY: '', // Set your Google Maps API key here
  APP_VERSION: '0.0.1',
  ENABLE_LOGGING: __DEV__,
};

export const env = defaultConfig;

export const getApiBaseUrl = (): string => {
  // In production, you can check __DEV__ or use a config service
  if (!__DEV__ && defaultConfig.API_BASE_URL_PROD) {
    return defaultConfig.API_BASE_URL_PROD;
  }
  if (defaultConfig.API_BASE_URL_STAGING) {
    return defaultConfig.API_BASE_URL_STAGING;
  }
  if (__DEV__ && defaultConfig.API_BASE_URL_DEV) {
    return defaultConfig.API_BASE_URL_DEV;
  }

  return defaultConfig.API_BASE_URL;
};

