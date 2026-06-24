/**
 * Mirrors iOS DriverModel selectDriverID + clears assignment.driverID for dashboard.
 */

import {
  driverLogin,
  driverLogout,
  selfUpdateAssignment,
  getAssignment,
  isPeakApiSuccess,
  peakApiErrorMessage,
} from '@/api/position.api';
import { lookupDriverByIdFromRoster } from '@/utils/driverLookup';
import { resolveRouteIdForServer } from '@/utils/resolveRouteIdForServer';
import type { Driver } from '@/data/drivers';
import type { VehicleAssignmentPayload } from '@/api/position.api';
import { PEAK_DEFAULT_PARAMS } from '@/config/env';
import {
  getAssignedDriverIdFromResult,
  resolveVehicleAssignmentSources,
} from '@/utils/assignmentDriverId';

const agencyID = String(PEAK_DEFAULT_PARAMS.agencyID);

export type DriverAssignmentResult = {
  success: boolean;
  errorMessage?: string;
};

function logoutDriverId(current: Driver | null): string {
  if (!current || current.role === 'unassigned') return '0';
  return String(current.id);
}

function parseAssignmentDriverId(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 0 || raw === '0') return null;
  return String(raw).trim();
}

async function resolveDriverFromAssignment(
  assignment: VehicleAssignmentPayload,
): Promise<Driver | null> {
  const id = parseAssignmentDriverId(assignment.driverID);
  if (!id) return null;
  return lookupDriverByIdFromRoster(id);
}

/**
 * iOS selectDriverID(-1). When clearAssignmentRecord is true (tablet Unassigned),
 * also selfupdates driverID 0 so the dashboard assignment clears.
 * Poll sync uses clearAssignmentRecord: false (logout only, no repeated selfupdate).
 */
export async function applyDriverUnassignedIos(params: {
  vehicleId: string;
  currentDriver: Driver | null;
  selectedRouteId?: string | null;
  selectedManifestId?: number | null;
  /** Manual unassign from tablet — clear assignment.driverID on server. Default false. */
  clearAssignmentRecord?: boolean;
}): Promise<DriverAssignmentResult> {
  const clearAssignmentRecord = params.clearAssignmentRecord === true;
  const errors: string[] = [];
  let assignmentDriverId = logoutDriverId(params.currentDriver);

  try {
    const assignmentResp = await getAssignment(params.vehicleId, agencyID);
    const fromServer = parseAssignmentDriverId(assignmentResp.assignment?.driverID);
    if (fromServer) {
      assignmentDriverId = fromServer;
    }
  } catch (e) {
    console.warn('[driverAssignment] getAssignment before unassign failed:', e);
  }

  if (assignmentDriverId !== '0') {
    try {
      const logoutData = await driverLogout({
        agencyID,
        vehicleID: params.vehicleId,
        driverID: assignmentDriverId,
      });
      if (!isPeakApiSuccess(logoutData)) {
        errors.push(peakApiErrorMessage(logoutData, 'driverlogout failed'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[driverAssignment] driverlogout error:', msg);
      errors.push(`driverlogout: ${msg}`);
    }
  }

  if (clearAssignmentRecord) {
    const routeID = await resolveRouteIdForServer({
      vehicleId: params.vehicleId,
      selectedRouteId: params.selectedRouteId ?? null,
      selectedManifestId: params.selectedManifestId ?? null,
    });
    try {
      const updateData = await selfUpdateAssignment({
        agencyID,
        vehicleID: params.vehicleId,
        routeID,
        driverID: 0,
      });
      if (!isPeakApiSuccess(updateData)) {
        errors.push(peakApiErrorMessage(updateData, 'selfupdate driverID 0 failed'));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[driverAssignment] selfupdate driverID 0 error:', msg);
      errors.push(`selfupdate: ${msg}`);
    }
  }

  const result: DriverAssignmentResult = {
    success: errors.length === 0,
    errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
  };

  if (__DEV__) {
    console.log('[driverAssignment] applyDriverUnassignedIos', {
      vehicleId: params.vehicleId,
      assignmentDriverId,
      clearAssignmentRecord,
      result,
    });
  }

  return result;
}

/**
 * iOS selectDriverID(-2) when updateAssignment has hasAssignment:
 * driverlogout current MDT selectedDriver, then set selectedDriver from assignment.
 * No driverlogin — MDT/vehicle use selectedDriver afterward.
 */
export async function selectDriverFromAssignmentIos(params: {
  vehicleId: string;
  currentDriver: Driver | null;
  assignment: VehicleAssignmentPayload;
}): Promise<Driver | null> {
  const targetId = parseAssignmentDriverId(params.assignment.driverID);
  if (!targetId) return null;

  const currentId = logoutDriverId(params.currentDriver);
  if (currentId !== '0' && currentId !== targetId) {
    try {
      await driverLogout({
        agencyID,
        vehicleID: params.vehicleId,
        driverID: currentId,
      });
    } catch (e) {
      console.warn('[driverAssignment] selectDriverID(-2) driverlogout:', e);
    }
  }

  return resolveDriverFromAssignment(params.assignment);
}

/** @deprecated Use selectDriverFromAssignmentIos */
export const applyDriverFromAssignmentIos = selectDriverFromAssignmentIos;

/**
 * On cold start: adopt dashboard/dispatch driver before MDT sends driverID 0.
 */
export async function bootstrapDriverFromServerAssignment(
  vehicleId: string,
): Promise<Driver | null> {
  if (!vehicleId || vehicleId === '110') return null;
  try {
    const result = await getAssignment(vehicleId, agencyID);
    const { assignedDriverId, assignment } = await resolveVehicleAssignmentSources(
      vehicleId,
      result,
    );
    if (!assignedDriverId || !assignment) return null;

    return applyDriverFromAssignmentIos({
      vehicleId,
      currentDriver: null,
      assignment,
    });
  } catch (e) {
    console.warn('[driverAssignment] bootstrap from assignment failed:', e);
    return null;
  }
}

/** iOS selectDriverID(manual id): driverlogin; driverOverride = YES */
export async function applyDriverManualIos(params: {
  vehicleId: string;
  driver: Driver;
}): Promise<void> {
  if (params.driver.role === 'unassigned') return;
  const data = await driverLogin({
    agencyID,
    vehicleID: params.vehicleId,
    driverID: String(params.driver.id),
  });
  if (!isPeakApiSuccess(data)) {
    throw new Error(peakApiErrorMessage(data, 'driverlogin failed'));
  }
}
