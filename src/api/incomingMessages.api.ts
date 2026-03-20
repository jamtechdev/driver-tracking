/**
 * Incoming Messages API - Peak Transit driver getMessages
 * GET .../controller=driver&action=getMessages&agencyID=...&vehicleID=...&to=1
 */

import axios from 'axios';
import { API_CONFIG, INCOMING_MESSAGES_BASE_URL } from '@/config/api.config';

export interface IncomingMessageItem {
  messageID: string;
  agencyID: string;
  vehicleID: string;
  driverID: string;
  message: string;
  received: string;
  lat: string;
  lng: string;
  read: string;
  userID: string;
  toVehicle: string;
  created: string;
  updated: string;
  disabled: string;
  deleted: string | null;
  vehicleName: string;
  driverName: string;
  userName: string | null;
  secondsAgo: string;
  [key: string]: unknown;
}

export interface GetMessagesResponse {
  message?: IncomingMessageItem[];
  [key: string]: unknown;
}

/** Fetch incoming messages. If vehicleID is provided, filter for it, else get all for agency. */
export const getIncomingMessages = async (
  agencyID: string,
  vehicleID?: string | null,
  isToVehicle: boolean = false
): Promise<IncomingMessageItem[]> => {
  let url = `${INCOMING_MESSAGES_BASE_URL}&agencyID=${encodeURIComponent(agencyID)}`;

  if (vehicleID) {
    url += `&vehicleID=${encodeURIComponent(vehicleID)}&to=1`;
  } else if (isToVehicle) {
    url += '&to=1';
  }
  const response = await axios.get<GetMessagesResponse>(url, {
    timeout: API_CONFIG.TIMEOUT,
  });
  const list = response.data?.message;
  return Array.isArray(list) ? list : response.data;
};
