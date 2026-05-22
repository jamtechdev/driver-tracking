/**
 * Block manifest helpers for map display.
 * manifestJson is a JSON array of trip/exception entries; trips include routeID.
 */

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
