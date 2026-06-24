/**
 * @deprecated Replaced by iOS-parity logic in `src/features/adherence/` (DirectionModel).
 * Kept for legacy tests only; DriverModelContext no longer uses GPS-distance visit tracking.
 */

import { calculateDistance } from '@/utils/helpers';

export const ROUTE_ARRIVAL_THRESHOLD_METERS = 50;
/** When closer to the following stop than the current one by this margin, treat current as passed. */
export const ROUTE_PASS_BY_MARGIN_METERS = 40;

export interface RouteProgressLocation {
  latitude: number;
  longitude: number;
}

export interface RouteProgressStop {
  link: number;
  longName?: string;
  lat?: number;
  lng?: number;
}

export interface RouteProgressResult {
  visitedLinks: Set<number>;
  nextStop: RouteProgressStop | null;
  changed: boolean;
}

const hasCoords = (stop: RouteProgressStop): stop is RouteProgressStop & { lat: number; lng: number } =>
  stop.lat != null && stop.lng != null;

const distToStop = (loc: RouteProgressLocation, stop: RouteProgressStop): number | null => {
  if (!hasCoords(stop)) return null;
  return calculateDistance(loc.latitude, loc.longitude, stop.lat, stop.lng);
};

/** First schedule stop not yet visited (schedule order). */
export const findNextScheduleStop = <T extends RouteProgressStop>(
  schedule: T[],
  visitedLinks: Set<number>,
): T | null => schedule.find((s) => !visitedLinks.has(s.link)) ?? null;

/**
 * Advance visited links from GPS and resolve the next stop on the route.
 */
export function advanceRouteProgress<T extends RouteProgressStop>(
  location: RouteProgressLocation,
  schedule: T[],
  visitedLinks: ReadonlySet<number>,
): RouteProgressResult & { nextStop: T | null } {
  if (schedule.length === 0) {
    return { visitedLinks: new Set(), nextStop: null, changed: false };
  }

  const visited = new Set(visitedLinks);

  for (const stop of schedule) {
    const d = distToStop(location, stop);
    if (d != null && d < ROUTE_ARRIVAL_THRESHOLD_METERS) {
      visited.add(stop.link);
    }
  }

  let passByApplied = false;
  let next = findNextScheduleStop(schedule, visited);
  while (next) {
    const idx = schedule.findIndex((s) => s.link === next!.link);
    const following = idx >= 0 && idx < schedule.length - 1 ? schedule[idx + 1] : null;
    if (!following || !hasCoords(next) || !hasCoords(following)) break;

    const dCurrent = distToStop(location, next)!;
    const dFollowing = distToStop(location, following)!;
    if (dFollowing + ROUTE_PASS_BY_MARGIN_METERS < dCurrent && dCurrent > ROUTE_PASS_BY_MARGIN_METERS) {
      visited.add(next.link);
      passByApplied = true;
      next = findNextScheduleStop(schedule, visited);
      continue;
    }
    break;
  }

  const nextStop = findNextScheduleStop(schedule, visited);
  const changed =
    passByApplied ||
    visited.size !== visitedLinks.size ||
    nextStop?.link !== findNextScheduleStop(schedule, visitedLinks)?.link;

  return { visitedLinks: visited, nextStop, changed };
}

/**
 * Seed progress when schedule loads or block assignment changes (uses current GPS).
 * Stops before the nearest schedule point are treated as already served.
 */
export function seedRouteProgressFromLocation<T extends RouteProgressStop>(
  location: RouteProgressLocation | null,
  schedule: T[],
): RouteProgressResult & { nextStop: T | null } {
  if (schedule.length === 0) {
    return { visitedLinks: new Set(), nextStop: null, changed: true };
  }
  if (!location) {
    return { visitedLinks: new Set(), nextStop: schedule[0], changed: true };
  }

  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < schedule.length; i++) {
    const d = distToStop(location, schedule[i]);
    if (d != null && d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const visited = new Set<number>();
  for (let i = 0; i < bestIdx; i++) {
    visited.add(schedule[i].link);
  }

  return advanceRouteProgress(location, schedule, visited);
}
