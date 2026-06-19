/**
 * In-memory agency driver list (from DriverDataContext) for assignment sync lookups.
 */

import { getDriverData } from '@/api/driverData.api';
import type { DriverDataDriver } from '@/api/driverData.api';
import type { Driver } from '@/data/drivers';

let agencyDrivers: DriverDataDriver[] = [];
const rosterListeners = new Set<() => void>();

export function setAgencyDrivers(
  list: DriverDataDriver[],
  options?: { notify?: boolean },
): void {
  agencyDrivers = Array.isArray(list) ? list : [];
  if (options?.notify === false) return;
  rosterListeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.warn('[driverLookup] roster listener error:', e);
    }
  });
}

/** Fires after DriverDataContext refreshes the agency driver list. */
export function subscribeAgencyDriversUpdated(listener: () => void): () => void {
  rosterListeners.add(listener);
  return () => {
    rosterListeners.delete(listener);
  };
}

export function mapDriverRecord(record: DriverDataDriver): Driver {
  const id = String(record.driverID ?? '').trim();
  return {
    id,
    name: (record.driverName && String(record.driverName).trim()) || `Driver ${id}`,
    role: (record.supervisor === 1 || record.supervisor === '1') ? 'supervisor' : 'driver',
    requiresPin: !!record.code,
    pin: record.code ?? undefined,
  };
}

/** Match assignment.driverID to cached agency driver list. */
export function findDriverById(driverId: string): Driver | null {
  const normalized = String(driverId).trim();
  if (!normalized || normalized === '0') return null;

  const match = agencyDrivers.find((d) => {
    const recordId = String(d.driverID ?? '').trim();
    return recordId === normalized;
  });

  return match ? mapDriverRecord(match) : null;
}

/**
 * Resolve driver from cache or driver/data API (used at launch before roster may be loaded).
 */
export async function lookupDriverByIdFromRoster(driverId: string): Promise<Driver | null> {
  const cached = findDriverById(driverId);
  if (cached) return cached;

  try {
    const data = await getDriverData();
    const list = Array.isArray(data?.driver) ? data.driver : [];
    setAgencyDrivers(list, { notify: false });
    return findDriverById(driverId);
  } catch (e) {
    console.warn('[driverLookup] lookupDriverByIdFromRoster failed:', e);
    return null;
  }
}
