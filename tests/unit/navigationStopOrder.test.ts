import {
  findNavigationStopIndex,
  orderStopsByRouteStopIds,
  resolveForwardStopIndex,
  resolveNavigableStops,
  resolveStopHudPhase,
} from '@/features/navigation/navigationStopUtils';
import type { ScheduleStop } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';
import type { NavigationStop } from '@/features/navigation/types';

describe('stop-based turn-by-turn', () => {
  const stops = [
    { stopID: 3, longName: 'Charlie', lat: 35.3, lng: -120.67 },
    { stopID: 1, longName: 'Alpha', lat: 35.26, lng: -120.67 },
    { stopID: 2, longName: 'Bravo', lat: 35.28, lng: -120.67 },
  ] as unknown as StopData[];

  it('preserves route.routeStops order', () => {
    const ordered = orderStopsByRouteStopIds([1, 2, 3], stops);
    expect(ordered.map((s) => String(s.stopID))).toEqual(['1', '2', '3']);
  });

  it('resolveNavigableStops prefers ordered route stops over schedule', () => {
    const routeStops = orderStopsByRouteStopIds([1, 2, 3], stops);
    const schedule = [
      {
        blockID: 1,
        link: 99,
        calculatedArrivalTime: 36000,
        departureTime: 36000,
        longName: 'Bravo',
        tripID: 1,
        unscheduled: 0,
        lat: 35.28,
        lng: -120.67,
      },
    ] as ScheduleStop[];

    const navigable = resolveNavigableStops(schedule, stops, schedule[0], routeStops);
    expect(navigable.map((s) => s.longName)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('findNavigationStopIndex matches nextStop by name on route-stop list', () => {
    const routeStops = orderStopsByRouteStopIds([1, 2, 3], stops);
    const navigable = resolveNavigableStops([], stops, null, routeStops);
    const nextStop = {
      blockID: 1,
      link: 50,
      calculatedArrivalTime: 36000,
      departureTime: 36000,
      longName: 'Bravo',
      tripID: 1,
      unscheduled: 0,
      lat: 35.28,
      lng: -120.67,
    } as ScheduleStop;

    expect(findNavigationStopIndex(navigable, nextStop)).toBe(1);
  });
});

describe('resolveForwardStopIndex', () => {
  const honeywell: NavigationStop = {
    id: '153910',
    longName: 'Braeswood Blvd @ Honeywell Rd EB',
    latitude: 29.7,
    longitude: -95.5,
    sequenceIndex: 0,
  };
  const barger: NavigationStop = {
    id: '153911',
    longName: 'Braeswood Blvd @ Barger Rd EB',
    latitude: 29.7,
    longitude: -95.4985,
    sequenceIndex: 1,
  };
  const braeburn: NavigationStop = {
    id: '153912',
    longName: 'S Braeswood Blvd @ Braeburn Glen Blvd',
    latitude: 29.7,
    longitude: -95.497,
    sequenceIndex: 2,
  };
  const stops = [honeywell, barger, braeburn];

  it('stays on Honeywell while approaching it', () => {
    const puck = { latitude: 29.7, longitude: -95.5008 };
    expect(resolveForwardStopIndex(puck, stops, 0)).toBe(0);
  });

  it('advances to Barger after passing Honeywell along the street', () => {
    const puck = { latitude: 29.7, longitude: -95.4994 };
    expect(resolveForwardStopIndex(puck, stops, 0)).toBe(1);
  });

  it('advances to Braeburn after passing Barger', () => {
    const puck = { latitude: 29.7, longitude: -95.4976 };
    expect(resolveForwardStopIndex(puck, stops, 1)).toBe(2);
  });

  it('does not skip Honeywell to a far downstream stop from a distant GPS fix', () => {
    const puck = { latitude: 29.7, longitude: -95.48 };
    expect(resolveForwardStopIndex(puck, stops, 0)).toBe(0);
  });

  it('never moves backward', () => {
    const puck = { latitude: 29.7, longitude: -95.5008 };
    expect(resolveForwardStopIndex(puck, stops, 1)).toBe(1);
  });
});

describe('resolveStopHudPhase', () => {
  it('uses 100m for approaching and 20m for arrived', () => {
    expect(resolveStopHudPhase(150)).toBe('next');
    expect(resolveStopHudPhase(80)).toBe('approaching');
    expect(resolveStopHudPhase(20)).toBe('arrived');
    expect(resolveStopHudPhase(8)).toBe('arrived');
  });
});
