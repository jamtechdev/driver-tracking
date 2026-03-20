/**
 * API Client
 * Centralized Axios instance with interceptors
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Toast from 'react-native-toast-message';
import { API_CONFIG } from '@/config/api.config';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = '@driver_tracking:auth_token';
const REFRESH_TOKEN_KEY = '@driver_tracking:refresh_token';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add Peak Transit default params and auth token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // When using Peak API base (index.php with no query), add default query params so agencyID stays 121
      const baseUrl = config.baseURL ?? API_CONFIG.BASE_URL;
      if (typeof baseUrl === 'string' && baseUrl.includes('peaktransit.com') && baseUrl.includes('index.php') && !baseUrl.includes('?')) {
        config.params = { ...PEAK_DEFAULT_PARAMS, ...config.params };
      }
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      // console.log('Request Config:', config);

    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Toast for each request, handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    const method = response.config.method?.toUpperCase() ?? 'Request';
    const url = typeof response.config.url === 'string' ? response.config.url : '';
    const label = url.split('?')[0].split('/').filter(Boolean).pop() || 'API';
    // Toast.show({
    //   type: 'success',
    //   text1: 'Success',
    //   text2: `${method} ${label} completed`,
    //   visibilityTime: 2000,
    // });
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized - Try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await axios.post(
            `${API_CONFIG.BASE_URL}/auth/refresh`,
            { refreshToken }
          );

          const { token, refreshToken: newRefreshToken } = response.data;
          await AsyncStorage.setItem(TOKEN_KEY, token);
          await AsyncStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - clear storage and redirect to login
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
        return Promise.reject(refreshError);
      }
    }

    const message = error.response?.data?.errormsg
      ?? error.response?.data?.message
      ?? error.message
      ?? 'Request failed';
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: String(message),
      visibilityTime: 3000,
    });
    return Promise.reject(error);
  }
);

export default apiClient;

// Helper functions for token management
export const setAuthTokens = async (token: string, refreshToken: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
};

export const clearAuthTokens = async (): Promise<void> => {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
};

export const getAuthToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem(TOKEN_KEY);
};

