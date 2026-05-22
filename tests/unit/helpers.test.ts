import {
  debounce,
  formatTime,
  calculateDistance,
  clamp,
  parseRoutePoints,
  calculateBearing,
  generateId,
  parseVehicleLatLng,
  parseVehicleCourse,
  createVehicleHeadingResolver,
  isVehicleLocationFresh,
  getVehicleLocationAgeSeconds,
  VEHICLE_LOCATION_MAX_AGE_SECONDS,
  isAssignedRouteId,
  formatRouteColor,
  getVehicleRouteColor,
  shouldAnimateVehicleArrow,
  isEmergencyAlertActive,
  isVehicleEmergencyAlertActive,
  getTabletMarkerBlinkMode,
} from '@/utils/helpers';

describe('helpers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounce delays invocation', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    d();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('formatTime supports 12h and 24h', () => {
    const d = new Date('2020-01-15T14:05:00');
    expect(formatTime(d, '24h')).toMatch(/14/);
    expect(formatTime(d, '12h')).toMatch(/PM|pm|2/);
  });

  it('calculateDistance returns meters for known points', () => {
    const meters = calculateDistance(40.7128, -74.006, 40.713, -74.0065);
    expect(meters).toBeGreaterThan(0);
    expect(meters).toBeLessThan(5000);
  });

  it('clamp constrains values', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('parseRoutePoints parses coordinate pairs', () => {
    expect(parseRoutePoints('')).toEqual([]);
    expect(parseRoutePoints('40.1,-74.1,40.2,-74.2')).toEqual([
      { latitude: 40.1, longitude: -74.1 },
      { latitude: 40.2, longitude: -74.2 },
    ]);
  });

  it('calculateBearing returns 0–360', () => {
    const b = calculateBearing(0, 0, 1, 1);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });

  it('generateId is non-empty', () => {
    expect(generateId().length).toBeGreaterThan(4);
  });

  it('parseVehicleLatLng reads lat/lng strings', () => {
    expect(parseVehicleLatLng({ lat: '40.1', lng: '-74.2' })).toEqual({ lat: 40.1, lng: -74.2 });
    expect(parseVehicleLatLng({})).toBeNull();
  });

  it('parseVehicleCourse prefers course field', () => {
    expect(parseVehicleCourse({ course: '90' })).toBe(90);
    expect(parseVehicleCourse({ bearing: '45' })).toBe(45);
  });

  it('createVehicleHeadingResolver infers bearing from movement', () => {
    const resolve = createVehicleHeadingResolver();
    expect(resolve('1', { lat: 0, lng: 0 }, null)).toBe(0);
    const h = resolve('1', { lat: 0, lng: 0.001 }, 0);
    expect(h).toBeGreaterThan(80);
    expect(h).toBeLessThan(100);
  });

  it('createVehicleHeadingResolver uses explicit course 0 as north', () => {
    const resolve = createVehicleHeadingResolver();
    expect(resolve('1', { lat: 37, lng: -122 }, 0)).toBe(0);
    expect(resolve('1', { lat: 37, lng: -122 }, 0)).toBe(0);
  });

  it('createVehicleHeadingResolver uses positive course from API', () => {
    const resolve = createVehicleHeadingResolver();
    expect(resolve('2', { lat: 37, lng: -122 }, 121)).toBe(121);
  });

  it('isVehicleLocationFresh uses lastUpdated seconds', () => {
    expect(isVehicleLocationFresh({ lastUpdated: '120' })).toBe(true);
    expect(isVehicleLocationFresh({ lastUpdated: String(VEHICLE_LOCATION_MAX_AGE_SECONDS) })).toBe(true);
    expect(isVehicleLocationFresh({ lastUpdated: String(VEHICLE_LOCATION_MAX_AGE_SECONDS + 1) })).toBe(false);
    expect(isVehicleLocationFresh({})).toBe(false);
  });

  it('getVehicleLocationAgeSeconds falls back to updated unix timestamp', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    expect(getVehicleLocationAgeSeconds({ updated: String(nowSec - 600) })).toBeCloseTo(600, -1);
  });

  it('isAssignedRouteId rejects unassigned route ids', () => {
    expect(isAssignedRouteId('12525')).toBe(true);
    expect(isAssignedRouteId(null)).toBe(false);
    expect(isAssignedRouteId('0')).toBe(false);
    expect(isAssignedRouteId('-1')).toBe(false);
    expect(isAssignedRouteId('-2')).toBe(false);
  });

  it('formatRouteColor normalizes hex', () => {
    expect(formatRouteColor('ff0000')).toBe('#ff0000');
    expect(formatRouteColor(null)).toBeNull();
  });

  it('isVehicleEmergencyAlertActive reads vehicle payload', () => {
    expect(isVehicleEmergencyAlertActive({ alert: 1 })).toBe(true);
    expect(isVehicleEmergencyAlertActive({ alert: '1' })).toBe(true);
    expect(isVehicleEmergencyAlertActive({ alert: 0 })).toBe(false);
    expect(isVehicleEmergencyAlertActive({})).toBe(false);
  });

  it('getTabletMarkerBlinkMode prioritizes alert over unassigned', () => {
    expect(getTabletMarkerBlinkMode(true, true)).toBe('alert');
    expect(getTabletMarkerBlinkMode(false, true)).toBe('alert');
    expect(getTabletMarkerBlinkMode(false, false)).toBe('unassigned');
    expect(getTabletMarkerBlinkMode(true, false)).toBe('none');
    expect(isEmergencyAlertActive(1)).toBe(true);
    expect(isEmergencyAlertActive(0)).toBe(false);
  });

  it('shouldAnimateVehicleArrow when route id or color missing', () => {
    const map = { '12525': '#ff0000' };
    expect(shouldAnimateVehicleArrow({ routeID: '-1' }, map)).toBe(true);
    expect(shouldAnimateVehicleArrow({ routeID: '12525', routeColor: '00ff00' }, map)).toBe(false);
    expect(shouldAnimateVehicleArrow({ routeID: '12525' }, map)).toBe(false);
    expect(shouldAnimateVehicleArrow({ routeID: '99999' }, map)).toBe(true);
  });
});
