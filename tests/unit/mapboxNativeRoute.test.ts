import {
  buildAgencyOverviewPolyline,
  buildAgencyRouteMatchingCoordinates,
  buildFrozenMapboxNativeSession,
  downsampleMatchingCoordinates,
  MAX_MAP_MATCHING_COORDINATES,
} from '@/features/navigation/mapboxNativeRoute';
import type { NavigationStop } from '@/features/navigation/types';

function stop(
  sequenceIndex: number,
  latitude: number,
  longitude: number,
  name: string,
): NavigationStop {
  return {
    id: `s${sequenceIndex}`,
    longName: name,
    latitude,
    longitude,
    sequenceIndex,
  };
}

describe('mapboxNativeRoute Map Matching', () => {
  const agencyShape = [
    { latitude: 35.27, longitude: -120.67 },
    { latitude: 35.271, longitude: -120.671 },
    { latitude: 35.272, longitude: -120.672 },
    { latitude: 35.273, longitude: -120.673 },
    { latitude: 35.274, longitude: -120.674 },
    { latitude: 35.275, longitude: -120.675 },
    { latitude: 35.276, longitude: -120.676 },
    { latitude: 35.277, longitude: -120.677 },
  ];

  it('marks only bus stops with separatesLegs', () => {
    const origin = { latitude: 35.2702, longitude: -120.6702 };
    const stops = [
      stop(0, 35.273, -120.673, 'Stop A'),
      stop(1, 35.277, -120.677, 'Stop B'),
    ];

    const matching = buildAgencyRouteMatchingCoordinates(origin, stops, agencyShape);
    expect(matching).not.toBeNull();
    expect(matching!.length).toBeGreaterThanOrEqual(3);

    const waypointNames = matching!
      .filter((c) => c.separatesLegs)
      .map((c) => c.name);
    // Final destination is an endpoint waypoint — separatesLegs only on intermediate stops.
    expect(waypointNames).toEqual(['Stop A']);
    expect(matching![matching!.length - 1].name).toBe('Stop B');
    expect(matching![matching!.length - 1].separatesLegs).toBeFalsy();

    const silentCount = matching!.filter((c) => !c.separatesLegs).length;
    expect(silentCount).toBeGreaterThan(0);
  });

  it('builds a single-leg matching chain for the next stop only', () => {
    const origin = { latitude: 35.2702, longitude: -120.6702 };
    const matching = buildAgencyRouteMatchingCoordinates(
      origin,
      [stop(0, 35.273, -120.673, 'Stop A')],
      agencyShape,
    );
    expect(matching).not.toBeNull();
    expect(matching!.some((c) => c.separatesLegs)).toBe(false);
    expect(matching![matching!.length - 1].name).toBe('Stop A');
  });

  it('downsamples while keeping stop waypoints', () => {
    const dense = Array.from({ length: 200 }, (_, i) => ({
      latitude: 35.27 + i * 0.001,
      longitude: -120.67 - i * 0.001,
      ...(i === 50 || i === 150 ? { separatesLegs: true, name: `Stop ${i}` } : {}),
    }));

    const out = downsampleMatchingCoordinates(dense, 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out[0]).toMatchObject(dense[0]);
    expect(out[out.length - 1]).toMatchObject(dense[dense.length - 1]);
    expect(out.filter((c) => c.separatesLegs).length).toBe(2);
  });

  it('builds a full-trip overview polyline once', () => {
    const origin = { latitude: 35.2702, longitude: -120.6702 };
    const stops = [
      stop(0, 35.273, -120.673, 'Stop A'),
      stop(1, 35.277, -120.677, 'Stop B'),
    ];
    const overview = buildAgencyOverviewPolyline(origin, stops, agencyShape);
    expect(overview).not.toBeNull();
    // MapScreen parity: full agency shape, not a driver→last-stop slice.
    expect(overview!.length).toBe(agencyShape.length);
    expect(overview![0]).toEqual(agencyShape[0]);
    expect(overview![overview!.length - 1]).toEqual(agencyShape[agencyShape.length - 1]);

    const session = buildFrozenMapboxNativeSession(origin, stops, agencyShape);
    expect(session!.overviewRouteCoordinates?.length).toBe(agencyShape.length);
    // Per-leg matching destination is still only the next stop.
    expect(session!.destination.title).toBe('Stop A');
  });

  it('omits routeCoordinates without agency shape (Directions fallback)', () => {
    const origin = { latitude: 35.2702, longitude: -120.6702 };
    const stops = [
      stop(0, 35.273, -120.673, 'Stop A'),
      stop(1, 35.277, -120.677, 'Stop B'),
    ];

    const session = buildFrozenMapboxNativeSession(origin, stops, []);
    expect(session).not.toBeNull();
    expect(session!.routeCoordinates).toBeUndefined();
    expect(session!.waypoints.length).toBe(1);
  });

  it('respects Map Matching coordinate budget', () => {
    const longShape = Array.from({ length: 500 }, (_, i) => ({
      latitude: 35.0 + i * 0.001,
      longitude: -120.0 - i * 0.001,
    }));
    const stops = [
      stop(0, 35.05, -120.05, 'A'),
      stop(1, 35.25, -120.25, 'B'),
      stop(2, 35.45, -120.45, 'C'),
    ];
    const matching = buildAgencyRouteMatchingCoordinates(
      { latitude: 35.001, longitude: -120.001 },
      stops,
      longShape,
    );
    expect(matching).not.toBeNull();
    expect(matching!.length).toBeLessThanOrEqual(MAX_MAP_MATCHING_COORDINATES);
  });
});
