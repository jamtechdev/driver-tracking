/**
 * Agency feature flags — Peak Transit
 * POST controller=agency&action=featureValues
 *
 * Examples:
 * - Agency all flags:     agencyID=29
 * - Agency + one flag:    agencyID=29&featureID=1
 * - Default for one flag: featureID=3
 * - All defaults:         (no agencyID / featureID)
 */

import axios from 'axios';
import { API_CONFIG } from '@/config/api.config';
import { getApiBaseUrl, PEAK_APP_ID, PEAK_APP_KEY } from '@/config/env';

/** Flag name for Mapbox / MDT turn-by-turn (match case-insensitive). */
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
  success?: boolean | string;
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

function isSuccessResponse(data: FeatureValuesResponse | undefined): boolean {
  if (!data) return false;
  if (data.success === false || data.success === 'false') {
    return false;
  }
  // Peak returns success:true with featureValues[]; accept list if present
  if (Array.isArray(data.featureValues)) return true;
  return data.success === true || data.success === 'true';
}

/** AgencyID must be numeric for Peak — non-numeric → HTTP 400 "not active". */
export function isValidAgencyIdForFeatures(agencyID: string | number | null | undefined): boolean {
  if (agencyID == null) return false;
  const raw = String(agencyID).trim();
  if (!raw) return false;
  return /^\d+$/.test(raw);
}

/**
 * Fetch feature flags.
 * Prefer: agencyID only → all flags for that agency (recommended for MDTTURNBYTURN).
 */
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
    params.agencyID = String(agencyID).trim();
  }
  if (featureID != null && String(featureID).trim() !== '') {
    params.featureID = String(featureID).trim();
  }

  const body = new URLSearchParams(params).toString();

  try {
    const response = await axios.post<FeatureValuesResponse>(getApiBaseUrl(), body, {
      timeout: API_CONFIG.TIMEOUT,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Avoid throwing on 400/404 so we can map Peak messages cleanly
      validateStatus: status => status >= 200 && status < 500,
    });

    if (response.status === 404) {
      throw new Error('Agency not found for feature flags (404).');
    }
    if (response.status === 400) {
      const msg =
        (response.data as FeatureValuesResponse)?.errormsg ||
        (response.data as FeatureValuesResponse)?.message ||
        'Agency is not active.';
      throw new Error(String(msg));
    }

    const data = response.data;
    if (!isSuccessResponse(data)) {
      throw new Error(
        String(data?.errormsg || data?.message || 'Feature flags request failed.'),
      );
    }

    return Array.isArray(data.featureValues) ? data.featureValues : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const data = error.response.data as FeatureValuesResponse | undefined;
      const msg = data?.errormsg || data?.message || error.message;
      throw new Error(String(msg));
    }
    throw error;
  }
}

/** Find flag by name (case-insensitive). */
export function findFeatureByName(
  features: AgencyFeatureValue[],
  featureName: string,
): AgencyFeatureValue | undefined {
  const target = featureName.trim().toUpperCase();
  return features.find(f => String(f.name ?? '').trim().toUpperCase() === target);
}

/**
 * True when named flag is enabled for the agency.
 * Uses: POST featureValues + agencyID (all flags for agency), then match by name.
 * Missing flag → false (fail closed).
 */
export async function isAgencyFeatureEnabled(
  agencyID: string | number,
  featureName: string,
): Promise<boolean> {
  if (!isValidAgencyIdForFeatures(agencyID)) {
    return false;
  }

  const features = await fetchAgencyFeatureValues(agencyID);
  const match = findFeatureByName(features, featureName);

  if (__DEV__) {
    console.log('[featureValues]', {
      agencyID: String(agencyID),
      lookingFor: featureName,
      found: match
        ? { featureID: match.featureID, name: match.name, featureValue: match.featureValue }
        : null,
      enabled: coerceFeatureBool(match?.featureValue),
      totalFlags: features.length,
    });
  }

  return coerceFeatureBool(match?.featureValue);
}

export async function isMdtTurnByTurnEnabled(
  agencyID: string | number,
): Promise<boolean> {
  return isAgencyFeatureEnabled(agencyID, MDT_TURN_BY_TURN_FEATURE_NAME);
}
