/**
 * routeID for controller=vehicle&action=update — mirrors iOS selectedRoute (nil → -1).
 * Prefer tablet route; hold dashboard assignment route during transient empty polls.
 */

import type { VehicleAssignmentPayload } from '@/api/position.api';
import { parseAssignmentDriverId } from '@/utils/assignmentDriverId';
import { isAssignedRouteId } from '@/utils/helpers';

export function getMdtRouteIdForVehicleUpdate(params: {
  selectedRouteId: string | null | undefined;
  serviceStatus: 'in_service' | 'out_of_service';
  routeOverride: boolean;
  assignment: VehicleAssignmentPayload | null;
  stickyAssignmentRouteId: string | null;
  currentRouteIdFromApi: string | null;
}): string | number {
  if (isAssignedRouteId(params.selectedRouteId)) {
    return params.selectedRouteId!;
  }

  if (params.routeOverride && params.serviceStatus === 'out_of_service') {
    return -1;
  }

  const fromAssignment = parseAssignmentDriverId(params.assignment?.routeID);
  if (isAssignedRouteId(fromAssignment)) {
    return fromAssignment!;
  }

  if (isAssignedRouteId(params.currentRouteIdFromApi)) {
    return params.currentRouteIdFromApi!;
  }

  if (isAssignedRouteId(params.stickyAssignmentRouteId)) {
    return params.stickyAssignmentRouteId!;
  }

  return -1;
}

/** Prefer assignment.routeID — server currentRouteID can lag after a route change. */
export function pickRouteIdFromAssignmentPoll(
  assignmentRouteId: string | null | undefined,
  currentRouteId: string | null | undefined,
  fallbackRouteId: string | null | undefined,
): string | null {
  if (isAssignedRouteId(assignmentRouteId)) {
    return assignmentRouteId!;
  }
  if (isAssignedRouteId(currentRouteId)) {
    return currentRouteId!;
  }
  if (isAssignedRouteId(fallbackRouteId)) {
    return fallbackRouteId!;
  }
  return null;
}

/**
 * routeID for vehicle/update — align with the route polyline on the device map (GPX / route.points).
 */
export function resolveTelemetryRouteId(params: {
  selectedRouteId?: string | null;
  mapEffectiveRouteId?: string | null;
  pinnedTelemetryRouteId?: string | null;
  mdtRouteId: string | number;
}): string | number {
  if (isAssignedRouteId(params.selectedRouteId)) {
    return params.selectedRouteId!;
  }
  if (isAssignedRouteId(params.mapEffectiveRouteId)) {
    return params.mapEffectiveRouteId!;
  }
  if (isAssignedRouteId(params.pinnedTelemetryRouteId)) {
    return params.pinnedTelemetryRouteId!;
  }
  return params.mdtRouteId;
}
