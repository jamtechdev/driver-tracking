/**
 * Vehicle Checklist API - Peak Transit getchecklist & submitchecklist
 */

import axios from 'axios';
import { API_CONFIG, CHECKLIST_GET_BASE_URL, CHECKLIST_SUBMIT_BASE_URL } from '@/config/api.config';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';

/** Checklist item from API (getchecklist response). */
export interface ChecklistItemApi {
  itemID?: string;
  itemName?: string;
  itemType?: string; // 'boolean' | 'number' | 'date' | 'string' | 'image' | 'group'
  itemUnit?: string;
  required?: string;
  sequence?: string | number;
  checklistID?: string;
  id?: string;
  name?: string;
  category?: string;
  [key: string]: unknown;
}

/** Previous submission from getchecklist response (results array). */
export interface ChecklistSubmissionApi {
  resultID?: string;
  agencyID?: string;
  code?: string;
  received?: string;
  [key: string]: unknown;
}

/** Get checklist response - array of items or wrapped in a key; may include results. */
export interface GetChecklistResponse {
  checklist?: ChecklistItemApi[];
  items?: ChecklistItemApi[];
  results?: ChecklistSubmissionApi[];
  [key: string]: unknown;
}

/** Full getchecklist response for modal (items + previous submissions). */
export interface GetChecklistFullResponse {
  items: ChecklistItemApi[];
  results: ChecklistSubmissionApi[];
}

/** Item status for submit: 1 = pass, 0 = fail, -1 or omit = n/a (common pattern). */
export interface ChecklistItemSubmit {
  checklistID?: string;
  id?: string;
  itemID?: string;
  status?: number; // 1 pass, 0 fail, -1 na
  value?: string | number; // for string, number, date
  imageBase64?: string; // optional for image type
  [key: string]: unknown;
}

/** Submit request body. */
export type SubmitChecklistPayload = ChecklistItemSubmit[] | Record<string, unknown>;

/**
 * Fetch checklist for a vehicle (items + previous submissions).
 * GET .../action=getchecklist&vehicleID=...&agencyID=...
 */
export const getChecklist = async (
  vehicleID: string,
  agencyID?: string
): Promise<GetChecklistFullResponse> => {
  const aid = agencyID ?? String(PEAK_DEFAULT_PARAMS.agencyID);
  const url = `${CHECKLIST_GET_BASE_URL}&vehicleID=${encodeURIComponent(vehicleID)}&agencyID=${encodeURIComponent(aid)}`;
  if (__DEV__) {
    console.log('[Checklist API] GET getchecklist', url);
  }
  const response = await axios.get<GetChecklistResponse>(url, {
    timeout: API_CONFIG.TIMEOUT,
  });
  const data = response.data;
  console.log('[Checklist API] GET getchecklist', data);
  let items: ChecklistItemApi[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === 'object') {
    const list =
      data.checklist ??
      data.items ??
      data.data ??
      data.result ??
      data.checklistItems ??
      (Array.isArray((data as any).checklist) ? (data as any).checklist : null);
    items = Array.isArray(list) ? list : [];
  }
  const results: ChecklistSubmissionApi[] = Array.isArray((data as GetChecklistResponse)?.results)
    ? (data as GetChecklistResponse).results!
    : [];
  return { items, results };
};

/**
 * Submit checklist.
 * POST .../action=submitchecklist&vehicleID=...&driverID=...&agencyID=...&hasFail=0|1
 * Body: JSON checklist payload (array of { checklistID, status } or API-defined shape).
 */
export const submitChecklist = async (
  vehicleID: string,
  driverID: string,
  agencyID: string | undefined,
  hasFail: 0 | 1,
  payload: SubmitChecklistPayload
): Promise<void> => {
  const aid = agencyID ?? String(PEAK_DEFAULT_PARAMS.agencyID);
  const url = `${CHECKLIST_SUBMIT_BASE_URL}&vehicleID=${encodeURIComponent(vehicleID)}&driverID=${encodeURIComponent(driverID)}&agencyID=${encodeURIComponent(aid)}&hasFail=${hasFail}`;
  await axios.post(url, payload, {
    timeout: API_CONFIG.TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });
};
