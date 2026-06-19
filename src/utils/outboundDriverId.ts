import type { Driver } from '@/data/drivers';

/**
 * Peak MDT/vehicle APIs require a scalar driverID (string or number), never an object.
 * Unwraps mistaken { driverId, shouldSend } telemetry results.
 */
export function coerceDriverIdForApi(value: unknown): string | number {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!s || s === 'unassigned' || s === '[object Object]') return 0;
    return s;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if ('driverId' in o) return coerceDriverIdForApi(o.driverId);
    if ('driverID' in o) return coerceDriverIdForApi(o.driverID);
    if ('id' in o) return coerceDriverIdForApi(o.id);
  }
  return 0;
}

/**
 * iOS sends [[selectedDriver objectForKey:@"driverID"] intValue] — 0 when no driver selected.
 */
export function getOutboundDriverId(driver: Driver | null): string | number {
  if (!driver || driver.role === 'unassigned' || driver.id === 'unassigned') return 0;
  return coerceDriverIdForApi(driver.id);
}
