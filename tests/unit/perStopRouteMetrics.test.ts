import { computePerStopRouteMetrics } from '@/features/navigation/navigationUtils';
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

describe('computePerStopRouteMetrics', () => {
  const driver = { latitude: 35.26, longitude: -120.67 };
  const stops = [
    stop(0, 35.27, -120.67, 'Near'),
    stop(1, 35.35, -120.67, 'Far'),
  ];

  it('keeps next-stop distance and duration consistent (not full-route distance)', () => {
    // Native progress is for the FULL remaining multi-stop trip — must not be
    // shown as "distance to next stop" while duration is only for the next stop.
    const metrics = computePerStopRouteMetrics({
      remainingStops: stops,
      currentStopIndex: 3,
      driverLocation: driver,
      routeProgress: {
        distanceRemaining: 18000,
        durationRemaining: 1200,
        fractionTraveled: 0.2,
      },
    });

    expect(metrics[0].distanceMeters).toBeLessThan(3000);
    expect(metrics[0].durationSeconds).toBeGreaterThan(30);
    // ~30 mph average from native ⇒ duration ≈ distance / avgSpeed
    const impliedMps = metrics[0].distanceMeters / metrics[0].durationSeconds;
    expect(impliedMps).toBeGreaterThan(5);
    expect(impliedMps).toBeLessThan(40);
  });

  it('uses native progress when only one destination remains and values are sane', () => {
    const metrics = computePerStopRouteMetrics({
      remainingStops: [stops[0]],
      currentStopIndex: 0,
      driverLocation: driver,
      routeProgress: {
        distanceRemaining: 800,
        durationRemaining: 90,
        fractionTraveled: 0.1,
      },
    });

    expect(metrics[0].distanceMeters).toBe(800);
    expect(metrics[0].durationSeconds).toBe(90);
  });
});
