/**
 * Helper Functions
 */

/**
 * Debounce function
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Format time based on format preference
 */
export const formatTime = (date: Date, format: '12h' | '24h' = '12h'): string => {
  if (format === '24h') {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Parse route points string into an array of coordinates
 */
export const parseRoutePoints = (pointsStr: any): { latitude: number, longitude: number }[] => {
  if (!pointsStr || typeof pointsStr !== 'string') return [];
  try {
    const coords = pointsStr.match(/-?\d+\.\d+/g);
    if (!coords || coords.length < 2) return [];

    const result = [];
    for (let i = 0; i < coords.length; i += 2) {
      if (coords[i + 1]) {
        result.push({
          latitude: parseFloat(coords[i]),
          longitude: parseFloat(coords[i + 1]),
        });
      }
    }
    return result;
  } catch (e) {
    console.error('Error parsing points string:', e);
    return [];
  }
};

/** Minimum movement (meters) before inferring heading from position delta. */
const MIN_MOVE_FOR_INFERRED_HEADING_M = 3;

/** Hide map vehicles with no location update in the past hour (Peak API `lastUpdated` is seconds ago). */
export const VEHICLE_LOCATION_MAX_AGE_SECONDS = 3600;

/** Route IDs that mean unassigned / out of service (not a real route). */
const UNASSIGNED_ROUTE_IDS = new Set(['0', '-1', '-2']);

/** True when the driver/vehicle has a real route assignment. */
export const isAssignedRouteId = (routeId: string | null | undefined): boolean => {
  if (routeId == null || routeId === '') return false;
  return !UNASSIGNED_ROUTE_IDS.has(String(routeId));
};

/** Normalize a route/vehicle color string to #RRGGBB, or null if missing. */
export const formatRouteColor = (color: unknown): string | null => {
  if (color === undefined || color === null || color === '') return null;
  const raw = String(color).trim();
  if (!raw || raw.toLowerCase() === 'null') return null;
  return raw.startsWith('#') ? raw : `#${raw}`;
};

/**
 * Resolved arrow color for a vehicle on the map (vehicle payload or route list).
 * Returns null when the vehicle should use the unassigned black/white animation.
 */
export const getVehicleRouteColor = (
  vehicle: Record<string, unknown>,
  routeColorMap: Record<string, string>,
): string | null => {
  const routeId = vehicle.routeID ?? vehicle.routeId;
  if (!isAssignedRouteId(routeId)) return null;

  const fromVehicle = formatRouteColor(vehicle.routeColor ?? vehicle.route_color);
  if (fromVehicle) return fromVehicle;

  const fromMap = routeColorMap[String(routeId)];
  return fromMap ?? null;
};

/** True when the vehicle arrow should blink black/white (no usable route color). */
export const shouldAnimateVehicleArrow = (
  vehicle: Record<string, unknown>,
  routeColorMap: Record<string, string>,
): boolean => getVehicleRouteColor(vehicle, routeColorMap) === null;

/** True when vehicle update / API reports emergency alert active. */
export const isEmergencyAlertActive = (alert: number | null | undefined): boolean =>
  alert === 1;

/** True when a vehicle list/map payload has emergency alert (Peak `alert` === 1). */
export const isVehicleEmergencyAlertActive = (
  vehicle: Record<string, unknown>,
): boolean => {
  const a = vehicle.alert;
  if (a === 1 || a === '1') return true;
  if (typeof a === 'number' && Number.isFinite(a)) return a === 1;
  if (typeof a === 'string' && a !== '') {
    const n = parseInt(a, 10);
    return n === 1;
  }
  return false;
};

export type TabletMarkerBlinkMode = 'none' | 'unassigned' | 'alert';

/** Tablet map arrow: red/white when alert=1, else black/white when unassigned. */
export const getTabletMarkerBlinkMode = (
  hasAssignedRoute: boolean,
  alertActive: boolean,
): TabletMarkerBlinkMode => {
  if (alertActive) return 'alert';
  if (!hasAssignedRoute) return 'unassigned';
  return 'none';
};

/**
 * Seconds since the vehicle's last location update (from API `lastUpdated`, or derived from `updated`).
 */
export const getVehicleLocationAgeSeconds = (vehicle: Record<string, unknown>): number | null => {
  const lastUpdated = vehicle.lastUpdated ?? vehicle.lastupdated;
  if (lastUpdated !== undefined && lastUpdated !== null && lastUpdated !== '') {
    const age = typeof lastUpdated === 'number' ? lastUpdated : parseFloat(String(lastUpdated));
    if (Number.isFinite(age) && age >= 0) return age;
  }

  const updated = vehicle.updated;
  if (updated !== undefined && updated !== null && updated !== '') {
    const ts = typeof updated === 'number' ? updated : parseFloat(String(updated));
    const sec = ts > 1e12 ? ts / 1000 : ts;
    if (Number.isFinite(sec) && sec > 1e9) {
      return Math.max(0, Date.now() / 1000 - sec);
    }
  }

  return null;
};

/** True when the vehicle reported a location update within `maxAgeSeconds` (default: 1 hour). */
export const isVehicleLocationFresh = (
  vehicle: Record<string, unknown>,
  maxAgeSeconds: number = VEHICLE_LOCATION_MAX_AGE_SECONDS,
): boolean => {
  const age = getVehicleLocationAgeSeconds(vehicle);
  if (age === null) return false;
  return age <= maxAgeSeconds;
};

/**
 * Parse lat/lng from a vehicle record (Peak API uses lat/lng strings).
 */
export const parseVehicleLatLng = (
  vehicle: Record<string, unknown>,
): { lat: number; lng: number } | null => {
  const latRaw = vehicle.lat ?? vehicle.latitude;
  const lngRaw = vehicle.lng ?? vehicle.longitude ?? vehicle.lon;
  const lat = typeof latRaw === 'number' ? latRaw : parseFloat(String(latRaw ?? ''));
  const lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(String(lngRaw ?? ''));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * Parse heading/course from a vehicle record (API field is `course`).
 */
export const parseVehicleCourse = (vehicle: Record<string, unknown>): number | null => {
  const raw = vehicle.course ?? vehicle.bearing ?? vehicle.heading;
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) return null;
  return ((n % 360) + 360) % 360;
};

/**
 * Tracks prior positions and resolves heading: API course, else bearing from movement, else last known.
 */
export const createVehicleHeadingResolver = () => {
  const previous = new Map<string, { lat: number; lng: number; heading: number }>();

  return (
    vehicleId: string,
    coord: { lat: number; lng: number },
    reportedCourse: number | null,
  ): number => {
    const id = String(vehicleId);
    const prev = previous.get(id);
    let heading = prev?.heading ?? 0;

    if (reportedCourse != null && reportedCourse > 0) {
      heading = reportedCourse;
    } else if (prev) {
      const moved = calculateDistance(prev.lat, prev.lng, coord.lat, coord.lng);
      if (moved >= MIN_MOVE_FOR_INFERRED_HEADING_M) {
        heading = calculateBearing(prev.lat, prev.lng, coord.lat, coord.lng);
      } else if (reportedCourse === 0) {
        heading = 0;
      } else {
        heading = prev.heading;
      }
    } else if (reportedCourse === 0) {
      heading = 0;
    }

    previous.set(id, { ...coord, heading });
    return heading;
  };
};

/**
 * Calculate bearing between two points
 */
export const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);
  return (theta * (180 / Math.PI) + 360) % 360;
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

