/**
 * In-memory agency route list (from DriverDataContext) for bottom-bar / tab labels.
 */

import { getDriverData } from '@/api/driverData.api';
import type { DriverDataRoute } from '@/api/driverData.api';

let agencyRoutes: DriverDataRoute[] = [];
const rosterListeners = new Set<() => void>();

export function setAgencyRoutes(
  list: DriverDataRoute[],
  options?: { notify?: boolean },
): void {
  agencyRoutes = Array.isArray(list) ? list : [];
  if (options?.notify === false) return;
  rosterListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('[routeLookup] roster listener error:', e);
    }
  });
}

export function subscribeAgencyRoutesUpdated(listener: () => void): () => void {
  rosterListeners.add(listener);
  return () => {
    rosterListeners.delete(listener);
  };
}

export function findRouteLabelById(routeId: string | null | undefined): string | null {
  const id = String(routeId ?? '').trim();
  if (!id || id === '0') return null;

  const match = agencyRoutes.find((r) => String(r.routeID) === id);
  if (!match) return null;

  const short = match.shortName && String(match.shortName).trim();
  const long = match.longName && String(match.longName).trim();
  return short || long || null;
}

/** True when the stored label is a real name, not a bare route/block ID placeholder. */
export function isDisplayableRouteLabel(
  label: string | undefined | null,
  routeId: string | null,
  manifestId: number | null,
): boolean {
  const route = label?.trim();
  if (!route || route === 'Out of Service') return false;
  if (routeId && route === String(routeId).trim()) return false;
  if (manifestId != null) {
    const idStr = String(manifestId);
    if (route === idStr || route === `Block ${manifestId}`) return false;
  }
  return true;
}

export async function lookupRouteLabelById(routeId: string): Promise<string | null> {
  const cached = findRouteLabelById(routeId);
  if (cached) return cached;

  try {
    const data = await getDriverData();
    const routes = Array.isArray(data?.route) ? (data.route as DriverDataRoute[]) : [];
    setAgencyRoutes(routes, { notify: false });
    return findRouteLabelById(routeId);
  } catch (e) {
    console.warn('[routeLookup] lookupRouteLabelById failed:', e);
    return null;
  }
}
