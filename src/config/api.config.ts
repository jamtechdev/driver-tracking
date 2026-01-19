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
};

