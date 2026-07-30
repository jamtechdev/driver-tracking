/**
 * Geometry and formatting helpers for Mapbox turn-by-turn navigation.
 */

import { calculateBearing, calculateDistance } from '@/utils/helpers';
import type {
  MapboxNavigationRoute,
  MapboxRouteStep,
  NavigationCoordinate,
  NavigationProgress,
  NavigationStop,
} from './types';

export function formatNavigationDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const miles = meters / 1609.344;
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Google Maps–style distance for turn-by-turn (meters, rounded). */
export function formatTurnByTurnDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 10) return 'Now';
  let rounded: number;
  if (meters < 100) {
    rounded = Math.max(10, Math.round(meters / 5) * 5);
  } else if (meters < 1000) {
    rounded = Math.round(meters / 10) * 10;
  } else {
    const km = meters / 1000;
    return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
  }
  return `${rounded} m`;
}

/** Always show meters/km (no miles) — used in navigation metrics. */
export function formatNavigationDistanceMeters(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';
  if (meters < 1000) {
    return `${Math.max(1, Math.round(meters))} m`;
  }
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** Material icon name for the current maneuver. */
export function getManeuverIconName(type?: string, modifier?: string): string {
  const t = (type ?? '').toLowerCase();
  const m = (modifier ?? '').toLowerCase();

  if (t === 'arrive') return 'place';
  if (t === 'roundabout' || t === 'rotary') return 'roundabout-right';
  if (t === 'merge') return 'merge';
  if (t === 'fork') {
    if (m.includes('left')) return 'call-split';
    return 'call-split';
  }
  if (t === 'uturn') return 'u-turn-left';
  if (m.includes('left') || m.includes('sharp left') || m.includes('slight left')) {
    return 'turn-left';
  }
  if (m.includes('right') || m.includes('sharp right') || m.includes('slight right')) {
    return 'turn-right';
  }
  if (t === 'turn') {
    if (m.includes('left')) return 'turn-left';
    if (m.includes('right')) return 'turn-right';
  }
  return 'straight';
}

export function formatNavigationDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

export function computeEtaTimestamp(remainingSeconds: number): number {
  return Date.now() + Math.max(0, remainingSeconds) * 1000;
}

export function formatEtaTime(timestamp: number | null): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export interface PerStopRouteMetric {
  stopIndex: number;
  stop: NavigationStop;
  distanceMeters: number;
  durationSeconds: number;
  etaTimestamp: number | null;
  isCurrent: boolean;
}

/** Per-stop ETA/distance to each upcoming stop (consistent distance + time pairs). */
export function computePerStopRouteMetrics(params: {
  remainingStops: NavigationStop[];
  currentStopIndex: number;
  driverLocation: NavigationCoordinate | null;
  routeProgress: {
    distanceRemaining: number;
    durationRemaining: number;
    fractionTraveled: number;
  } | null;
}): PerStopRouteMetric[] {
  const { remainingStops, currentStopIndex, driverLocation, routeProgress } = params;
  if (remainingStops.length === 0) return [];

  const legDistances: number[] = [];
  let previous: NavigationCoordinate = driverLocation ?? remainingStops[0];

  for (const stop of remainingStops) {
    legDistances.push(
      calculateDistance(
        previous.latitude,
        previous.longitude,
        stop.latitude,
        stop.longitude,
      ),
    );
    previous = stop;
  }

  // Native distanceRemaining/durationRemaining are for the FULL remaining route,
  // not the next stop — only use them to estimate average speed.
  const nativeDistance = Math.max(0, routeProgress?.distanceRemaining ?? 0);
  const nativeDuration = Math.max(0, routeProgress?.durationRemaining ?? 0);
  const FALLBACK_MPS = 13.4; // ~30 mph urban transit-ish
  const averageMps =
    nativeDistance > 50 && nativeDuration > 1
      ? nativeDistance / nativeDuration
      : FALLBACK_MPS;

  // Single remaining destination: prefer native progress when it looks sane vs straight-line.
  const useNativeForCurrentStop =
    remainingStops.length === 1 &&
    nativeDistance > 0 &&
    nativeDuration > 0 &&
    legDistances[0] > 0 &&
    // Reject absurd native values (e.g. duration tiny vs distance).
    nativeDistance / nativeDuration < 50;

  let cumulativeDistance = 0;

  return remainingStops.map((stop, index) => {
    if (index === 0 && useNativeForCurrentStop) {
      cumulativeDistance = nativeDistance;
      return {
        stopIndex: currentStopIndex + index,
        stop,
        distanceMeters: nativeDistance,
        durationSeconds: nativeDuration,
        etaTimestamp: computeEtaTimestamp(nativeDuration),
        isCurrent: true,
      };
    }

    cumulativeDistance += legDistances[index] ?? 0;
    const durationSeconds = cumulativeDistance / averageMps;

    return {
      stopIndex: currentStopIndex + index,
      stop,
      distanceMeters: cumulativeDistance,
      durationSeconds,
      etaTimestamp: routeProgress || driverLocation ? computeEtaTimestamp(durationSeconds) : null,
      isCurrent: index === 0,
    };
  });
}

/** Shortest distance from a point to a line segment (meters). */
export function distanceToSegmentMeters(
  point: NavigationCoordinate,
  start: NavigationCoordinate,
  end: NavigationCoordinate,
): number {
  return projectPointOnSegment(point, start, end).distanceToSegmentMeters;
}

/** Project a point onto a segment; t is 0 at start, 1 at end. */
export function projectPointOnSegment(
  point: NavigationCoordinate,
  start: NavigationCoordinate,
  end: NavigationCoordinate,
): {
  t: number;
  distanceToSegmentMeters: number;
  point: NavigationCoordinate;
} {
  const x = point.latitude;
  const y = point.longitude;
  const x1 = start.latitude;
  const y1 = start.longitude;
  const x2 = end.latitude;
  const y2 = end.longitude;

  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    const distanceToSegmentMeters = calculateDistance(x, y, x1, y1);
    return {
      t: 0,
      distanceToSegmentMeters,
      point: { latitude: x1, longitude: y1 },
    };
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projLat = x1 + t * dx;
  const projLng = y1 + t * dy;
  return {
    t,
    distanceToSegmentMeters: calculateDistance(x, y, projLat, projLng),
    point: { latitude: projLat, longitude: projLng },
  };
}

function polylineLengthBetween(
  routeCoordinates: NavigationCoordinate[],
  fromIndex: number,
  toIndex: number,
): number {
  let total = 0;
  for (let i = fromIndex; i < toIndex && i < routeCoordinates.length - 1; i += 1) {
    total += calculateDistance(
      routeCoordinates[i].latitude,
      routeCoordinates[i].longitude,
      routeCoordinates[i + 1].latitude,
      routeCoordinates[i + 1].longitude,
    );
  }
  return total;
}

/** Minimum distance from a point to any segment of the route polyline (meters). */
export function distanceToRouteMeters(
  point: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
): number {
  if (routeCoordinates.length === 0) return Infinity;
  if (routeCoordinates.length === 1) {
    return calculateDistance(
      point.latitude,
      point.longitude,
      routeCoordinates[0].latitude,
      routeCoordinates[0].longitude,
    );
  }

  let min = Infinity;
  for (let i = 0; i < routeCoordinates.length - 1; i += 1) {
    const d = distanceToSegmentMeters(point, routeCoordinates[i], routeCoordinates[i + 1]);
    if (d < min) min = d;
  }
  return min;
}

/** Find the closest step index ahead of the driver (never moves backward). */
export function findNearestStepIndex(
  location: NavigationCoordinate,
  steps: MapboxRouteStep[],
  currentIndex: number,
): number {
  if (steps.length === 0) return 0;

  let bestIndex = Math.max(0, Math.min(currentIndex, steps.length - 1));
  let bestDistance = Infinity;

  for (let i = currentIndex; i < steps.length; i += 1) {
    const step = steps[i];
    const d = calculateDistance(
      location.latitude,
      location.longitude,
      step.coordinate.latitude,
      step.coordinate.longitude,
    );
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
    if (d < 25 && i < steps.length - 1) {
      bestIndex = i + 1;
      break;
    }
  }

  return bestIndex;
}

/** Index on the route polyline closest to the driver, searching forward from minIndex. */
export function findClosestRouteCoordinateIndex(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minIndex = 0,
): number {
  if (routeCoordinates.length < 2) return 0;
  const projection = projectPointOnRoute(location, routeCoordinates, minIndex);
  return projection.segmentIndex;
}

/** Closest projection on the route polyline ahead of minSegmentIndex. */
export function projectPointOnRoute(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minSegmentIndex = 0,
): {
  segmentIndex: number;
  segmentT: number;
  distanceToRouteMeters: number;
  remainingMeters: number;
  point: NavigationCoordinate;
} {
  if (routeCoordinates.length === 0) {
    return {
      segmentIndex: 0,
      segmentT: 0,
      distanceToRouteMeters: Infinity,
      remainingMeters: 0,
      point: location,
    };
  }
  if (routeCoordinates.length === 1) {
    const remainingMeters = calculateDistance(
      location.latitude,
      location.longitude,
      routeCoordinates[0].latitude,
      routeCoordinates[0].longitude,
    );
    return {
      segmentIndex: 0,
      segmentT: 0,
      distanceToRouteMeters: remainingMeters,
      remainingMeters,
      point: { ...routeCoordinates[0] },
    };
  }

  const startSeg = Math.max(0, Math.min(minSegmentIndex, routeCoordinates.length - 2));
  let bestSegmentIndex = startSeg;
  let bestT = 0;
  let bestDistanceToRoute = Infinity;
  let bestRemaining = Infinity;

  for (let i = startSeg; i < routeCoordinates.length - 1; i += 1) {
    const a = routeCoordinates[i];
    const b = routeCoordinates[i + 1];
    const projection = projectPointOnSegment(location, a, b);
    const segmentLength = calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    const remainingOnSegment = (1 - projection.t) * segmentLength;
    const remainingAfterSegment = polylineLengthBetween(
      routeCoordinates,
      i + 1,
      routeCoordinates.length - 1,
    );
    const remainingMeters = remainingOnSegment + remainingAfterSegment;
    const d = projection.distanceToSegmentMeters;

    const isCloser = d < bestDistanceToRoute - 0.5;
    const isTiePreferForward =
      Math.abs(d - bestDistanceToRoute) <= 0.5 && i >= bestSegmentIndex;

    if (isCloser || (isTiePreferForward && d <= bestDistanceToRoute + 0.5)) {
      bestDistanceToRoute = d;
      bestSegmentIndex = i;
      bestT = projection.t;
      bestRemaining = remainingMeters;
    }
  }

  return {
    segmentIndex: bestSegmentIndex,
    segmentT: bestT,
    distanceToRouteMeters: bestDistanceToRoute,
    remainingMeters: bestRemaining,
    point: {
      latitude:
        routeCoordinates[bestSegmentIndex].latitude +
        bestT *
          (routeCoordinates[bestSegmentIndex + 1].latitude -
            routeCoordinates[bestSegmentIndex].latitude),
      longitude:
        routeCoordinates[bestSegmentIndex].longitude +
        bestT *
          (routeCoordinates[bestSegmentIndex + 1].longitude -
            routeCoordinates[bestSegmentIndex].longitude),
    },
  };
}

/** Remaining distance along the route polyline from the driver to the leg end (meters). */
export function computeRemainingPolylineDistance(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minRouteIndex = 0,
): { distanceMeters: number; routeIndex: number } {
  const projection = projectPointOnRoute(location, routeCoordinates, minRouteIndex);
  return {
    distanceMeters: projection.remainingMeters,
    routeIndex: projection.segmentIndex,
  };
}

/** Route polyline from the driver's current position to the destination. */
export function sliceRouteAheadOfDriver(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minRouteIndex = 0,
): NavigationCoordinate[] {
  if (routeCoordinates.length === 0) return [];
  if (routeCoordinates.length === 1) {
    return [location, routeCoordinates[0]];
  }

  const startIndex = findClosestRouteCoordinateIndex(
    location,
    routeCoordinates,
    minRouteIndex,
  );
  const ahead = routeCoordinates.slice(startIndex);
  if (ahead.length === 0) return [location];

  const first = ahead[0];
  const atSamePoint =
    Math.abs(first.latitude - location.latitude) < 0.00001 &&
    Math.abs(first.longitude - location.longitude) < 0.00001;

  return atSamePoint ? ahead : [location, ...ahead];
}

/** Route forward heading (degrees) along the polyline at the driver's projection. */
export function routeForwardHeadingDegrees(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minRouteIndex = 0,
  lookAheadMeters = 18,
): number | null {
  if (routeCoordinates.length < 2) return null;

  const projection = projectPointOnRoute(location, routeCoordinates, minRouteIndex);
  const start = projection.point;
  let accumulated = 0;
  let end = routeCoordinates[Math.min(projection.segmentIndex + 1, routeCoordinates.length - 1)];

  for (let i = projection.segmentIndex; i < routeCoordinates.length - 1; i += 1) {
    const a = i === projection.segmentIndex ? start : routeCoordinates[i];
    const b = routeCoordinates[i + 1];
    const segLen = calculateDistance(a.latitude, a.longitude, b.latitude, b.longitude);
    if (accumulated + segLen >= lookAheadMeters || i === routeCoordinates.length - 2) {
      end = b;
      break;
    }
    accumulated += segLen;
    end = b;
  }

  if (
    Math.abs(start.latitude - end.latitude) < 1e-8 &&
    Math.abs(start.longitude - end.longitude) < 1e-8
  ) {
    return null;
  }

  return calculateBearing(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude,
  );
}

/** Snap GPS onto the route line and return point + forward heading. */
export function snapToRoute(
  location: NavigationCoordinate,
  routeCoordinates: NavigationCoordinate[],
  minRouteIndex = 0,
  lookAheadMeters = 18,
): {
  point: NavigationCoordinate;
  heading: number | null;
  segmentIndex: number;
  distanceToRouteMeters: number;
} {
  if (routeCoordinates.length === 0) {
    return {
      point: location,
      heading: null,
      segmentIndex: 0,
      distanceToRouteMeters: Infinity,
    };
  }

  const projection = projectPointOnRoute(location, routeCoordinates, minRouteIndex);
  const heading = routeForwardHeadingDegrees(
    projection.point,
    routeCoordinates,
    projection.segmentIndex,
    lookAheadMeters,
  );

  return {
    point: projection.point,
    heading,
    segmentIndex: projection.segmentIndex,
    distanceToRouteMeters: projection.distanceToRouteMeters,
  };
}

export function sumRemainingStepMetrics(
  steps: MapboxRouteStep[],
  fromStepIndex: number,
  location: NavigationCoordinate,
  route: MapboxNavigationRoute,
  minRouteIndex = 0,
): { distanceMeters: number; durationSeconds: number; routeIndex: number } {
  const polyline = computeRemainingPolylineDistance(
    location,
    route.coordinates,
    minRouteIndex,
  );

  if (route.totalDistanceMeters > 0 && route.totalDurationSeconds > 0) {
    const ratio = Math.min(1, polyline.distanceMeters / route.totalDistanceMeters);
    return {
      distanceMeters: polyline.distanceMeters,
      durationSeconds: route.totalDurationSeconds * ratio,
      routeIndex: polyline.routeIndex,
    };
  }

  if (steps.length === 0) {
    return { distanceMeters: polyline.distanceMeters, durationSeconds: 0, routeIndex: polyline.routeIndex };
  }

  const index = Math.max(0, Math.min(fromStepIndex, steps.length - 1));
  let distanceMeters = polyline.distanceMeters;
  let durationSeconds = 0;

  for (let i = index + 1; i < steps.length; i += 1) {
    distanceMeters += steps[i].distanceMeters;
    durationSeconds += steps[i].durationSeconds;
  }

  return { distanceMeters, durationSeconds, routeIndex: polyline.routeIndex };
}

export function computeLegProgress(
  route: MapboxNavigationRoute,
  location: NavigationCoordinate,
  stepIndex: number,
  minRouteIndex = 0,
): number {
  if (route.totalDistanceMeters <= 0) return 0;

  const remaining = sumRemainingStepMetrics(
    route.steps,
    stepIndex,
    location,
    route,
    minRouteIndex,
  );
  const traveled = Math.max(0, route.totalDistanceMeters - remaining.distanceMeters);
  return Math.max(0, Math.min(1, traveled / route.totalDistanceMeters));
}

export function computeTripProgress(
  stops: NavigationStop[],
  currentStopIndex: number,
  legProgress: number,
): number {
  if (stops.length === 0) return 0;
  const completedStops = Math.max(0, Math.min(currentStopIndex, stops.length));
  const totalLegs = stops.length;
  const raw = (completedStops + legProgress) / totalLegs;
  return Math.max(0, Math.min(1, raw));
}

export function buildNavigationProgress(params: {
  route: MapboxNavigationRoute;
  location: NavigationCoordinate;
  stepIndex: number;
  routeIndex: number;
  stops: NavigationStop[];
  currentStopIndex: number;
  upcomingStopsRemainingMeters: number;
  upcomingStopsRemainingSeconds: number;
  currentDestination: NavigationStop | null;
}): NavigationProgress {
  const stepIndex = findNearestStepIndex(
    params.location,
    params.route.steps,
    params.stepIndex,
  );
  const legRemaining = sumRemainingStepMetrics(
    params.route.steps,
    stepIndex,
    params.location,
    params.route,
    params.routeIndex,
  );

  const legRemainingDistanceMeters = legRemaining.distanceMeters;
  const remainingDistanceMeters =
    legRemainingDistanceMeters + params.upcomingStopsRemainingMeters;

  const averageMps =
    params.route.totalDistanceMeters > 0
      ? params.route.totalDistanceMeters / Math.max(params.route.totalDurationSeconds, 1)
      : 13.4;
  const legRemainingDurationSeconds =
    params.route.totalDurationSeconds > 0
      ? (legRemainingDistanceMeters / params.route.totalDistanceMeters) *
        params.route.totalDurationSeconds
      : legRemainingDistanceMeters / averageMps;
  const remainingDurationSeconds =
    legRemainingDurationSeconds + params.upcomingStopsRemainingSeconds;

  const destinationCoord = params.currentDestination
    ? {
        latitude: params.currentDestination.latitude,
        longitude: params.currentDestination.longitude,
      }
    : params.route.coordinates[params.route.coordinates.length - 1] ?? params.location;

  const distanceToCurrentStopMeters = calculateDistance(
    params.location.latitude,
    params.location.longitude,
    destinationCoord.latitude,
    destinationCoord.longitude,
  );

  const legProgress = computeLegProgress(
    params.route,
    params.location,
    stepIndex,
    params.routeIndex,
  );
  const tripProgress = computeTripProgress(
    params.stops,
    params.currentStopIndex,
    legProgress,
  );

  const currentStep = params.route.steps[stepIndex];
  const currentInstruction = currentStep?.instruction ?? 'Continue on route';
  const distanceToNextManeuverMeters = currentStep
    ? calculateDistance(
        params.location.latitude,
        params.location.longitude,
        currentStep.coordinate.latitude,
        currentStep.coordinate.longitude,
      )
    : distanceToCurrentStopMeters;

  const remainingStopsCount = Math.max(0, params.stops.length - params.currentStopIndex);

  return {
    tripProgress,
    legProgress,
    remainingDistanceMeters,
    legRemainingDistanceMeters,
    distanceToCurrentStopMeters,
    remainingStopsCount,
    remainingDurationSeconds,
    legRemainingDurationSeconds,
    etaTimestamp: computeEtaTimestamp(remainingDurationSeconds),
    legEtaTimestamp: computeEtaTimestamp(legRemainingDurationSeconds),
    currentInstruction,
    distanceToNextManeuverMeters,
    currentManeuverType: currentStep?.type,
    currentManeuverModifier: currentStep?.modifier,
    currentStepIndex: stepIndex,
    routePolylineIndex: legRemaining.routeIndex,
  };
}

/** Prevent displayed distance/time from ticking up due to GPS noise between updates. */
export function clampMonotonicDecrease(
  previous: number,
  next: number,
  noiseTolerance: number,
): number {
  if (!Number.isFinite(previous) || previous === Infinity) return next;
  if (next <= previous) return next;
  if (next - previous <= noiseTolerance) return previous;
  return next;
}

export function isWithinStopArrivalRadius(
  location: NavigationCoordinate,
  stop: NavigationStop,
  thresholdMeters: number,
): boolean {
  const distance = calculateDistance(
    location.latitude,
    location.longitude,
    stop.latitude,
    stop.longitude,
  );
  return distance <= thresholdMeters;
}
