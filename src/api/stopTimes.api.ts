/**
 * Stop Times API — Peak Transit ordered stops for a trip.
 *
 * Base:
 *   .../controller=stoptimes&action=list&agencyID=...
 * Assigned trip (required for turn-by-turn order):
 *   ...&tripID=XXX   ← camelCase tripID (lowercase "tripid" does NOT filter on Peak)
 *
 * Sort resulting stopTimes by `sequence` ascending, then take stopIDs in that order.
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';

export interface StopTimeRow {
  stopTimeID?: number;
  agencyID?: number;
  tripID: number;
  stopID: number;
  sequence: number;
  arrivalTime?: string;
  departureTime?: string;
  link?: number;
  unscheduled?: boolean | number;
  calculatedArrivalTime?: string | number;
  [key: string]: unknown;
}

export interface StopTimesListResponse {
  success?: boolean;
  stopTimes?: StopTimeRow[];
  [key: string]: unknown;
}

const AGENCY_CACHE_TTL_MS = 5 * 60 * 1000;
let agencyStopTimesCache: {
  agencyID: string;
  fetchedAt: number;
  rows: StopTimeRow[];
} | null = null;

function buildStopTimesUrl(
  agencyID: string | number,
  tripID?: string | number | null,
): string {
  let url =
    `${PEAK_BASE_URL}` +
    `&controller=stoptimes&action=list` +
    `&agencyID=${encodeURIComponent(String(agencyID))}`;
  // Peak requires camelCase tripID — "tripid" returns the full agency list.
  if (tripID != null && String(tripID).trim() !== '') {
    url += `&tripID=${encodeURIComponent(String(tripID))}`;
  }
  return url;
}

/** Full agency stopTimes list (cached briefly). Used only to discover tripID when none assigned. */
export const getAgencyStopTimes = async (
  agencyID: string | number,
): Promise<StopTimeRow[]> => {
  const key = String(agencyID);
  const now = Date.now();
  if (
    agencyStopTimesCache &&
    agencyStopTimesCache.agencyID === key &&
    now - agencyStopTimesCache.fetchedAt < AGENCY_CACHE_TTL_MS
  ) {
    return agencyStopTimesCache.rows;
  }

  const response = await axios.get<StopTimesListResponse>(buildStopTimesUrl(agencyID), {
    timeout: 60000,
  });
  const rows = Array.isArray(response.data?.stopTimes) ? response.data.stopTimes : [];
  agencyStopTimesCache = { agencyID: key, fetchedAt: now, rows };
  return rows;
};

/** Fetch stopTimes for one assigned trip (`&tripID=`), then keep only that trip's rows. */
export const getStopTimesForTrip = async (
  agencyID: string | number,
  tripID: string | number,
): Promise<StopTimeRow[]> => {
  const response = await axios.get<StopTimesListResponse>(
    buildStopTimesUrl(agencyID, tripID),
    { timeout: 30000 },
  );

  const rows = Array.isArray(response.data?.stopTimes) ? response.data.stopTimes : [];
  return rows.filter((row) => String(row.tripID) === String(tripID));
};

/**
 * Pick tripID dynamically from stoptimes by matching the route's stopIDs.
 * Chooses the trip that shares the most stopIDs with the route.
 */
export function resolveTripIdFromRouteStopIds(
  routeStopIds: Array<string | number> | null | undefined,
  stopTimes: StopTimeRow[],
): string | null {
  if (!routeStopIds?.length || stopTimes.length === 0) return null;

  const routeSet = new Set(
    routeStopIds.map(String).filter((id) => id && id !== '0'),
  );
  if (routeSet.size === 0) return null;

  const overlapByTrip = new Map<string, number>();
  const seenStopByTrip = new Map<string, Set<string>>();

  for (const row of stopTimes) {
    const tripKey = String(row.tripID ?? '');
    const stopKey = String(row.stopID ?? '');
    if (!tripKey || !stopKey || stopKey === '0') continue;
    if (!routeSet.has(stopKey)) continue;

    let seen = seenStopByTrip.get(tripKey);
    if (!seen) {
      seen = new Set();
      seenStopByTrip.set(tripKey, seen);
    }
    if (seen.has(stopKey)) continue;
    seen.add(stopKey);
    overlapByTrip.set(tripKey, (overlapByTrip.get(tripKey) ?? 0) + 1);
  }

  let bestTrip: string | null = null;
  let bestCount = 0;
  for (const [tripKey, count] of overlapByTrip) {
    if (count > bestCount) {
      bestCount = count;
      bestTrip = tripKey;
    }
  }

  const minMatch = Math.min(3, routeSet.size);
  if (!bestTrip || bestCount < minMatch) return null;
  return bestTrip;
}

/**
 * Sort stopTimes by `sequence` ascending and return unique stopIDs in that order.
 * This is the ordered list used for Mapbox turn-by-turn.
 */
export function extractOrderedStopIdsFromStopTimes(
  stopTimes: StopTimeRow[],
): Array<string | number> {
  const sorted = [...stopTimes].sort(
    (a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0),
  );

  const ids: Array<string | number> = [];
  const seen = new Set<string>();
  for (const row of sorted) {
    if (row.stopID == null) continue;
    const key = String(row.stopID);
    if (!key || key === '0' || seen.has(key)) continue;
    seen.add(key);
    ids.push(row.stopID);
  }
  return ids;
}

/** @internal test helper — clear agency cache between tests. */
export function __resetAgencyStopTimesCacheForTests(): void {
  agencyStopTimesCache = null;
}
