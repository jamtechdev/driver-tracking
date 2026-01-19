/**
 * Authentication API calls
 */

import apiClient from './client';
import { API_ENDPOINTS } from './endpoints';
import { setAuthTokens, clearAuthTokens } from './client';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface PinLoginCredentials {
  driverId: string;
  pin: string;
}

export interface SupervisorLoginCredentials {
  supervisorId: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    role: 'driver' | 'supervisor';
  };
}

export const authApi = {
  /**
   * Driver login with username/password
   */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    await setAuthTokens(response.data.token, response.data.refreshToken);
    return response.data;
  },

  /**
   * Driver login with PIN
   */
  loginWithPin: async (credentials: PinLoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN_PIN,
      credentials
    );
    await setAuthTokens(response.data.token, response.data.refreshToken);
    return response.data;
  },

  /**
   * Supervisor login
   */
  supervisorLogin: async (credentials: SupervisorLoginCredentials): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.SUPERVISOR_LOGIN,
      credentials
    );
    await setAuthTokens(response.data.token, response.data.refreshToken);
    return response.data;
  },

  /**
   * Logout
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } finally {
      await clearAuthTokens();
    }
  },

  /**
   * Verify current session
   */
  verifySession: async (): Promise<boolean> => {
    try {
      await apiClient.get(API_ENDPOINTS.AUTH.VERIFY_SESSION);
      return true;
    } catch {
      return false;
    }
  },
};

