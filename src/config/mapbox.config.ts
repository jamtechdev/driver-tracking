/**
 * Mapbox configuration for turn-by-turn navigation.
 */

import { env } from './env';

function readMapboxAccessToken(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./env.local') as { localEnv?: { MAPBOX_ACCESS_TOKEN?: string } };
    const fromLocal = mod.localEnv?.MAPBOX_ACCESS_TOKEN?.trim() ?? '';
    if (fromLocal.startsWith('pk.') && fromLocal.length > 20) {
      return fromLocal;
    }
  } catch {
    // env.local missing until setup:mapbox
  }
  return env.MAPBOX_ACCESS_TOKEN?.trim() ?? '';
}

export const MAPBOX_CONFIG = {
  get ACCESS_TOKEN() {
    return readMapboxAccessToken();
  },
  DIRECTIONS_BASE_URL: 'https://api.mapbox.com/directions/v5/mapbox/driving',
  REROUTE_DEVIATION_METERS: 40,
  REROUTE_COOLDOWN_MS: 6000,
  STOP_ARRIVAL_THRESHOLD_METERS: 20,
  /** Snap GPS onto road / route when requesting directions. */
  ROUTE_SNAP_RADIUS_METERS: 80,
  ROUTE_BEARING_RANGE_DEG: 60,
  /** Prefer route tangent heading when GPS course is unreliable. */
  ROUTE_HEADING_LOOKAHEAD_METERS: 22,
  /** Legacy flat-map recenter (meters / ms). */
  CAMERA_RECENTER_DISTANCE_METERS: 80,
  CAMERA_RECENTER_INTERVAL_MS: 4000,
  /** Stronger Google Maps–style 3D preview camera. */
  NAV_CAMERA_PITCH_DEG: 65,
  NAV_CAMERA_ZOOM: 18.2,
  NAV_CAMERA_ALTITUDE_METERS: 240,
  /** Opening tilt into 3D. */
  NAV_CAMERA_INTRO_MS: 1200,
  /** Overlapping camera anim — longer than frame interval = seamless glide. */
  NAV_CAMERA_FOLLOW_MS: 360,
  /** How often we push a new camera pose (ms). Higher = less native churn. */
  NAV_CAMERA_FRAME_MS: 64,
  /** How often the puck React marker refreshes (ms). */
  NAV_PUCK_FRAME_MS: 48,
  /** Exponential smoothing rates (higher = snappier). */
  NAV_SMOOTH_POS_RATE: 3.4,
  NAV_SMOOTH_HEADING_RATE: 4.8,
  /** Coast along heading when GPS is quiet (capped). */
  NAV_COAST_MAX_MPS: 28,
  NAV_CAMERA_LOOKAHEAD_METERS: 42,
  /** Google Maps navigation blue. */
  ROUTE_LINE_COLOR: '#4285F4',
  ROUTE_LINE_GLOW: 'rgba(66, 133, 244, 0.35)',
  ROUTE_LINE_CASING: '#1967D2',
};

/**
 * Manual QA — force Start Navigation on/off WITHOUT agency API.
 *
 * For REAL API behavior (client / production): keep UNDEFINED so MDTTURNBYTURN is used.
 * For local QA without Peak flag: set to 'true' or 'false'.
 *
 *   export const MDT_TURN_BY_TURN_TEST_OVERRIDE = 'true';
 *   export const MDT_TURN_BY_TURN_TEST_OVERRIDE = 'false';
 */
// export const MDT_TURN_BY_TURN_TEST_OVERRIDE: string | undefined = undefined;
export const MDT_TURN_BY_TURN_TEST_OVERRIDE='true';


/** `'true'` | `'false'` override, or `null` when test flag is off. */
export function getMdtTurnByTurnTestOverride(): boolean | null {
  const value =
    typeof MDT_TURN_BY_TURN_TEST_OVERRIDE !== 'undefined'
      ? MDT_TURN_BY_TURN_TEST_OVERRIDE
      : undefined;
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

export function isMapboxAccessTokenValid(): boolean {
  const token = readMapboxAccessToken();
  return token.startsWith('pk.') && token.length > 20;
}
