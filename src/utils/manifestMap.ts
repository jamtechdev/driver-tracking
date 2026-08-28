/**
 * Block manifest helpers for map display.
 * manifestJson is a JSON array of trip/exception entries; trips include routeID.
 */

import { isAssignedRouteId } from '@/utils/helpers';

export interface ManifestJsonEntry {
  type?: string;
  routeID?: number | string;
  id?: number;
  [key: string]: unknown;
}

/** Parse manifestJson; returns [] on invalid input. */
export const parseManifestJsonEntries = (manifestJson: string | undefined | null): ManifestJsonEntry[] => {
  if (!manifestJson || typeof manifestJson !== 'string') return [];
  try {
    const parsed = JSON.parse(manifestJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Unique route IDs from trip entries in manifestJson (order preserved). */
export const getRouteIdsFromManifestJson = (manifestJson: string | undefined | null): string[] => {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const entry of parseManifestJsonEntries(manifestJson)) {
    if (entry.type !== 'trip') continue;
    const routeId = entry.routeID;
    if (routeId === undefined || routeId === null || routeId === '') continue;
    const key = String(routeId);
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(key);
    }
  }
  return ids;
};

/** Primary route for a block (most frequent trip routeID, else first). */
export const getPrimaryRouteIdFromManifestJson = (
  manifestJson: string | undefined | null,
): string | null => {
  const counts = new Map<string, number>();
  for (const entry of parseManifestJsonEntries(manifestJson)) {
    if (entry.type !== 'trip') continue;
    const routeId = entry.routeID;
    if (routeId === undefined || routeId === null || routeId === '') continue;
    const key = String(routeId);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: string | null = null;
  let bestCount = -1;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
};

/** Peak block times are usually HHMM (e.g. 615 = 06:15). Overnight may exceed 2400. */
function manifestTimeToMinutes(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  // Already looks like minutes-since-midnight with small values used as plain minutes.
  // HHMM: minutes component must be 0–59.
  const hours = Math.floor(value / 100);
  const mins = value % 100;
  if (mins >= 0 && mins < 60 && hours >= 0 && hours < 48) {
    return hours * 60 + mins;
  }
  return value;
}

/**
 * Active / assigned trip id from block manifestJson.
 * Prefers the trip whose startTime–endTime window covers now. Falls back to first trip for route.
 */
export const getAssignedTripIdFromManifestJson = (
  manifestJson: string | undefined | null,
  options?: {
    routeId?: string | number | null;
    nowMinutes?: number;
  },
): string | null => {
  const entries = parseManifestJsonEntries(manifestJson).filter(
    (entry) => entry.type === 'trip' && entry.id != null && String(entry.id).trim() !== '',
  );
  if (entries.length === 0) return null;

  const routeKey =
    options?.routeId != null && String(options.routeId).trim() !== ''
      ? String(options.routeId)
      : null;
  const scoped = routeKey
    ? entries.filter((entry) => String(entry.routeID ?? '') === routeKey)
    : entries;
  const pool = scoped.length > 0 ? scoped : entries;

  const now =
    options?.nowMinutes ??
    (() => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    })();

  const inWindow = pool.find((entry) => {
    const start = manifestTimeToMinutes(Number(entry.startTime));
    const end = manifestTimeToMinutes(Number(entry.endTime));
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (end >= start) return now >= start && now < end;
    // Overnight window (e.g. 22:00 → 02:00 next day).
    return now >= start || now < end;
  });
  if (inWindow?.id != null) return String(inWindow.id);

  return pool[0]?.id != null ? String(pool[0].id) : null;
};

/**
 * Route ID used for vehicle updates / schedule when a block is assigned.
 * Prefers explicit route selection; falls back to primary trip route from manifestJson.
 */
export const resolveEffectiveRouteId = (
  selectedRouteId: string | null | undefined,
  manifestJson?: string | null,
): string | null => {
  if (isAssignedRouteId(selectedRouteId)) {
    return String(selectedRouteId);
  }
  const fromManifest = getPrimaryRouteIdFromManifestJson(manifestJson);
  return isAssignedRouteId(fromManifest) ? fromManifest : null;
};
