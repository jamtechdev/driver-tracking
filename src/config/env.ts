/**
 * Environment configuration
 * Note: For production, consider using react-native-config or similar
 * to load from .env files. For now, using constants.
 */

import { getAgencyIdSync } from '@/services/agencySession.service';

interface EnvConfig {
  API_BASE_URL: string;
  API_BASE_URL_DEV?: string;
  API_BASE_URL_STAGING?: string;
  API_BASE_URL_PROD?: string;
  GOOGLE_MAPS_API_KEY: string;
  APP_VERSION: string;
  ENABLE_LOGGING: boolean;
}

export const PEAK_APP_ID = 'DR3';
export const PEAK_APP_KEY = 'b8106d7305f63812d9f3c5bb5d900786';

/** Base URL for Peak Transit APIs (no query string). Append &controller=...&action=...&params */
export function getPeakBaseUrl(): string {
  return `https://api.peaktransit.com/v5/index.php/?app_id=${PEAK_APP_ID}&key=${PEAK_APP_KEY}`;
}

/** @deprecated Use getPeakBaseUrl() */
export const PEAK_BASE_URL = getPeakBaseUrl();

/** Default query params for Peak Transit API (agencyID is dynamic after login). */
export const PEAK_DEFAULT_PARAMS = {
  get app_id() {
    return PEAK_APP_ID;
  },
  get key() {
    return PEAK_APP_KEY;
  },
  controller: 'driver' as const,
  action: 'data' as const,
  get agencyID() {
    return getAgencyIdSync() ?? '';
  },
};

export function getPeakDefaultParams() {
  return {
    app_id: PEAK_APP_ID,
    key: PEAK_APP_KEY,
    controller: 'driver' as const,
    action: 'data' as const,
    agencyID: getAgencyIdSync() ?? '',
  };
}

function withAgencyId(path: string): string {
  const agencyId = getAgencyIdSync();
  if (!agencyId) {
    throw new Error('Agency ID is not set. User must log in first.');
  }
  return `${path}&agencyID=${encodeURIComponent(agencyId)}`;
}

/** Full URL for driver data API (agency, vehicles, routes, drivers, messages, stops, etc.). */
export function getDriverDataApiUrl(): string {
  return withAgencyId(`${getPeakBaseUrl()}&controller=driver&action=data`);
}

/** Base URL for incoming messages (driver getMessages). Append &agencyID=... */
export function getIncomingMessagesBaseUrl(): string {
  return `${getPeakBaseUrl()}&controller=driver&action=getMessages`;
}

/** Base URL for get checklist. Append &vehicleID=...&agencyID=... */
export function getChecklistGetBaseUrl(): string {
  return `${getPeakBaseUrl()}&controller=driver&action=getchecklist`;
}

/** Base URL for submit checklist. Append &vehicleID=...&driverID=...&agencyID=...&hasFail=0|1 */
export function getChecklistSubmitBaseUrl(): string {
  return `${getPeakBaseUrl()}&controller=driver&action=submitchecklist`;
}

/** Base URL for vehicle list. */
export function getVehicleListUrl(): string {
  return withAgencyId(`${getPeakBaseUrl()}&controller=Vehicle&action=list&all=1`);
}

/** Base URL for getting vehicle assignment info. Append &vehicleID=... */
export function getVehicleAssignmentInfoUrl(): string {
  return withAgencyId(`${getPeakBaseUrl()}&controller=driver&action=assignment`);
}

/** Base URL for supervisor vehicle assignment. Append &routeID=...&driverID=...&vehicleID=...&end=... */
export function getVehicleAssignBaseUrl(): string {
  return withAgencyId(`${getPeakBaseUrl()}&controller=driver&action=assignvehicle&source=MDT`);
}

/** Base URL for driver vehicle self-assign (Peak Transit: vehicleassignments/selfupdate). */
export function getDriverVehicleSelectBaseUrl(): string {
  return withAgencyId(
    `${getPeakBaseUrl()}&controller=vehicleassignments&action=selfupdate&source=MDT`,
  );
}

// Default values - Update these with your actual values
// In production, use react-native-config to load from .env
const defaultConfig: EnvConfig = {
  API_BASE_URL: 'https://api.peaktransit.com/v5/index.php',
  API_BASE_URL_DEV: 'https://api.peaktransit.com/v5/index.php',
  API_BASE_URL_STAGING: 'https://api.peaktransit.com/v5/index.php',
  API_BASE_URL_PROD: 'https://api.peaktransit.com/v5/index.php',
  GOOGLE_MAPS_API_KEY: 'AIzaSyCFJfxZm2aZljV_kUbxRAIbf9E1jOXsnsY',
  APP_VERSION: '0.0.1',
  ENABLE_LOGGING: __DEV__,
};

export const env = defaultConfig;

export const getApiBaseUrl = (): string => {
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
