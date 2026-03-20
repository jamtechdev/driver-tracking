/**
 * API Configuration
 * Centralized API endpoint definitions
 */

import { getApiBaseUrl } from './env';

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
};

/** Full URL for driver data (agency, vehicles, routes, drivers, messages, stops). Use this for all “get everything” calls. */
export { DRIVER_DATA_API_URL, INCOMING_MESSAGES_BASE_URL, CHECKLIST_GET_BASE_URL, CHECKLIST_SUBMIT_BASE_URL, VEHICLE_LIST_URL, VEHICLE_ASSIGN_BASE_URL, VEHICLE_ASSIGNMENT_INFO_URL } from './env';

/** Base URL for driver vehicle self-assign (Peak Transit: vehicleassignments/selfupdate). Append routeID, vehicleID, driverID. */
export const DRIVER_VEHICLE_SELECT_BASE_URL =
  'https://api.peaktransit.com/v5/index.php/?app_id=DR&key=005b0274ca5e97ceb3d804077113792c&controller=vehicleassignments&action=selfupdate&source=MDT&agencyID=121';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    LOGIN_PIN: '/auth/login/pin',
    SUPERVISOR_LOGIN: '/auth/supervisor/login',
    LOGOUT: '/auth/logout',
    REFRESH_TOKEN: '/auth/refresh',
    VERIFY_SESSION: '/auth/verify',
  },
  // Routes
  ROUTES: {
    LIST: '/routes',
    AVAILABLE: '/routes/available',
    ASSIGN: '/routes/assign',
    DETAILS: (routeId: string) => `/routes/${routeId}`,
    SYNC: '/routes/sync',
  },

  // Passengers & Fares
  PASSENGERS: {
    TALLY: '/passengers/tally',
    SYNC: '/passengers/sync',
    HISTORY: '/passengers/history',
  },
  // Messaging
  MESSAGING: {
    SEND: '/messages/send',
    RECEIVE: '/messages/receive',
    CANNED: '/messages/canned',
    MARK_READ: (messageId: string) => `/messages/${messageId}/read`,
  },

  // Inspections
  INSPECTIONS: {
    PRE_TRIP: '/inspections/pre-trip',
    POST_TRIP: '/inspections/post-trip',
    SUBMIT: '/inspections/submit',
  },

  // Location
  LOCATION: {
    UPDATE: '/location/update',
    SYNC: '/location/sync',
  },

  // Driver self vehicle select (path only; full URL is DRIVER_VEHICLE_SELECT_BASE_URL)
  DRIVER_VEHICLE_SELECT: '/driver/vehicle/select',
};

