/**
 * Mapbox Directions API client.
 */

import axios from 'axios';
import { MAPBOX_CONFIG, isMapboxAccessTokenValid } from '@/config/mapbox.config';
import type {
  MapboxNavigationRoute,
  MapboxRouteStep,
  NavigationCoordinate,
} from '@/features/navigation/types';

interface MapboxDirectionsResponse {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
    legs?: Array<{
      steps?: Array<{
        distance?: number;
        duration?: number;
        name?: string;
        maneuver?: {
          instruction?: string;
          type?: string;
          modifier?: string;
          location?: [number, number];
        };
      }>;
    }>;
  }>;
  code?: string;
  message?: string;
}

function toCoordinate(pair: [number, number]): NavigationCoordinate {
  return { latitude: pair[1], longitude: pair[0] };
}

function parseSteps(
  rawSteps: NonNullable<
    NonNullable<NonNullable<MapboxDirectionsResponse['routes']>[number]['legs']>[number]['steps']
  >,
): MapboxRouteStep[] {
  const steps: MapboxRouteStep[] = [];
  for (const step of rawSteps) {
    const location = step.maneuver?.location;
    if (!location || location.length < 2) continue;
    const instruction = step.maneuver?.instruction?.trim();
    if (!instruction) continue;
    steps.push({
      instruction,
      distanceMeters: step.distance ?? 0,
      durationSeconds: step.duration ?? 0,
      coordinate: toCoordinate(location),
      name: step.name,
      modifier: step.maneuver?.modifier,
      type: step.maneuver?.type,
    });
  }
  return steps;
}

function parseRoute(data: MapboxDirectionsResponse): MapboxNavigationRoute | null {
  const route = data.routes?.[0];
  if (!route?.geometry?.coordinates?.length) return null;
  return {
    coordinates: route.geometry.coordinates.map(toCoordinate),
    steps: parseSteps(route.legs?.[0]?.steps ?? []),
    totalDistanceMeters: route.distance ?? 0,
    totalDurationSeconds: route.duration ?? 0,
  };
}

export interface FetchMapboxDirectionsOptions {
  /** Device/travel heading in degrees (0–360). Bias the route start onto the road ahead. */
  headingDegrees?: number;
  /** Max snap radius from GPS to road network (meters). */
  snapRadiusMeters?: number;
  /** Bearing freedom at origin (degrees). */
  bearingRangeDegrees?: number;
}

export async function fetchMapboxDirectionsRoute(
  origin: NavigationCoordinate,
  destination: NavigationCoordinate,
  options: FetchMapboxDirectionsOptions = {},
): Promise<MapboxNavigationRoute> {
  if (!isMapboxAccessTokenValid()) {
    throw new Error('Mapbox access token is not configured.');
  }

  const snapRadius = Math.max(25, options.snapRadiusMeters ?? 75);
  const bearingRange = Math.max(10, Math.min(180, options.bearingRangeDegrees ?? 45));
  const heading =
    options.headingDegrees != null && Number.isFinite(options.headingDegrees)
      ? ((options.headingDegrees % 360) + 360) % 360
      : null;

  const coord = (point: NavigationCoordinate) => `${point.longitude},${point.latitude}`;
  const url = `${MAPBOX_CONFIG.DIRECTIONS_BASE_URL}/${coord(origin)};${coord(destination)}`;

  const params: Record<string, string | number | boolean> = {
    access_token: MAPBOX_CONFIG.ACCESS_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: true,
    banner_instructions: true,
    voice_instructions: true,
    alternatives: false,
    continue_straight: true,
    // Snap GPS onto nearby roads for origin and destination.
    radiuses: `${snapRadius};${snapRadius}`,
  };

  // Bias first leg to leave origin in the travel direction (Mapbox bearings).
  if (heading != null) {
    params.bearings = `${Math.round(heading)},${bearingRange};`;
  }

  const response = await axios.get<MapboxDirectionsResponse>(url, {
    timeout: 20000,
    params,
  });

  if (response.data.code && response.data.code !== 'Ok') {
    throw new Error(response.data.message ?? `Mapbox routing failed (${response.data.code})`);
  }

  const parsed = parseRoute(response.data);
  if (!parsed) throw new Error('Mapbox returned an empty route.');
  return parsed;
}
