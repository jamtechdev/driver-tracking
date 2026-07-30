import {
  findNavigationStopIndex,
  orderStopsByRouteStopIds,
  resolveNavigableStops,
} from '@/features/navigation/navigationStopUtils';
import type { ScheduleStop } from '@/context/DriverModelContext';
import type { StopData } from '@/context/DriverDataContext';

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
