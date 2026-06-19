/**
 * Stop name shown above the OTP gauge.
 * When inside a stop geofence, use that geofence name (iOS manual CLCircularRegion check).
 * Otherwise fall back to schedule-based next stop while traversing the route.
 */

export interface StopGeofenceSnapshot {
  geofenceID: string;
  name: string;
}

export interface StopScheduleSnapshot {
  longName?: string | null;
}

export function resolveStopDisplayName(params: {
  selectedRoute?: string | null;
  currentStopGeofence?: StopGeofenceSnapshot | null;
  nextStop?: StopScheduleSnapshot | null;
}): string {
  const route = params.selectedRoute?.trim();
  if (route === 'Out of Service') return '...';

  const geofenceName = params.currentStopGeofence?.name?.trim();
  if (geofenceName) return geofenceName;

  const nextName = params.nextStop?.longName?.trim();
  if (nextName) return nextName;

  return '...';
}
