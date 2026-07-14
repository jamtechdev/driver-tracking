/**
 * Best GPS fix for navigation: live map position + DriverModel heading.
 */

import type { LastLocation } from '@/context/DriverModelContext';
import type { GeolocationResponse } from '@/services/location.service';
import type { NavigationCoordinate } from './types';

export function resolveNavigationLocation(
  mapLocation: GeolocationResponse | null,
  driverLocation: LastLocation | null,
  mapHeading = 0,
): LastLocation | null {
  if (mapLocation) {
    const receivedAt = mapLocation.receivedAt ?? driverLocation?.receivedAt ?? Date.now();
    return {
      latitude: mapLocation.latitude,
      longitude: mapLocation.longitude,
      accuracy: mapLocation.accuracy,
      heading: driverLocation?.heading ?? mapLocation.heading ?? mapHeading,
      speed: driverLocation?.speed ?? mapLocation.speed ?? 0,
      timestamp: driverLocation?.timestamp ?? mapLocation.timestamp ?? receivedAt,
      receivedAt,
      altitude: mapLocation.altitude ?? driverLocation?.altitude,
    };
  }
  return driverLocation;
}

export function toRouteCoordinate(point: NavigationCoordinate): NavigationCoordinate {
  return { latitude: point.latitude, longitude: point.longitude };
}
