/**
 * Geofence helpers — iOS DriverModel manual region checks (CLCircularRegion parity).
 */

import { calculateDistance } from '@/utils/helpers';

export interface GeofenceData {
  geofenceID: number | string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  warn: number;
  vehicles?: Array<number | string>;
  [key: string]: unknown;
}

export function parseGeofences(raw: unknown): GeofenceData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => g != null && typeof g === 'object')
    .map((g) => ({
      geofenceID: g.geofenceID as number | string,
      name: String(g.name ?? ''),
      lat: Number(g.lat),
      lng: Number(g.lng),
      radius: Number(g.radius),
      warn: Number(g.warn ?? 0),
      vehicles: Array.isArray(g.vehicles) ? g.vehicles : [],
      ...g,
    }))
    .filter((g) => Number.isFinite(g.lat) && Number.isFinite(g.lng) && g.radius > 0);
}

/** warn === 2: silent (no UI alert on iOS). */
export function isSilentGeofence(geofence: GeofenceData): boolean {
  return Number(geofence.warn) === 2;
}

export function isWarningGeofence(geofence: GeofenceData): boolean {
  return Number(geofence.warn) === 1;
}

export function geofenceAppliesToVehicle(
  geofence: GeofenceData,
  vehicleId: string | null | undefined,
): boolean {
  if (!vehicleId || vehicleId === 'unassigned') return false;
  const vehicles = geofence.vehicles;
  if (!Array.isArray(vehicles) || vehicles.length === 0) return false;
  return vehicles.some((v) => String(v) === String(vehicleId));
}

export function isCoordinateInsideGeofence(
  lat: number,
  lng: number,
  geofence: GeofenceData,
): boolean {
  return calculateDistance(lat, lng, geofence.lat, geofence.lng) <= geofence.radius;
}

/**
 * First matching geofence for vehicle at coordinate (iOS loops geofences array).
 */
export function findGeofenceAtLocation(
  lat: number,
  lng: number,
  vehicleId: string | null | undefined,
  geofences: GeofenceData[],
): GeofenceData | null {
  if (!vehicleId) return null;
  for (const geofence of geofences) {
    if (!geofenceAppliesToVehicle(geofence, vehicleId)) continue;
    if (isCoordinateInsideGeofence(lat, lng, geofence)) {
      return geofence;
    }
  }
  return null;
}
