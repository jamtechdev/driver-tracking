/**
 * Block Manifest API
 * Handles calendar, manifest listing, assignment lookup, and vehicle assignment.
 */

import { PEAK_BASE_URL, PEAK_DEFAULT_PARAMS } from '@/config/env';
import { selfUpdateAssignment, selfUpdateDelete } from '@/api/position.api';
import { getPrimaryRouteIdFromManifestJson } from '@/utils/manifestMap';

export interface BlockManifest {
  manifestID: number;
  agencyID: number;
  name: string;
  type: string;
  manifest: string;
  manifestJson: string;
  hidden: boolean;
  calendarID: number;
  updated: number;
  disabled: boolean;
}

export interface ManifestAssignment {
  manifestAssignmentID: number;
  agencyID: number;
  manifestID: number;
  driverID: number;
  vehicleID: number;
  startDate: string;
  endDate: string;
  disabled: boolean;
}

export interface ManifestAssignmentsResponse {
  manifestAssignments: ManifestAssignment[];
  success: boolean;
}

export type AssignBlockManifestResult = {
  success: boolean;
  errorMessage?: string;
};

/** Local calendar date YYYY-MM-DD (agency day, not UTC). */
function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function agencyId(): string {
  return String(PEAK_DEFAULT_PARAMS.agencyID);
}

function buildManifestUrl(params: Record<string, string | number>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${PEAK_BASE_URL}&${qs}`;
}

/** Step 1: Get active calendarIDs for today */
export async function getCalendarIDs(date?: string): Promise<number[]> {
  const d = date ?? todayDateString();
  const url = buildManifestUrl({
    controller: 'calendar',
    action: 'between',
    agencyID: agencyId(),
    from: d,
    to: d,
  });
  const res = await fetch(url);
  const json = await res.json();
  const ids = json?.calendar?.calendarID;
  return Array.isArray(ids) ? ids : ids != null ? [ids] : [];
}

/** Step 2: Get block manifests for a single calendarID */
async function getManifestsForCalendar(calendarID: number): Promise<BlockManifest[]> {
  const url = buildManifestUrl({
    controller: 'manifests',
    action: 'list',
    agencyID: agencyId(),
    calendarID,
  });
  const res = await fetch(url);
  const json = await res.json();
  return Array.isArray(json?.manifests) ? json.manifests : [];
}

/** Step 3: Get manifestAssignmentIDs already assigned for today */
async function getAssignedManifestIDs(date?: string): Promise<number[]> {
  const d = date ?? todayDateString();
  const url = buildManifestUrl({
    controller: 'manifest_assignments',
    action: 'between',
    agencyID: agencyId(),
    from: d,
    to: d,
  });
  const res = await fetch(url);
  const json = await res.json();
  const ids = json?.manifestAssignments?.manifestAssignmentID;
  return Array.isArray(ids) ? ids : ids != null ? [ids] : [];
}

/** Step 4: Get a single ManifestAssignment object */
async function getManifestAssignment(manifestAssignmentID: number): Promise<ManifestAssignment | null> {
  const url = buildManifestUrl({
    controller: 'manifest_assignments',
    action: 'list',
    agencyID: agencyId(),
    manifestAssignmentID,
  });
  const res = await fetch(url);
  const json = await res.json();
  const list = json?.manifestAssignments;
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Fetches all block manifests for today (regardless of assignment).
 */
export async function getManifestsForToday(date?: string): Promise<BlockManifest[]> {
  const calendarIDs = await getCalendarIDs(date);
  const manifestArrays = await Promise.all(calendarIDs.map(getManifestsForCalendar));
  return manifestArrays
    .flat()
    .filter((m) => !m.disabled && !m.hidden && m.type === 'block');
}

/**
 * Fetches block manifests for today that are not yet assigned.
 */
export async function getAvailableBlockManifests(date?: string): Promise<BlockManifest[]> {
  const [calendarIDs, assignmentIDs] = await Promise.all([
    getCalendarIDs(date),
    getAssignedManifestIDs(date),
  ]);

  const manifestArrays = await Promise.all(calendarIDs.map(getManifestsForCalendar));
  const blockManifests = manifestArrays
    .flat()
    .filter((m) => !m.disabled && !m.hidden && m.type === 'block');

  if (assignmentIDs.length === 0) return blockManifests;

  const assignments = await Promise.all(assignmentIDs.map(getManifestAssignment));
  const assignedManifestIDs = new Set(
    assignments.filter(Boolean).map((a) => a!.manifestID),
  );

  return blockManifests.filter((m) => !assignedManifestIDs.has(m.manifestID));
}

/** Assign a block manifest to a vehicle (requires driverID for backend persistence). */
export async function assignBlockManifest(
  manifestID: number,
  vehicleID: string,
  driverID: string | number,
  date?: string,
): Promise<AssignBlockManifestResult> {
  const d = date ?? todayDateString();
  const url = buildManifestUrl({
    controller: 'manifest_assignments',
    action: 'assignvehicle',
    agencyID: agencyId(),
    startDate: d,
    endDate: d,
    vehicleID,
    manifestID,
    driverID,
  });

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json?.success === true) {
      return { success: true };
    }
    return {
      success: false,
      errorMessage:
        json?.errormsg || json?.message || 'Block assignment was rejected by the server',
    };
  } catch (e) {
    return {
      success: false,
      errorMessage: e instanceof Error ? e.message : 'Network error during block assignment',
    };
  }
}

/**
 * Full block assignment: manifest_assignments + vehicle route self-update + verify persisted.
 */
export async function assignBlockToVehicle(params: {
  block: BlockManifest;
  vehicleID: string;
  driverID: string | number;
  date?: string;
}): Promise<AssignBlockManifestResult & { routeID: string | null }> {
  const { block, vehicleID, driverID, date } = params;

  const assignResult = await assignBlockManifest(
    block.manifestID,
    vehicleID,
    driverID,
    date,
  );
  if (!assignResult.success) {
    return { ...assignResult, routeID: null };
  }

  const routeID = getPrimaryRouteIdFromManifestJson(block.manifestJson);

  const persisted = await getManifestAssignmentsByVehicle(vehicleID, date);
  if (!persisted.some((a) => !a.disabled && a.manifestID === block.manifestID)) {
    console.warn(
      '[manifests.api] assignvehicle succeeded; manifest list not yet showing vehicle — continuing with route sync',
    );
  }
  if (routeID) {
    try {
      await selfUpdateAssignment({
        agencyID: agencyId(),
        vehicleID,
        routeID,
        driverID,
      });
    } catch (e) {
      console.warn('[manifests.api] selfUpdateAssignment after block assign failed:', e);
    }
  }

  return { success: true, routeID };
}

/** All manifest assignments for a given date. */
export async function getManifestAssignmentsForToday(
  date?: string,
): Promise<ManifestAssignment[]> {
  const d = date ?? todayDateString();
  const url = buildManifestUrl({
    controller: 'manifest_assignments',
    action: 'list',
    agencyID: agencyId(),
    startDate: d,
    endDate: d,
  });
  const res = await fetch(url);
  const json: ManifestAssignmentsResponse = await res.json();
  return json.success && Array.isArray(json.manifestAssignments)
    ? json.manifestAssignments
    : [];
}

export async function getManifestAssignmentsByVehicle(
  vehicleID: string,
  date?: string,
): Promise<ManifestAssignment[]> {
  const assignmentIDs = await getAssignedManifestIDs(date);
  if (assignmentIDs.length === 0) return [];

  const assignments = await Promise.all(assignmentIDs.map(getManifestAssignment));
  return assignments
    .filter((a): a is ManifestAssignment => a != null && !a.disabled)
    .filter((a) => String(a.vehicleID) === String(vehicleID));
}

/**
 * Fully release a vehicle (out of service): remove block manifests and clear route assignment.
 * Use from Route tab or Block tab when selecting Out of Service.
 */
export async function releaseVehicleForOutOfService(params: {
  vehicleID: string;
  driverID: string | number;
}): Promise<AssignBlockManifestResult> {
  const { vehicleID, driverID } = params;
  const errors: string[] = [];

  try {
    const existing = await getManifestAssignmentsByVehicle(vehicleID);
    for (const assignment of existing) {
      if (assignment.disabled) continue;
      const deleted = await deleteManifestAssignment(assignment.manifestAssignmentID);
      if (!deleted) {
        errors.push(`Failed to remove block assignment ${assignment.manifestAssignmentID}`);
      }
    }
  } catch (e) {
    console.warn('[manifests.api] Error clearing block assignments:', e);
    errors.push('Failed to clear block assignments');
  }

  try {
    const deleteResult = await selfUpdateDelete({
      agencyID: agencyId(),
      vehicleID,
      driverID,
    });
    if (!deleteResult.success) {
      errors.push(deleteResult.errorMessage ?? 'Failed to clear route assignment');
    }
  } catch (e) {
    console.warn('[manifests.api] selfUpdateDelete failed:', e);
    errors.push('Failed to clear route assignment');
  }

  try {
    await selfUpdateAssignment({
      agencyID: agencyId(),
      vehicleID,
      routeID: 0,
      driverID,
    });
  } catch (e) {
    console.warn('[manifests.api] selfUpdateAssignment routeID 0 after OOS failed:', e);
  }

  return {
    success: errors.length === 0,
    errorMessage: errors.length > 0 ? errors.join('. ') : undefined,
  };
}

/** Delete a manifest assignment */
export async function deleteManifestAssignment(manifestAssignmentID: number): Promise<boolean> {
  const url = buildManifestUrl({
    controller: 'manifest_assignments',
    action: 'delete',
    agencyID: agencyId(),
    manifestAssignmentID,
  });
  const res = await fetch(url);
  const json = await res.json();
  return json.success === true;
}
