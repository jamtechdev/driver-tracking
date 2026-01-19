/**
 * Authentication Service
 * Business logic for authentication
 */

import { authApi, LoginCredentials, PinLoginCredentials, SupervisorLoginCredentials } from '@/api/auth.api';
import { AppDispatch } from '@/store';
import { loginStart, loginSuccess, loginFailure, logout as logoutAction } from '@/store/slices/auth.slice';

export const authService = {
  /**
   * Login with username/password
   */
  login: async (credentials: LoginCredentials, dispatch: AppDispatch) => {
    dispatch(loginStart());
    try {
      const response = await authApi.login(credentials);
      dispatch(loginSuccess({ user: response.user, token: response.token }));
      return { success: true, user: response.user };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Login with PIN
   */
  loginWithPin: async (credentials: PinLoginCredentials, dispatch: AppDispatch) => {
    dispatch(loginStart());
    try {
      const response = await authApi.loginWithPin(credentials);
      dispatch(loginSuccess({ user: response.user, token: response.token }));
      return { success: true, user: response.user };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'PIN login failed';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Supervisor login
   */
  supervisorLogin: async (credentials: SupervisorLoginCredentials, dispatch: AppDispatch) => {
    dispatch(loginStart());
    try {
      const response = await authApi.supervisorLogin(credentials);
      dispatch(loginSuccess({ user: response.user, token: response.token }));
      return { success: true, user: response.user };
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Supervisor login failed';
      dispatch(loginFailure(errorMessage));
      return { success: false, error: errorMessage };
    }
  },

  /**
   * Logout
   */
  logout: async (dispatch: AppDispatch) => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      dispatch(logoutAction());
    }
  },
};

