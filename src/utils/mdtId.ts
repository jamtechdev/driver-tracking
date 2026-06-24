/**
 * MDT device ID helpers — display vs API format (matches native iOS DriverModel).
 * Display: BPT-XXXXXXXX-XXXX-XXXX-XXXX
 * API mdtUUID param: raw UUID without BPT- prefix
 */

/** Strip BPT- display prefix for controller=mdt&action=update. */
export function mdtUuidForApi(storedId: string | null | undefined): string {
  if (!storedId) return '';
  return storedId.replace(/^BPT-/i, '');
}

/** Vehicle ID for MDT heartbeat — 0 when unassigned (native sends vehicleID=0). */
export function mdtVehicleIdForApi(vehicleId: string | null | undefined): string | number {
  if (!vehicleId || vehicleId === 'unassigned' || vehicleId === '110') return 0;
  return vehicleId;
}
