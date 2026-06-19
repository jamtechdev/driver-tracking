import {
  advanceRouteProgress,
  findNextScheduleStop,
  ROUTE_ARRIVAL_THRESHOLD_METERS,
  seedRouteProgressFromLocation,
} from '@/utils/routeProgress';

const schedule = [
  { link: 1, longName: 'Stop A', lat: 40.0, lng: -74.0 },
  { link: 2, longName: 'Stop B', lat: 40.001, lng: -74.0 },
  { link: 3, longName: 'Stop C', lat: 40.002, lng: -74.0 },
];

describe('routeProgress', () => {
  it('findNextScheduleStop returns first unvisited in order', () => {
    expect(findNextScheduleStop(schedule, new Set([1]))?.longName).toBe('Stop B');
  });

  it('advanceRouteProgress marks stop visited within arrival threshold', () => {
    const result = advanceRouteProgress(
      { latitude: 40.0, longitude: -74.0 },
      schedule,
      new Set(),
    );
    expect(result.visitedLinks.has(1)).toBe(true);
    expect(result.nextStop?.longName).toBe('Stop B');
    expect(result.changed).toBe(true);
  });

  it('advanceRouteProgress passes current stop when closer to the following stop', () => {
    const approachingB = { latitude: 40.0012, longitude: -74.0 };
    const result = advanceRouteProgress(approachingB, schedule, new Set([1]));
    expect(result.nextStop?.longName).toBe('Stop C');
    expect(result.visitedLinks.has(2)).toBe(true);
  });

  it('seedRouteProgressFromLocation uses GPS when schedule loads mid-route', () => {
    const approachingC = { latitude: 40.0014, longitude: -74.0 };
    const result = seedRouteProgressFromLocation(approachingC, schedule);
    expect(result.visitedLinks.has(1)).toBe(true);
    expect(result.nextStop?.longName).toBe('Stop C');
  });

  it('seedRouteProgressFromLocation defaults to first stop without location', () => {
    const result = seedRouteProgressFromLocation(null, schedule);
    expect(result.nextStop?.longName).toBe('Stop A');
    expect(result.visitedLinks.size).toBe(0);
  });

  it('uses arrival threshold constant', () => {
    expect(ROUTE_ARRIVAL_THRESHOLD_METERS).toBe(50);
  });
});
