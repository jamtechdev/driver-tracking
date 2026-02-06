/**
 * Driver message API – same endpoint for all driver messages (emergency, canned, etc.).
 * Peak Transit: controller=driver&action=message
 * Used for: EMERGENCY MODE ACTIVATED, EMERGENCY MODE cleared, and other driver messages.
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';

const TIMEOUT = API_CONFIG.TIMEOUT;

export interface SendDriverMessageParams {
  agencyID: string | number;
  vehicleID: string | number;
  driverID: string | number;
  lat: number;
  lng: number;
  message: string;
}

/**
 * Send a driver message (emergency activate/clear, canned message, etc.).
 * Message is percent-encoded. GET request per DriverModel.m sendMessage:.
 */
export async function sendDriverMessage(params: SendDriverMessageParams): Promise<void> {
  const url =
    `${PEAK_BASE_URL}&controller=driver&action=message` +
    `&agencyID=${encodeURIComponent(String(params.agencyID))}` +
    `&vehicleID=${encodeURIComponent(String(params.vehicleID))}` +
    `&driverID=${encodeURIComponent(String(params.driverID))}` +
    `&lat=${encodeURIComponent(String(params.lat))}` +
    `&lng=${encodeURIComponent(String(params.lng))}` +
    `&message=${encodeURIComponent(params.message)}`;
  await axios.get(url, { timeout: TIMEOUT });
}
