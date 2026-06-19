import { resolveStopDisplayName } from '@/utils/stopDisplayName';

describe('resolveStopDisplayName', () => {
  it('prefers current stop geofence name when inside a geofence', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 1',
        currentStopGeofence: { geofenceID: '10', name: 'Main & Oak' },
        nextStop: { longName: 'Next Scheduled Stop' },
      }),
    ).toBe('Main & Oak');
  });

  it('uses schedule next stop when outside geofences', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 1',
        currentStopGeofence: null,
        nextStop: { longName: 'Downtown Transit Center' },
      }),
    ).toBe('Downtown Transit Center');
  });

  it('returns ellipsis when out of service', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Out of Service',
        currentStopGeofence: { geofenceID: '1', name: 'Yard' },
        nextStop: { longName: 'Stop A' },
      }),
    ).toBe('...');
  });

  it('returns ellipsis when no geofence or schedule stop', () => {
    expect(
      resolveStopDisplayName({
        selectedRoute: 'Route 1',
        currentStopGeofence: null,
        nextStop: null,
      }),
    ).toBe('...');
  });
});
