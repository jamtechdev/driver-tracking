/**
 * Driver Data API - Single Peak Transit endpoint for agency, vehicles, routes, drivers, messages, stops.
 * URL: .../index.php/?app_id=DR&key=...&controller=driver&action=data&agencyID=121
 */

import axios from 'axios';
import Toast from 'react-native-toast-message';
import { API_CONFIG, DRIVER_DATA_API_URL } from '@/config/api.config';

export interface DriverDataRoute {
  routeID: string;
  agencyID?: string;
  shortName?: string;
  longName?: string;
  description?: string;
  disabled?: string | number | boolean;
  hidden?: string | number | boolean;
  [key: string]: unknown;
}

export interface DriverDataVehicle {
  vehicleID?: string;
  vehicleNumber?: string;
  vehicleName?: string;
  [key: string]: unknown;
}

export interface DriverDataDriver {
  driverID: string;
  driverName?: string;
  code?: string;
  supervisor?: string | number;
  [key: string]: unknown;
}

export interface DriverDataMessage {
  messageID: string;
  message: string;
  [key: string]: unknown;
}

export interface DriverDataResponse {
  success?: boolean;
  agency?: Record<string, unknown>;
  vehicle?: DriverDataVehicle[];
  route?: DriverDataRoute[];
  driver?: DriverDataDriver[];
  messages?: DriverDataMessage[];
  stop?: unknown[];
  [key: string]: unknown;
}

/** Fetch all driver data (agency, vehicles, routes, drivers, etc.) from the single Peak API. */
export const getDriverData = async (): Promise<DriverDataResponse> => {
  try {
    const response = await axios.get<DriverDataResponse>(DRIVER_DATA_API_URL, {
      timeout: API_CONFIG.TIMEOUT,
    });
    return response.data;
  } catch (error: unknown) {
    const message = axios.isAxiosError(error)
      ? (error.response?.data as { errormsg?: string })?.errormsg ?? error.message
      : error instanceof Error ? error.message : 'Failed to load driver data';
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: String(message),
      visibilityTime: 3000,
    });
    throw error;
  }
};
