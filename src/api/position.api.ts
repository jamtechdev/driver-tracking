/**
 * Position / Map APIs - Peak Transit MDT & vehicle position updates
 * Matches DriverModel: MDT heartbeat (10s) and vehicle update (5s when tracking).
 */

import axios from 'axios';
import { PEAK_BASE_URL } from '@/config/env';
import { API_CONFIG } from '@/config/api.config';

const TIMEOUT = API_CONFIG.TIMEOUT;

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

export async function mdtUpdate(params: MdtUpdateParams): Promise<void> {
  const url = buildUrl({
    controller: 'mdt',
    action: 'update',
    agencyID: params.agencyID,
    vehicleID: params.vehicleID,
    vehicleAssignmentUpdated: params.vehicleAssignmentUpdated ?? 0,
    driverID: params.driverID,
    lat: params.lat,
    lng: params.lng,
    course: params.course ?? 0,
    speed: params.speed ?? 0,
    horizontalAccuracy: params.horizontalAccuracy ?? 0,
    verticalAccuracy: params.verticalAccuracy ?? 0,
    osVersion: params.osVersion ?? '',
    thermalState: params.thermalState ?? 0,
    batteryLevel: params.batteryLevel ?? 100,
    batteryState: params.batteryState ?? 2,
    d: params.d ?? 1,
    screenBrightness: params.screenBrightness ?? 80,
    connectionType: params.connectionType ?? 'wifi',
    ssid: params.ssid ?? '',
    mdtUUID: params.mdtUUID ?? '',
    deviceSerial: params.deviceSerial ?? '',
    deviceName: params.deviceName ?? 'MDT',
    appVersion: params.appVersion ?? '0.0.1',
    updating: params.updating ?? false,
    isLocationServiceOn: params.isLocationServiceOn ?? 1,
    locationAuthStatus: params.locationAuthStatus ?? 'authorized',
  });
  await axios.get(url, { timeout: TIMEOUT });
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
    driverID: params.driverID,
    lat: params.lat,
    lng: params.lng,
    course: Math.round(Number(params.course ?? 0)),
    speed: Math.round(Number(params.speed ?? 0)),
    batteryLevel: params.batteryLevel ?? 100,
    batteryState: params.batteryState ?? 2,
    source: params.source ?? 'MDT',
    d: params.d ?? 1,
    minsLate: params.minsLate ?? 0,
  });
  await axios.get(url, { timeout: TIMEOUT });
}

/** Convert speed from m/s (Geolocation) to mph for vehicle update API. */
export function speedMpsToMph(mps: number | undefined | null): number {
  if (mps == null || !Number.isFinite(mps)) return 0;
  return mps * MPS_TO_MPH;
}

// ---------------------------------------------------------------------------
// Assignment & schedule (map data)
// ---------------------------------------------------------------------------

/** Current route/driver assignment for the vehicle. */
export interface AssignmentResponse {
  success?: boolean;
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
  const { data } = await axios.get<AssignmentResponse>(url, { timeout: TIMEOUT });
  return data;
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
  const { data } = await axios.get<RouteForDriverResponse>(url, { timeout: TIMEOUT });
  return data;
}
