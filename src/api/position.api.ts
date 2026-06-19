/**
 * Position / Map APIs - Peak Transit MDT & vehicle position updates
 * Matches DriverModel: MDT heartbeat (10s) and vehicle update (5s when tracking).
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';
import { coerceDriverIdForApi } from '@/utils/outboundDriverId';
import { mdtUuidForApi } from '@/utils/mdtId';

const TIMEOUT = API_CONFIG.TIMEOUT;

function readAxiosData<T>(resp: { data?: T } | undefined | null, label: string): T {
  if (resp == null || resp.data === undefined) {
    throw new Error(`${label}: empty HTTP response`);
  }
  return resp.data;
}

/** Build a GET URL with query params (numbers and strings encoded). */
function buildUrl(params: Record<string, string | number | boolean | undefined>): string {
  const search = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${PEAK_BASE_URL}&${search}`;
}

// ---------------------------------------------------------------------------
// A) MDT update (device heartbeat ~every 10s) – controller=mdt&action=update
// ---------------------------------------------------------------------------

export interface MdtUpdateParams {
  agencyID: string | number;
  vehicleID: string | number;
  vehicleAssignmentUpdated?: number;
  driverID: string | number;
  lat: number;
  lng: number;
  course?: number;
  speed?: number;
  horizontalAccuracy?: number;
  verticalAccuracy?: number;
  osVersion?: string;
  thermalState?: number;
  batteryLevel?: number;
  batteryState?: number;
  d?: number;
  screenBrightness?: number;
  connectionType?: string;
  ssid?: string;
  mdtUUID?: string;
  deviceSerial?: string;
  deviceName?: string;
  appVersion?: string;
  updating?: boolean;
  isLocationServiceOn?: number;
  locationAuthStatus?: string;
}

export async function mdtUpdate(params: MdtUpdateParams): Promise<any> {
  const url = buildUrl({
    controller: 'mdt',
    action: 'update',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    vehicleAssignmentUpdated: params.vehicleAssignmentUpdated ?? 0,
    driverID: coerceDriverIdForApi(params.driverID),
    lat: params.lat,
    lng: params.lng,
    // course: params.course ?? 0,
    speed: params.speed ?? 0,
    horizontalAccuracy: params.horizontalAccuracy ?? 0,
    verticalAccuracy: params.verticalAccuracy ?? 0,
    osVersion: params.osVersion ?? '',
    thermalState: params.thermalState ?? 0,
    batteryLevel: params.batteryLevel ?? 100,
    batteryState: params.batteryState ?? 2,
    d: params.d ?? 1,
    screenBrightness: (params.screenBrightness ?? 100) / 100,
    connectionType: params.connectionType ?? 'wifi',
    ssid: params.ssid ?? '',
    mdtUUID: mdtUuidForApi(params.mdtUUID),
    deviceSerial: params.deviceSerial ?? '',
    deviceName: params.deviceName ?? 'MDT',
    appVersion: params.appVersion ?? '0.0.1',
    updating: params.updating ?? false,
    isLocationServiceOn: params.isLocationServiceOn ?? 1,
    locationAuthStatus: params.locationAuthStatus ?? 'authorized',
  });
  const resp = await axios.get(url, { timeout: TIMEOUT });
  return readAxiosData(resp, 'mdtUpdate');
}

// ---------------------------------------------------------------------------
// B) Vehicle update (moves vehicle on map, ~every 5s when tracking)
// Full URL: .../controller=vehicle&action=update&agencyID=&vehicleID=&routeID=&driverID=&lat=&lng=&course=&speed=&batteryLevel=&batteryState=&source=MDT&d=1&minsLate=
// Speed must be in mph (lastLocation.speed is m/s → multiply by MPS_TO_MPH).
// ---------------------------------------------------------------------------

/** m/s → mph (for vehicle update API). */
const MPS_TO_MPH = 2.23694;

export interface VehicleUpdateParams {
  agencyID: string | number;
  vehicleID: string | number;
  routeID: string | number;
  driverID: string | number;
  lat: number;
  lng: number;
  course?: number;  // degrees (0–360)
  speed?: number;  // mph
  batteryLevel?: number;
  batteryState?: number;
  source?: string;
  d?: number;
  minsLate?: number;
}

export async function vehicleUpdate(params: VehicleUpdateParams): Promise<void> {
  const url = buildUrl({
    controller: 'vehicle',
    action: 'update',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    routeID: params.routeID ?? 0,
    driverID: coerceDriverIdForApi(params.driverID),
    lat: params.lat,
    lng: params.lng,
    course: Math.round(Number(params.course ?? 0)),
    speed: Math.round(Number(params.speed ?? 0)),
    batteryLevel: params.batteryLevel ?? 100,
    batteryState: params.batteryState ?? 2,
    source: params.source ?? 'MDT',
    d: params.d ?? 1,
    minsLate: params.minsLate,
  });
  // console.log('Vehicle Update Params:', params);
  // console.log('Vehicle Update URL:', JSON.stringify(url));
  const resp = await axios.get(url, { timeout: TIMEOUT });
  console.log('Vehicle Update Response:', JSON.stringify(resp?.data));
  return readAxiosData(resp, 'vehicleUpdate');
}

/** Convert speed from m/s (Geolocation) to mph for vehicle update API. */
export function speedMpsToMph(mps: number | undefined | null): number {
  if (mps == null || !Number.isFinite(mps) || mps < 0) return 0;
  return mps * MPS_TO_MPH;
}

// ---------------------------------------------------------------------------
// Assignment & schedule (map data)
// ---------------------------------------------------------------------------

/** Assignment object from controller=driver&action=assignment (iOS DriverModel). */
export interface VehicleAssignmentPayload {
  routeID?: string | number;
  driverID?: string | number;
  locked?: boolean | number | string;
  [key: string]: unknown;
}

/** Current route/driver assignment for the vehicle. */
export interface AssignmentResponse {
  success?: boolean;
  hasAssignment?: boolean | number | string;
  assignment?: VehicleAssignmentPayload;
  currentRouteID?: string | number;
  vehicleID?: string | number;
  routeID?: string | number;
  driverID?: string | number;
  [key: string]: unknown;
}

export async function getAssignment(
  vehicleID: string | number,
  agencyID: string | number
): Promise<AssignmentResponse> {
  const url = buildUrl({
    controller: 'driver',
    action: 'assignment',
    vehicleID,
    agencyID,
  });
  console.log('Assignment URL:', url);
  const resp = await axios.get<AssignmentResponse>(url, { timeout: TIMEOUT });
  const data = readAxiosData(resp, 'getAssignment');
  console.log('Assignment Response:', JSON.stringify(data));
  return data;
}

/** Tablet-initiated driver login (iOS selectDriverID manual path). */
export async function driverLogin(params: {
  agencyID: string | number;
  vehicleID: string | number;
  driverID: string | number;
}): Promise<unknown> {
  const url = buildUrl({
    controller: 'vehicleassignments',
    action: 'driverlogin',
    source: 'MDT',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    driverID: params.driverID,
  });
  const resp = await axios.get(url, { timeout: TIMEOUT });
  return readAxiosData(resp, 'driverLogin');
}

export function isPeakApiSuccess(data: unknown): boolean {
  if (data == null || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    d.success === true ||
    d.success === 'true' ||
    d.success === 1 ||
    d.success === '1'
  );
}

export function peakApiErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    const msg = d.errormsg ?? d.message ?? d.errorMessage;
    if (msg != null && String(msg).trim()) return String(msg);
  }
  return fallback;
}

/** Tablet-initiated driver logout (iOS selectDriverID unassign / sync path). */
export async function driverLogout(params: {
  agencyID: string | number;
  vehicleID: string | number;
  driverID: string | number;
}): Promise<unknown> {
  const url = buildUrl({
    controller: 'vehicleassignments',
    action: 'driverlogout',
    source: 'MDT',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    driverID: params.driverID,
  });
  if (__DEV__) {
    console.log('[position.api] driverlogout', url);
  }
  const resp = await axios.get(url, { timeout: TIMEOUT });
  const data = readAxiosData(resp, 'driverLogout');
  if (__DEV__) {
    console.log('[position.api] driverlogout response', data);
  }
  return data;
}

/**
 * Clear driver on the server vehicle assignment (dashboard reads this record).
 * driverlogout alone does not always clear assignment.driverID — selfupdate with driverID 0 does.
 */
export async function clearServerDriverAssignment(params: {
  agencyID: string | number;
  vehicleID: string | number;
  routeID: string | number;
  previousDriverID: string | number;
}): Promise<{ success: boolean; errorMessage?: string }> {
  const errors: string[] = [];

  try {
    await driverLogout({
      agencyID: params.agencyID,
      vehicleID: params.vehicleID,
      driverID: params.previousDriverID,
    });
  } catch (e) {
    console.warn('[position.api] driverlogout during unassign failed:', e);
    errors.push('Driver logout failed');
  }

  try {
    const resp = await selfUpdateAssignment({
      agencyID: params.agencyID,
      vehicleID: params.vehicleID,
      routeID: params.routeID,
      driverID: 0,
    });
    const data = resp ?? {};
    const ok = data.success === true || data.success === 'true' || data.success === 1;
    if (!ok) {
      errors.push(String(data.errormsg ?? data.message ?? 'Failed to clear driver on assignment'));
    }
  } catch (e) {
    console.warn('[position.api] selfUpdate driverID 0 during unassign failed:', e);
    errors.push('Failed to update assignment');
  }

  return {
    success: errors.length === 0,
    errorMessage: errors.length > 0 ? errors.join('. ') : undefined,
  };
}

/** Schedule/route for driver (links, schedule items – for “where am I on the route”). */
export interface RouteForDriverResponse {
  success?: boolean;
  routeID?: string | number;
  links?: unknown[];
  schedule?: unknown[];
  [key: string]: unknown;
}

export async function getRouteForDriver(
  routeID: string | number,
  agencyID: string | number
): Promise<RouteForDriverResponse> {
  const url = buildUrl({
    controller: 'schedule',
    action: 'routefordriver',
    routeID,
    agencyID,
  });
  const resp = await axios.get<RouteForDriverResponse>(url, { timeout: TIMEOUT });
  return readAxiosData(resp, 'getRouteForDriver');
}

// ---------------------------------------------------------------------------
// C) Self-dispatch / Self-update assignment
// ---------------------------------------------------------------------------

export async function selfUpdateAssignment(params: {
  agencyID: string | number;
  vehicleID: string | number;
  routeID: string | number;
  driverID: string | number;
}): Promise<any> {
  const url = buildUrl({
    controller: 'vehicleassignments',
    action: 'selfupdate',
    source: 'MDT',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    routeID: params.routeID,
    driverID: params.driverID,
  });
  const resp = await axios.get(url, { timeout: TIMEOUT });
  const data = readAxiosData(resp, 'selfUpdateAssignment');
  console.log('Self Update Assignment Response:', data);
  return data;
}

// ---------------------------------------------------------------------------
// D) Vehicles2 alert update (emergency slider activated/deactivated)
// ---------------------------------------------------------------------------

export async function vehicles2Alert(params: {
  agencyID: string | number;
  vehicleID: string | number;
  alert: 0 | 1;
}): Promise<any> {
  const url = buildUrl({
    controller: 'Vehicles2',
    action: 'update',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    alert: params.alert,
  });
  const resp = await axios.get(url, { timeout: TIMEOUT });
  const data = readAxiosData(resp, 'vehicles2Alert');
  console.log('Vehicles2 Alert Response:', data);
  return data;
}

export type SelfUpdateDeleteResult = {
  success: boolean;
  errorMessage?: string;
  [key: string]: unknown;
};

export async function selfUpdateDelete(params: {
  agencyID: string | number;
  vehicleID: string | number;
  driverID: string | number;
}): Promise<SelfUpdateDeleteResult> {
  const url = buildUrl({
    controller: 'vehicleassignments',
    action: 'selfupdatedelete',
    source: 'MDT',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    driverID: params.driverID,
  });
  const resp = await axios.get(url, { timeout: TIMEOUT });
  const data = readAxiosData(resp, 'selfUpdateDelete') ?? {};
  const success = data.success === true || data.success === 'true';
  return {
    ...data,
    success,
    errorMessage: success
      ? undefined
      : String(data.errormsg ?? data.message ?? 'Failed to clear vehicle route assignment'),
  };
}
