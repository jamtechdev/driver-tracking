import type { AssignmentResponse, VehicleAssignmentPayload } from '@/api/position.api';
import type { ManifestAssignment } from '@/api/manifests.api';
import type { Driver } from '@/data/drivers';
import { parseAssignmentDriverId } from '@/utils/assignmentDriverId';
import { isAssignedRouteId } from '@/utils/helpers';

export type BlockManifestSyncAction = 'none' | 'apply_block' | 'clear_block';

/**
 * Admin portal block assign/unassign must sync even when the tablet set routeOverride
 * (e.g. driver picked a block locally). Compare server manifest_assignments to local state.
 */
export function decideBlockManifestSync(
  localManifestId: number | null,
  serverAssignments: ManifestAssignment[],
): { action: BlockManifestSyncAction; manifestId: number | null } {
  const active = serverAssignments.find((a) => !a.disabled) ?? null;
  const serverManifestId = active?.manifestID ?? null;

  if (serverManifestId != null && serverManifestId !== localManifestId) {
    return { action: 'apply_block', manifestId: serverManifestId };
  }
  if (serverManifestId == null && localManifestId != null) {
    return { action: 'clear_block', manifestId: null };
  }
  return { action: 'none', manifestId: null };
}

/** Peak API returns hasAssignment as 1, '1', true, or 'true'. */
export function hasServerAssignment(result: AssignmentResponse): boolean {
  const flag = result.hasAssignment;
  return flag === true || flag === 1 || flag === '1' || flag === 'true';
}

/** Ignore transient empty assignment before clearing route / pushing OOS to admin. */
export const ASSIGNMENT_ROUTE_STICKY_MS = 45000;

/** Route ID from assignment payload or currentRouteID (iOS selectRouteID -2 / currentRouteID). */
export function getRouteIdFromAssignmentResult(
  result: AssignmentResponse,
  assignment?: VehicleAssignmentPayload | null,
): string | null {
  const current =
    result.currentRouteID != null ? String(result.currentRouteID) : null;
  if (isAssignedRouteId(current)) return current;

  const fromAssignment = parseAssignmentDriverId(assignment?.routeID);
  if (isAssignedRouteId(fromAssignment)) return fromAssignment;

  return null;
}

/**
 * Only flip local route to Out of Service when the assignment API confirms no assignment
 * and we are past the sticky grace window (avoids admin route toggle).
 */
export function shouldApplyOutOfServiceRouteFromPoll(
  result: AssignmentResponse,
  lastRouteAdoptedAtMs: number,
  lastServerAssignmentAtMs: number,
): boolean {
  if (hasServerAssignment(result)) {
    return false;
  }
  const now = Date.now();
  if (now - lastRouteAdoptedAtMs < ASSIGNMENT_ROUTE_STICKY_MS) {
    return false;
  }
  if (now - lastServerAssignmentAtMs < ASSIGNMENT_ROUTE_STICKY_MS) {
    return false;
  }
  const apiDriverId =
    parseAssignmentDriverId(result.assignment?.driverID) ??
    parseAssignmentDriverId(result.driverID);
  if (apiDriverId != null) {
    return false;
  }
  const apiRouteId = getRouteIdFromAssignmentResult(result, result.assignment ?? null);
  if (apiRouteId != null) {
    return false;
  }
  return true;
}

/**
 * iOS updateAssignment only calls selectDriverID(-1) when the assignment API reports
 * no assignment. Do not use vehicle-list fallbacks here — stale driver/data would
 * otherwise revert a dashboard assign right after adopt.
 */
export function shouldUnassignDriverFromPoll(
  result: AssignmentResponse,
  localDriver: Driver | null,
): boolean {
  if (!localDriver || localDriver.role === 'unassigned') {
    return false;
  }
  if (hasServerAssignment(result)) {
    return false;
  }
  const apiDriverId =
    parseAssignmentDriverId(result.assignment?.driverID) ??
    parseAssignmentDriverId(result.driverID);
  return apiDriverId == null;
}
