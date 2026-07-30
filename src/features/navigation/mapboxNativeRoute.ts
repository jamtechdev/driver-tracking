/**
 * Helpers for native Mapbox Navigation multi-stop routes.
 *
 * Prefer Map Matching (agency polyline → same active-guidance engine) when
 * route.points are available. Directions stop→stop is the fallback only.
 */

import { calculateDistance } from '@/utils/helpers';
import { projectPointOnRoute } from '@/features/navigation/navigationUtils';
import type { NavigationCoordinate, NavigationStop } from './types';
import { toStopNameText } from '@/utils/stopDisplayName';

export const MIN_STOP_SEPARATION_METERS = 8;

/** Mapbox Directions API allows at most 25 coordinates per request. */
export const MAX_MAPBOX_ROUTE_COORDINATES = 25;

/** Map Matching API allows up to 100 coordinates (shape + stop waypoints). */
export const MAX_MAP_MATCHING_COORDINATES = 100;

/** Max driving distance between consecutive scheduled stops (filters bad coords). */
export const MAX_CONSECUTIVE_STOP_DISTANCE_METERS = 120_000;

/** Max session stops — origin + waypoints + destination must stay within Mapbox limit. */
export const MAX_MAPBOX_SESSION_STOPS = MAX_MAPBOX_ROUTE_COORDINATES - 1;

/**
 * When Map Matching, more stops fit because shape points fill the 100 budget.
 * Still leave room for shaping samples between stops.
 */
export const MAX_MAP_MATCHING_SESSION_STOPS = 40;

export interface MapboxNativeWaypoint {
  latitude: number;
  longitude: number;
  name: string;
  separatesLegs: boolean;
}

/** Shape + stop chain for native Map Matching (`routeCoordinates`). */
export interface MapboxRouteMatchingCoordinate {
  latitude: number;
  longitude: number;
  name?: string;
  /** True only for bus stops — silent shape points stay false. */
  separatesLegs?: boolean;
}

/** Immutable route props for one native navigation session — never update after mount. */
export interface FrozenMapboxNativeSession {
  startOrigin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number; title: string };
  waypoints: MapboxNativeWaypoint[];
  /**
   * When present (≥2), native uses Map Matching on this chain (exact agency path
   * + TBT guidance). Waypoints remain for Directions fallback if matching fails.
   */
  routeCoordinates?: MapboxRouteMatchingCoordinate[];
  /**
   * Full remaining agency shape drawn once as the visible route line.
   * Kept stable across per-leg TBT rematches so the line does not redraw stop-by-stop.
   */
  overviewRouteCoordinates?: NavigationCoordinate[];
}

export function isValidNavigationCoordinate(
  coord: { latitude: number; longitude: number } | null | undefined,
): boolean {
  if (!coord) return false;
  const { latitude, longitude } = coord;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  if (Math.abs(latitude) < 0.0001 && Math.abs(longitude) < 0.0001) return false;
  return true;
}

/** Keep route legs in schedule sequence — never reorder stops for Mapbox. */
export function sortNavigationStopsBySequence(stops: NavigationStop[]): NavigationStop[] {
  return [...stops].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
}

/** Drop invalid or consecutive duplicate stops so Mapbox legs align with schedule order. */
export function sanitizeNavigationStopsForRoute(stops: NavigationStop[]): NavigationStop[] {
  const orderedStops = sortNavigationStopsBySequence(stops);
  const sanitized: NavigationStop[] = [];

  for (const stop of orderedStops) {
    if (!isValidNavigationCoordinate(stop)) continue;

    const previous = sanitized[sanitized.length - 1];
    if (previous) {
      const separationMeters = calculateDistance(
        previous.latitude,
        previous.longitude,
        stop.latitude,
        stop.longitude,
      );
      if (separationMeters < MIN_STOP_SEPARATION_METERS) continue;
    }

    sanitized.push({ ...stop });
  }

  return sanitized;
}

/** Drop stops too far from the previous stop (wrong agency coords / mixed regions). */
export function truncateStopsByMaxLegDistance(
  stops: NavigationStop[],
  maxLegMeters: number = MAX_CONSECUTIVE_STOP_DISTANCE_METERS,
): NavigationStop[] {
  if (stops.length <= 1) return stops;

  const kept: NavigationStop[] = [stops[0]];
  for (let index = 1; index < stops.length; index += 1) {
    const previous = kept[kept.length - 1];
    const current = stops[index];
    const legMeters = calculateDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    );
    if (legMeters > maxLegMeters) {
      console.warn(
        `[MapboxRoute] Dropping ${stops.length - index} stop(s) after "${current.longName}" — ` +
          `${Math.round(legMeters / 1000)}km leg exceeds ${Math.round(maxLegMeters / 1000)}km limit.`,
      );
      break;
    }
    kept.push(current);
  }
  return kept;
}

/** Keep only the first N stops so origin + waypoints + destination <= Mapbox limit. */
export function capNavigationStopsForMapbox(
  stops: NavigationStop[],
  maxStops: number = MAX_MAPBOX_SESSION_STOPS,
): NavigationStop[] {
  if (stops.length <= maxStops) return stops;
  console.warn(
    `[MapboxRoute] Truncating ${stops.length} stops to ${maxStops} (Mapbox coordinate limit).`,
  );
  return stops.slice(0, maxStops).map((stop, index) => ({ ...stop, sequenceIndex: index }));
}

export function countMapboxRouteCoordinates(sessionStops: NavigationStop[]): number {
  // origin + intermediate waypoints + destination
  return sessionStops.length + 1;
}

export function validateFrozenMapboxNativeSession(
  session: FrozenMapboxNativeSession,
): string | null {
  if (!isValidNavigationCoordinate(session.startOrigin)) {
    return 'Driver location is invalid.';
  }
  if (!isValidNavigationCoordinate(session.destination)) {
    return 'Final stop coordinates are invalid.';
  }

  for (const waypoint of session.waypoints) {
    if (!isValidNavigationCoordinate(waypoint)) {
      return 'A stop on the route has invalid coordinates.';
    }
  }

  const stopChain = [
    {
      latitude: session.startOrigin.latitude,
      longitude: session.startOrigin.longitude,
    },
    ...session.waypoints.map((waypoint) => ({
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
    })),
    {
      latitude: session.destination.latitude,
      longitude: session.destination.longitude,
    },
  ];

  for (let index = 1; index < stopChain.length; index += 1) {
    const previous = stopChain[index - 1];
    const current = stopChain[index];
    const separationMeters = calculateDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude,
    );
    if (separationMeters < MIN_STOP_SEPARATION_METERS) {
      return 'Scheduled stops are too close together for accurate routing.';
    }
  }

  return null;
}

export function buildFrozenMapboxNativeSession(
  origin: { latitude: number; longitude: number },
  sessionStops: NavigationStop[],
  agencyRoutePoints: NavigationCoordinate[] = [],
  /** Optional pre-built full-trip overview line (stable across per-leg rematches). */
  overviewRouteCoordinates?: NavigationCoordinate[] | null,
): FrozenMapboxNativeSession | null {
  if (!isValidNavigationCoordinate(origin)) return null;

  const useMapMatching = agencyRoutePoints.filter(isValidNavigationCoordinate).length >= 2;
  const sanitizedAll = truncateStopsByMaxLegDistance(
    sanitizeNavigationStopsForRoute(sessionStops),
  );

  if (sanitizedAll.length === 0) return null;

  /**
   * Exact-path + live TBT: match ONE leg at a time (driver → next stop) along the
   * agency shape. Next leg is refreshed in-place on the same native view (no remount).
   */
  const sanitizedStops = useMapMatching
    ? sanitizedAll.slice(0, 1)
    : capNavigationStopsForMapbox(sanitizedAll);

  const destination = sessionDestinationFromStops(sanitizedStops);
  if (!destination) return null;

  const routeCoordinates = useMapMatching
    ? buildAgencyRouteMatchingCoordinates(origin, sanitizedStops, agencyRoutePoints)
    : null;

  const overview =
    overviewRouteCoordinates && overviewRouteCoordinates.length >= 2
      ? overviewRouteCoordinates
      : useMapMatching
        ? buildAgencyOverviewPolyline(origin, sanitizedAll, agencyRoutePoints)
        : null;

  const session: FrozenMapboxNativeSession = {
    startOrigin: { latitude: origin.latitude, longitude: origin.longitude },
    destination: { ...destination },
    waypoints: useMapMatching
      ? []
      : buildMapboxNativeWaypoints(sanitizedStops).map((waypoint) => ({ ...waypoint })),
    ...(routeCoordinates && routeCoordinates.length >= 2
      ? { routeCoordinates: routeCoordinates.map((c) => ({ ...c })) }
      : {}),
    ...(overview && overview.length >= 2
      ? { overviewRouteCoordinates: overview.map((c) => ({ ...c })) }
      : {}),
  };

  if (validateFrozenMapboxNativeSession(session)) return null;

  return session;
}

/** Max points for the persistent full-trip overview polyline (visual only). */
export const MAX_OVERVIEW_POLYLINE_COORDINATES = 400;

/**
 * Full published agency polyline — same geometry MapScreen draws.
 * Visual-only; Map Matching / TBT still uses per-leg routeCoordinates.
 */
export function buildAgencyOverviewPolyline(
  _origin: { latitude: number; longitude: number },
  _sessionStops: NavigationStop[],
  agencyRoutePoints: NavigationCoordinate[],
): NavigationCoordinate[] | null {
  const shape = agencyRoutePoints.filter(isValidNavigationCoordinate);
  if (shape.length < 2) return null;

  if (shape.length <= MAX_OVERVIEW_POLYLINE_COORDINATES) {
    return shape.map((p) => ({ ...p }));
  }

  const sampled: NavigationCoordinate[] = [];
  const step = (shape.length - 1) / (MAX_OVERVIEW_POLYLINE_COORDINATES - 1);
  for (let i = 0; i < MAX_OVERVIEW_POLYLINE_COORDINATES; i += 1) {
    sampled.push({ ...shape[Math.round(i * step)] });
  }
  return sampled;
}

/**
 * Keep endpoints + every bus-stop waypoint, then evenly sample silent shape points
 * so the chain stays within the Map Matching coordinate limit.
 */
export function downsampleMatchingCoordinates(
  coordinates: MapboxRouteMatchingCoordinate[],
  maxCount: number = MAX_MAP_MATCHING_COORDINATES,
): MapboxRouteMatchingCoordinate[] {
  if (coordinates.length <= maxCount) {
    return coordinates.map((c) => ({ ...c }));
  }

  const mustKeep = new Set<number>();
  mustKeep.add(0);
  mustKeep.add(coordinates.length - 1);
  coordinates.forEach((coord, index) => {
    if (coord.separatesLegs) mustKeep.add(index);
  });

  const keptSorted = [...mustKeep].sort((a, b) => a - b);
  if (keptSorted.length >= maxCount) {
    // Prefer stops over dense shape: take evenly spaced must-keep indices.
    const step = (keptSorted.length - 1) / (maxCount - 1);
    const picked = new Set<number>();
    for (let i = 0; i < maxCount; i += 1) {
      picked.add(keptSorted[Math.round(i * step)]);
    }
    return [...picked]
      .sort((a, b) => a - b)
      .map((index) => ({ ...coordinates[index] }));
  }

  const remainingSlots = maxCount - keptSorted.length;
  const candidates: number[] = [];
  for (let i = 0; i < coordinates.length; i += 1) {
    if (!mustKeep.has(i)) candidates.push(i);
  }

  const sampled = new Set(keptSorted);
  if (candidates.length > 0 && remainingSlots > 0) {
    if (candidates.length <= remainingSlots) {
      candidates.forEach((index) => sampled.add(index));
    } else {
      const step = (candidates.length - 1) / remainingSlots;
      for (let i = 0; i < remainingSlots; i += 1) {
        sampled.add(candidates[Math.round(i * step)]);
      }
    }
  }

  return [...sampled]
    .sort((a, b) => a - b)
    .map((index) => ({ ...coordinates[index] }));
}

/**
 * Build Map Matching input: agency shape as silent points, bus stops as waypoints
 * (`separatesLegs: true`) so arrival events fire only at stops.
 *
 * Origin + stop pins are snapped onto the agency polyline so Map Matching starts
 * on-route (avoids immediate off-route / frozen TBT with noisy GPS / simulators).
 */
export function buildAgencyRouteMatchingCoordinates(
  origin: { latitude: number; longitude: number },
  sessionStops: NavigationStop[],
  agencyRoutePoints: NavigationCoordinate[],
): MapboxRouteMatchingCoordinate[] | null {
  if (!isValidNavigationCoordinate(origin) || sessionStops.length === 0) return null;

  const shape = agencyRoutePoints.filter(isValidNavigationCoordinate);
  if (shape.length < 2) return null;

  const originProjection = projectPointOnRoute(origin, shape, 0);
  let searchFrom = originProjection.segmentIndex;

  // Snap onto the published path so active guidance starts on-route.
  const chain: MapboxRouteMatchingCoordinate[] = [
    {
      latitude: originProjection.point.latitude,
      longitude: originProjection.point.longitude,
      name: 'origin',
    },
  ];

  let lastEmittedShapeIndex = searchFrom;
  let lastWaypoint: NavigationCoordinate = originProjection.point;

  for (let stopIndex = 0; stopIndex < sessionStops.length; stopIndex += 1) {
    const stop = sessionStops[stopIndex];
    if (!isValidNavigationCoordinate(stop)) continue;

    const projection = projectPointOnRoute(stop, shape, searchFrom);
    const shapeIndex = Math.max(
      searchFrom,
      projection.segmentT >= 0.5
        ? Math.min(projection.segmentIndex + 1, shape.length - 1)
        : projection.segmentIndex,
    );

    const snappedStop: NavigationCoordinate = {
      latitude: projection.point.latitude,
      longitude: projection.point.longitude,
    };

    const separationMeters = calculateDistance(
      lastWaypoint.latitude,
      lastWaypoint.longitude,
      snappedStop.latitude,
      snappedStop.longitude,
    );
    // Skip near-duplicate stops — zero-length legs freeze / skip TBT steps.
    if (separationMeters < MIN_STOP_SEPARATION_METERS) {
      continue;
    }

    // Silent shaping points between previous anchor and this stop.
    for (let i = lastEmittedShapeIndex + 1; i < shapeIndex; i += 1) {
      chain.push({
        latitude: shape[i].latitude,
        longitude: shape[i].longitude,
      });
    }

    const isFinalStop = stopIndex === sessionStops.length - 1;
    chain.push({
      latitude: snappedStop.latitude,
      longitude: snappedStop.longitude,
      name: toStopNameText(stop.longName) || `Stop ${stop.sequenceIndex + 1}`,
      // Intermediate bus stops only — destination is already the endpoint waypoint.
      separatesLegs: !isFinalStop,
    });

    searchFrom = shapeIndex;
    lastEmittedShapeIndex = shapeIndex;
    lastWaypoint = snappedStop;
  }

  if (chain.length < 2) return null;

  return downsampleMatchingCoordinates(chain, MAX_MAP_MATCHING_COORDINATES);
}

export function buildMapboxSessionRouteStops(
  stops: NavigationStop[],
  startIndex: number,
): NavigationStop[] {
  if (stops.length === 0) return [];
  const orderedStops = sortNavigationStopsBySequence(stops);
  const safeIndex = Math.max(0, Math.min(startIndex, orderedStops.length - 1));
  return orderedStops.slice(safeIndex).map((stop) => ({ ...stop }));
}

export function buildMapboxNativeWaypoints(
  sessionStops: NavigationStop[],
): MapboxNativeWaypoint[] {
  if (sessionStops.length <= 1) return [];
  return sessionStops.slice(0, -1).map((stop) => ({
    latitude: stop.latitude,
    longitude: stop.longitude,
    name: toStopNameText(stop.longName) || `Stop ${stop.sequenceIndex + 1}`,
    separatesLegs: true,
  }));
}

export function sessionDestinationFromStops(
  sessionStops: NavigationStop[],
): { latitude: number; longitude: number; title: string } | null {
  const destination = sessionStops[sessionStops.length - 1];
  if (!destination) return null;
  const title = toStopNameText(destination.longName);
  return {
    latitude: destination.latitude,
    longitude: destination.longitude,
    title: title || 'Destination',
  };
}

/** Ordered coordinates passed to native routing: origin → waypoints → destination. */
export function buildNativeRouteCoordinateChain(
  session: FrozenMapboxNativeSession,
): Array<{ latitude: number; longitude: number; label: string }> {
  return [
    { ...session.startOrigin, label: 'origin' },
    ...session.waypoints.map((waypoint, index) => ({
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      label: waypoint.name || `waypoint-${index + 1}`,
    })),
    {
      latitude: session.destination.latitude,
      longitude: session.destination.longitude,
      label: session.destination.title,
    },
  ];
}
