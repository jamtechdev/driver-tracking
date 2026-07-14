/**
 * Stop name helpers shared by HomeScreen and navigation.
 */

export interface StopGeofenceSnapshot {
  geofenceID: string;
  name: string;
}

export interface StopScheduleSnapshot {
  longName?: string | number | null;
  link?: number | string | null;
}

export function toStopNameText(name: unknown): string {
  if (name == null) return '';
  return String(name).trim();
}

export function resolveStopDisplayName(params: {
  selectedRoute?: string | null;
  currentStopGeofence?: StopGeofenceSnapshot | null;
  nextStop?: StopScheduleSnapshot | null;
}): string {
  const route = params.selectedRoute?.trim();
  if (route === 'Out of Service') return '...';

  const geofenceName = toStopNameText(params.currentStopGeofence?.name);
  if (geofenceName) return geofenceName;

  const nextName = toStopNameText(params.nextStop?.longName);
  if (nextName) return nextName;

  return '...';
}
