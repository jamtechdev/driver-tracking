/**
 * In-memory agency vehicle list (from DriverDataContext) for name lookups.
 */

import type { DriverDataVehicle } from '@/api/driverData.api';

let agencyVehicles: DriverDataVehicle[] = [];

export function setAgencyVehicles(list: DriverDataVehicle[]): void {
  agencyVehicles = Array.isArray(list) ? list : [];
}

export function lookupVehicleName(vehicleId: string | number): string | null {
  const id = String(vehicleId).trim();
  if (!id) return null;

  const match = agencyVehicles.find(
    (v) => String(v.vehicleID) === id || String(v.vehicleNumber) === id,
  );
  if (!match) return null;

  return (
    (match.vehicleName && String(match.vehicleName).trim()) ||
    (match.vehicleNumber && String(match.vehicleNumber).trim()) ||
    (match.vehicleID != null ? String(match.vehicleID) : null)
  );
}
