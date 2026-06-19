import type { AssignmentResponse } from '@/api/position.api';
import type { Driver } from '@/data/drivers';
import { hasServerAssignment } from '@/utils/assignmentSync';
import { coerceDriverIdForApi, getOutboundDriverId } from '@/utils/outboundDriverId';

/**
 * driverID for MDT / vehicle update from assignment API (launch + poll).
 * hasAssignment=1 → assignment.driverID (including 0); hasAssignment=0 → 0.
 */
export function getTelemetryDriverIdFromAssignmentApi(
  result: AssignmentResponse,
): string | number {
  if (!hasServerAssignment(result)) {
    return 0;
  }
  const raw = result.assignment?.driverID ?? result.driverID;
  if (raw == null || raw === '') {
    return 0;
  }
  return coerceDriverIdForApi(raw);
}

/** Tablet selected driver — used for UI only, not MDT/vehicle telemetry. */
export function getMdtDriverIdFromSelectedDriver(driver: Driver | null): string | number {
  return coerceDriverIdForApi(getOutboundDriverId(driver));
}
