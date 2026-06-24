import {
  buildExpectedLinks,
  findCurrentLinkWithLocation,
  isLinkAfter,
  secondsFromLink,
  secondsSinceMidnight,
  MINS_LATE_UNKNOWN,
} from '@/features/adherence/directionEngine';
import { parseRoutePointsToLinks } from '@/features/adherence/linkGeometry';
import type { DirectionScheduleItem } from '@/features/adherence/types';

describe('directionEngine', () => {
  const linkAverages = [10, 10, 10, 10];

  const links = parseRoutePointsToLinks(
    '40.0,-75.0;40.01,-75.0;40.02,-75.0;40.03,-75.0',
  );

  const schedule: DirectionScheduleItem[] = [
    {
      blockID: '1',
      link: 3,
      calculatedArrivalTime: 36300,
      stopName: 'Stop B',
      longName: 'Stop B',
      unscheduled: false,
      tripID: 100,
    },
  ];

  it('secondsFromLink sums averages with wrap', () => {
    expect(secondsFromLink(0, 2, linkAverages)).toBe(20);
    expect(secondsFromLink(3, 1, linkAverages)).toBe(20);
  });

  it('isLinkAfter respects half-route window', () => {
    expect(isLinkAfter(2, 1, 4)).toBe(true);
    expect(isLinkAfter(0, 3, 4)).toBe(false);
  });

  it('buildExpectedLinks produces expected link per block', () => {
    const timeInSeconds = 35000;
    const expected = buildExpectedLinks(schedule, linkAverages, timeInSeconds, 3600);
    expect(expected.length).toBe(1);
    expect(expected[0].blockID).toBe('1');
    expect(expected[0].link).toBeGreaterThanOrEqual(0);
  });

  it('findCurrentLinkWithLocation picks next stop by link travel time', () => {
    const timeInSeconds = 36000;
    const expected = buildExpectedLinks(schedule, linkAverages, timeInSeconds, 3600);

    const result = findCurrentLinkWithLocation({
      lat: 40.0,
      lng: -75.0,
      course: 0,
      links,
      linkAverages,
      routeSchedule: schedule,
      expectedLinks: expected,
      timeInSeconds,
      totalRouteTime: 3600,
    });

    expect(result.nextStop).not.toBeNull();
    expect(result.nextStop?.longName).toBe('Stop B');
    if (result.nextScheduledStop) {
      expect(result.minsLate).not.toBe(MINS_LATE_UNKNOWN);
    }
  });

  it('returns unknown minsLate when no expected links', () => {
    const result = findCurrentLinkWithLocation({
      lat: 40.0,
      lng: -75.0,
      course: 0,
      links,
      linkAverages,
      routeSchedule: schedule,
      expectedLinks: [],
      timeInSeconds: 36000,
      totalRouteTime: 3600,
    });
    expect(result.nextStop).toBeNull();
    expect(result.minsLate).toBe(MINS_LATE_UNKNOWN);
  });

  it('secondsSinceMidnight is positive', () => {
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    expect(secondsSinceMidnight(noon)).toBe(12 * 3600);
  });
});
