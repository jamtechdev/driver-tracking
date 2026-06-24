/**
 * Peak Transit user login — controller=user&action=login
 */

import axios from 'axios';
import { getApiBaseUrl, PEAK_APP_ID, PEAK_APP_KEY } from '@/config/env';
import type { PeakLoginUser } from '@/services/agencySession.service';

export interface PeakUserLoginResponse {
  success: boolean;
  user?: PeakLoginUser;
  errormsg?: string;
  message?: string;
}

export interface PeakUserLoginCredentials {
  email: string;
  passwd: string;
}

export interface PeakForgotPasswordPayload {
  email: string;
}

export interface PeakResetPasswordPayload {
  email: string;
  resetKey: string;
  passwd: string;
}

function loginErrorMessage(
  error: unknown,
  response?: PeakUserLoginResponse,
): string {
  if (response?.errormsg || response?.message) {
    return String(response.errormsg || response.message);
  }

  if (axios.isAxiosError(error)) {
    const data = error.response?.data as PeakUserLoginResponse | undefined;

    if (data?.errormsg || data?.message) {
      return String(data.errormsg || data.message);
    }

    return error.message || 'Login request failed';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Login failed. Please check your username and password.';
}

function requestErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ||
      error.response?.data?.errormsg ||
      error.message ||
      'Request failed'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Something went wrong.';
}

export async function peakUserLogin(
  credentials: PeakUserLoginCredentials,
): Promise<PeakUserLoginResponse> {
  const body = new URLSearchParams({
    app_id: PEAK_APP_ID,
    key: PEAK_APP_KEY,
    controller: 'user',
    action: 'login',
    email: credentials.email.trim(),
    passwd: credentials.passwd,
  }).toString();

  try {
    const response = await axios.post<PeakUserLoginResponse>(
      getApiBaseUrl(),
      body,
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as PeakUserLoginResponse;
      throw new Error(loginErrorMessage(error, data));
    }

    throw new Error(loginErrorMessage(error));
  }
}

/**
 * controller=user&action=forgotpassword
 */
export async function peakForgotPassword(
  payload: PeakForgotPasswordPayload,
) {
  const body = new URLSearchParams({
    app_id: PEAK_APP_ID,
    key: PEAK_APP_KEY,
    controller: 'user',
    action: 'forgotpassword',
    email: payload.email.trim(),
  }).toString();

  try {
    const response = await axios.post(
      getApiBaseUrl(),
      body,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(requestErrorMessage(error));
  }
}

/**
 * controller=user&action=resetpassword
 */
export async function peakResetPassword(
  payload: PeakResetPasswordPayload,
) {
  const body = new URLSearchParams({
    app_id: PEAK_APP_ID,
    key: PEAK_APP_KEY,
    controller: 'user',
    action: 'resetpassword',
    email: payload.email.trim(),
    resetKey: payload.resetKey.trim(),
    passwd: payload.passwd,
  }).toString();

  try {
    const response = await axios.post(
      getApiBaseUrl(),
      body,
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    );

    return response.data;
  } catch (error) {
    throw new Error(requestErrorMessage(error));
  }
}