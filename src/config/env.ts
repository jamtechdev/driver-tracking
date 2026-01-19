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

// Default values - Update these with your actual values
// In production, use react-native-config to load from .env
const defaultConfig: EnvConfig = {
  API_BASE_URL: __DEV__ ? 'http://localhost:3000/api' : 'https://api.example.com/api',
  API_BASE_URL_DEV: 'http://dev-api.example.com/api',
  API_BASE_URL_STAGING: 'http://staging-api.example.com/api',
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

