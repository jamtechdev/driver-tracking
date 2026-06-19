import type { AssignmentResponse, VehicleAssignmentPayload } from '@/api/position.api';
import { getDriverData } from '@/api/driverData.api';
import { hasServerAssignment } from '@/utils/assignmentSync';
import { findDriverById } from '@/utils/driverLookup';

export function parseAssignmentDriverId(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 0 || raw === '0') return null;
  return String(raw).trim();
}

/** driverID from assignment object or top-level assignment API response. */
export function getAssignedDriverIdFromResult(
  result: AssignmentResponse,
  assignment?: VehicleAssignmentPayload | null,
): string | null {
  return (
    parseAssignmentDriverId(assignment?.driverID) ??
    parseAssignmentDriverId(result.driverID) ??
    null
  );
}

/** iOS selectedDriver[@"driverName"] via drivers[] lookup (not assignment payload). */
export function getAssignmentDriverDisplayName(driverId: string): string {
  const found = findDriverById(driverId);
  if (found?.name) {
    return found.name;
  }
  return `Driver ${driverId}`;
}

export type ResolvedVehicleAssignment = {
  assignedDriverId: string | null;
  assignment: VehicleAssignmentPayload | null;
  hasAssignment: boolean;
};

/**
 * Dashboard map may set vehicle.driverID before assignment.hasAssignment flips true.
 */
export async function resolveVehicleAssignmentSources(
  vehicleId: string,
  result: AssignmentResponse,
): Promise<ResolvedVehicleAssignment> {
  const assignment = result.assignment ?? null;
  let assignedDriverId = getAssignedDriverIdFromResult(result, assignment);

  if (!assignedDriverId) {
    try {
      const data = await getDriverData();
      const vehicles = Array.isArray(data?.vehicle) ? data.vehicle : [];
      const match = vehicles.find(
        (v: { vehicleID?: string | number; vehicleNumber?: string | number; driverID?: string | number }) =>
          String(v.vehicleID) === String(vehicleId) ||
          String(v.vehicleNumber) === String(vehicleId),
      );
      const fromVehicle = parseAssignmentDriverId(match?.driverID);
      if (fromVehicle) {
        assignedDriverId = fromVehicle;
      }
    } catch {
      // ignore
    }
  }

  const mergedAssignment: VehicleAssignmentPayload | null =
    assignedDriverId
      ? {
          ...(assignment ?? {}),
          driverID: assignedDriverId,
        }
      : assignment;

  const hasAssignment =
    hasServerAssignment(result) ||
    !!assignedDriverId ||
    (assignment != null && (
      parseAssignmentDriverId(assignment.routeID) != null ||
      parseAssignmentDriverId(assignment.driverID) != null
    ));

  return {
    assignedDriverId,
    assignment: mergedAssignment,
    hasAssignment,
  };
}
