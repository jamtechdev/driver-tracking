/**
 * Block Manifest API
 * Handles calendar, manifest listing, assignment lookup, and vehicle assignment.
 */

import { PEAK_BASE_URL, PEAK_DEFAULT_PARAMS } from '@/config/env';

const AGENCY_ID = '121';

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

function todayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/** Step 1: Get active calendarIDs for today */
export async function getCalendarIDs(date?: string): Promise<number[]> {
  const d = date ?? todayDateString();
  const url = `${PEAK_BASE_URL}&controller=calendar&action=between&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&from=${d}&to=${d}`;
  const res = await fetch(url);
  const json = await res.json();
  const ids = json?.calendar?.calendarID;
  return Array.isArray(ids) ? ids : [];
}

/** Step 2: Get block manifests for a single calendarID */
async function getManifestsForCalendar(calendarID: number): Promise<BlockManifest[]> {
  const url = `${PEAK_BASE_URL}&controller=manifests&action=list&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&calendarID=${calendarID}`;
  const res = await fetch(url);
  const json = await res.json();
  return Array.isArray(json?.manifests) ? json.manifests : [];
}

/** Step 3: Get manifestAssignmentIDs already assigned for today */
async function getAssignedManifestIDs(date?: string): Promise<number[]> {
  const d = date ?? todayDateString();
  const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=between&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&from=${d}&to=${d}`;
  const res = await fetch(url);
  const json = await res.json();
  const ids = json?.manifestAssignments?.manifestAssignmentID;
  return Array.isArray(ids) ? ids : [];
}

/** Step 4: Get a single ManifestAssignment object */
async function getManifestAssignment(manifestAssignmentID: number): Promise<ManifestAssignment | null> {
  const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=list&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&manifestAssignmentID=${manifestAssignmentID}`;
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
  return manifestArrays.flat().filter((m) => !m.disabled && !m.hidden);
}

/**
 * Fetches all available (unassigned) block manifests for today.
 * Combines steps 1–4.
 */
export async function getAvailableBlockManifests(date?: string): Promise<BlockManifest[]> {
  const [calendarIDs, assignmentIDs] = await Promise.all([
    getCalendarIDs(date),
    getAssignedManifestIDs(date),
  ]);

  // Fetch all manifests across all calendars in parallel
  const manifestArrays = await Promise.all(calendarIDs.map(getManifestsForCalendar));
  // console.log('All Manifest Array ------>>>>>.', manifestArrays);

  const allManifests = manifestArrays.flat().filter((m) => !m.disabled && !m.hidden);

  if (assignmentIDs.length === 0) return allManifests;
  const assignments = await Promise.all(assignmentIDs.map(getManifestAssignment));

  //   console.log('All Assignments ------->>>', assignments);
  return allManifests.filter((m) => m.type === 'block');
  // Fetch all existing assignments in parallel to find already-assigned manifestIDs
  // const assignedManifestIDs = new Set(
  //   assignments.filter(Boolean).map((a) => a!.manifestID)
  // );

  // return allManifests.filter((m) => !assignedManifestIDs.has(m.manifestID));
}

/** Step 5: Assign a block manifest to a vehicle */
export async function assignBlockManifest(
  manifestID: number,
  vehicleID: string,
  date?: string
): Promise<boolean> {
  const d = date ?? todayDateString();
  const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=assignvehicle&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&startDate=${d}&endDate=${d}&vehicleID=${vehicleID}&manifestID=${manifestID}`;
  const res = await fetch(url);
  const json = await res.json();
  console.log('API Response Assign Block ----->>>>', json);
  return json?.success === true;
}

/** Fetch all manifest assignments for a vehicle on a specific date */
// export async function getManifestAssignmentsByVehicle(
//   vehicleID: string,
//   date?: string
// ): Promise<ManifestAssignment[]> {
//   const d = date ?? todayDateString();
//   const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=list&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&startDate=${d}&endDate=${d}&vehicleID=${vehicleID}`;
//   const res = await fetch(url);
//   const json: ManifestAssignmentsResponse = await res.json();
//   return json.success && Array.isArray(json.manifestAssignments) ? json.manifestAssignments : [];
// }

export async function getManifestAssignmentsByVehicle(
  vehicleID: string,
  date?: string
): Promise<ManifestAssignment[]> {
  const d = date ?? todayDateString();

  // Fetch all assignments for the date (without vehicleID)
  const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=list&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&startDate=${d}&endDate=${d}`;
  // console.log('URL ------->>>', url);
  const res = await fetch(url);
  const json: ManifestAssignmentsResponse = await res.json();

  // Filter assignments locally for the given vehicleID
  const allAssignments = json.success && Array.isArray(json.manifestAssignments)
    ? json.manifestAssignments
    : [];
  // console.log('All Manifest Assignments for Today ------->>>', allAssignments);
  return allAssignments.filter(a => String(a.vehicleID) == String(vehicleID));
}

/** Delete a manifest assignment */
export async function deleteManifestAssignment(manifestAssignmentID: number): Promise<boolean> {
  const url = `${PEAK_BASE_URL}&controller=manifest_assignments&action=delete&agencyID=${PEAK_DEFAULT_PARAMS.agencyID}&manifestAssignmentID=${manifestAssignmentID}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.success === true;
}
