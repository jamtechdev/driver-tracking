/**
 * Incoming Messages API - Peak Transit driver getMessages
 * GET .../controller=driver&action=getMessages&agencyID=...&vehicleID=...&to=1
 */

import axios from 'axios';
import { API_CONFIG, INCOMING_MESSAGES_BASE_URL } from '@/config/api.config';

export interface IncomingMessageItem {
  messageID: string;
  message: string;
  userName?: string;
  [key: string]: unknown;
}

export interface GetMessagesResponse {
  message?: IncomingMessageItem[];
  [key: string]: unknown;
}

/** Fetch incoming messages for the current vehicle. */
export const getIncomingMessages = async (
  agencyID: string,
  vehicleID: string
): Promise<IncomingMessageItem[]> => {
  const url = `${INCOMING_MESSAGES_BASE_URL}&agencyID=${encodeURIComponent(agencyID)}&vehicleID=${encodeURIComponent(vehicleID)}`;
  const response = await axios.get<GetMessagesResponse>(url, {
    timeout: API_CONFIG.TIMEOUT,
  });
  const list = response.data?.message;
  return Array.isArray(list) ? list : [];
};
