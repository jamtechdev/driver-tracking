/**

 * Helpers for native Mapbox Navigation multi-stop routes.

 */



import { calculateDistance } from '@/utils/helpers';

import type { NavigationStop } from './types';

import { toStopNameText } from '@/utils/stopDisplayName';



export const MIN_STOP_SEPARATION_METERS = 8;



export interface MapboxNativeWaypoint {

  latitude: number;

  longitude: number;

  name: string;

  separatesLegs: boolean;

}



/** Immutable route props for one native navigation session — never update after mount. */

export interface FrozenMapboxNativeSession {

  startOrigin: { latitude: number; longitude: number };

  destination: { latitude: number; longitude: number; title: string };

  waypoints: MapboxNativeWaypoint[];

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

): FrozenMapboxNativeSession | null {

  if (!isValidNavigationCoordinate(origin)) return null;



  const sanitizedStops = sanitizeNavigationStopsForRoute(sessionStops);

  if (sanitizedStops.length === 0) return null;



  const destination = sessionDestinationFromStops(sanitizedStops);

  if (!destination) return null;



  const session: FrozenMapboxNativeSession = {

    startOrigin: { latitude: origin.latitude, longitude: origin.longitude },

    destination: { ...destination },

    waypoints: buildMapboxNativeWaypoints(sanitizedStops).map((waypoint) => ({ ...waypoint })),

  };



  if (validateFrozenMapboxNativeSession(session)) return null;



  return session;

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

  return sessionStops.slice(0, -1).map((stop, index) => ({

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


