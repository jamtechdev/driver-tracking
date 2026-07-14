/**
 * Agency feature flags — Peak Transit controller=agency&action=featureValues
 */

import axios from 'axios';
import { API_CONFIG } from '@/config/api.config';
import { getApiBaseUrl, PEAK_APP_ID, PEAK_APP_KEY } from '@/config/env';

export const MDT_TURN_BY_TURN_FEATURE_NAME = 'MDTTURNBYTURN';

export interface AgencyFeatureValue {
  featureID: number;
  name: string;
  description?: string | null;
  featureValue: boolean | string | number;
}

export interface FeatureValuesResponse {
  featureValues?: AgencyFeatureValue[];
  agencyID?: number | string;
  success?: boolean;
  errormsg?: string;
  message?: string;
}

function coerceFeatureBool(value: unknown): boolean {
  if (value === true || value === 1 || value === '1') return true;
  if (typeof value === 'string' && value.trim().toLowerCase() === 'true') {
    return true;
  }
  return false;
}

/** All feature flags for an agency (or defaults if agencyID omitted). */
export async function fetchAgencyFeatureValues(
  agencyID?: string | number | null,
  featureID?: number | string | null,
): Promise<AgencyFeatureValue[]> {
  const params: Record<string, string> = {
    app_id: PEAK_APP_ID,
    key: PEAK_APP_KEY,
    controller: 'agency',
    action: 'featureValues',
  };

  if (agencyID != null && String(agencyID).trim() !== '') {
    params.agencyID = String(agencyID);
  }
  if (featureID != null && String(featureID).trim() !== '') {
    params.featureID = String(featureID);
  }

  const body = new URLSearchParams(params).toString();
  const response = await axios.post<FeatureValuesResponse>(
    getApiBaseUrl(),
    body,
    {
      timeout: API_CONFIG.TIMEOUT,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );

  const list = response.data?.featureValues;
  return Array.isArray(list) ? list : [];
}

/** True when named flag is enabled for the agency. */
export async function isAgencyFeatureEnabled(
  agencyID: string | number,
  featureName: string,
): Promise<boolean> {
  const features = await fetchAgencyFeatureValues(agencyID);
  const match = features.find(
    f => String(f.name ?? '').toUpperCase() === featureName.toUpperCase(),
  );
  return coerceFeatureBool(match?.featureValue);
}

export async function isMdtTurnByTurnEnabled(
  agencyID: string | number,
): Promise<boolean> {
  return isAgencyFeatureEnabled(agencyID, MDT_TURN_BY_TURN_FEATURE_NAME);
}
