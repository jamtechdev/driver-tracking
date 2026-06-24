/**
 * Resolve driverID for MDT / vehicle updates.
 * Assignment driverID when present; else 0 only when server confirmed empty.
 */

import { getAssignment } from '@/api/position.api';
import type { Driver } from '@/data/drivers';
import { getAssignedDriverIdFromResult } from '@/utils/assignmentDriverId';
import { getOutboundDriverId } from '@/utils/outboundDriverId';

type CacheEntry = { driverId: string; expiresAt: number };

const CACHE_MS = 3000;
const cacheByVehicle = new Map<string, CacheEntry>();
const stickyAssignmentDriverByVehicle = new Map<string, string>();

export type TelemetryDriverIdResult = {
  driverId: string | number;
  /** When false, skip MDT/vehicle call — do not send driverID 0 before assignment is known. */
  shouldSend: boolean;
};

export function invalidateAssignmentDriverIdCache(vehicleId?: string | null): void {
  if (vehicleId) {
    cacheByVehicle.delete(String(vehicleId));
  } else {
    cacheByVehicle.clear();
  }
}

export function clearStickyAssignmentDriverId(vehicleId?: string | null): void {
  if (vehicleId) {
    stickyAssignmentDriverByVehicle.delete(String(vehicleId));
  } else {
    stickyAssignmentDriverByVehicle.clear();
  }
}

async function fetchAssignmentDriverId(
  vehicleId: string,
  agencyID: string | number,
): Promise<string | null> {
  const result = await getAssignment(vehicleId, agencyID);
  return getAssignedDriverIdFromResult(result, result.assignment ?? null);
}

/**
 * Tablet driver wins; else assignment hint/API/sticky; else 0 only if allowSendZero.
 */
export async function resolveOutboundDriverIdForTelemetry(
  vehicleId: string | null,
  driver: Driver | null,
  agencyID: string | number,
  assignmentDriverIdHint?: string | null,
  allowSendZero = false,
): Promise<TelemetryDriverIdResult> {
  const local = getOutboundDriverId(driver);
  if (local !== 0 && local !== '0') {
    return { driverId: local, shouldSend: true };
  }

  if (!vehicleId || vehicleId === '110' || vehicleId === 'unassigned') {
    return { driverId: 0, shouldSend: allowSendZero };
  }

  const cacheKey = String(vehicleId);

  const hint = assignmentDriverIdHint?.trim();
  if (hint && hint !== '0') {
    stickyAssignmentDriverByVehicle.set(cacheKey, hint);
    return { driverId: hint, shouldSend: true };
  }

  const cached = cacheByVehicle.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { driverId: cached.driverId, shouldSend: true };
  }

  try {
    const fromAssignment = await fetchAssignmentDriverId(cacheKey, agencyID);
    if (fromAssignment) {
      stickyAssignmentDriverByVehicle.set(cacheKey, fromAssignment);
      cacheByVehicle.set(cacheKey, {
        driverId: fromAssignment,
        expiresAt: Date.now() + CACHE_MS,
      });
      return { driverId: fromAssignment, shouldSend: true };
    }
    invalidateAssignmentDriverIdCache(cacheKey);
  } catch (e) {
    console.warn('[resolveOutboundDriverId] getAssignment failed:', e);
  }

  const sticky = stickyAssignmentDriverByVehicle.get(cacheKey);
  if (sticky) {
    return { driverId: sticky, shouldSend: true };
  }

  if (!allowSendZero) {
    return { driverId: 0, shouldSend: false };
  }

  return { driverId: 0, shouldSend: true };
}
