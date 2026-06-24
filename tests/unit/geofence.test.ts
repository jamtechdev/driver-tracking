import {
  findGeofenceAtLocation,
  isCoordinateInsideGeofence,
  isSilentGeofence,
  parseGeofences,
} from '@/utils/geofence';

describe('geofence', () => {
  const geofences = parseGeofences([
    {
      geofenceID: 1,
      name: 'Yard',
      lat: 40,
      lng: -75,
      radius: 500,
      warn: 0,
      vehicles: [101],
    },
    {
      geofenceID: 2,
      name: 'Silent Zone',
      lat: 41,
      lng: -76,
      radius: 300,
      warn: 2,
      vehicles: [101],
    },
  ]);

  it('parseGeofences filters invalid entries', () => {
    expect(geofences).toHaveLength(2);
  });

  it('isCoordinateInsideGeofence uses radius in meters', () => {
    expect(isCoordinateInsideGeofence(40, -75, geofences[0])).toBe(true);
    expect(isCoordinateInsideGeofence(40.1, -75, geofences[0])).toBe(false);
  });

  it('findGeofenceAtLocation respects vehicle list', () => {
    const hit = findGeofenceAtLocation(40, -75, '101', geofences);
    expect(hit?.name).toBe('Yard');
    expect(findGeofenceAtLocation(40, -75, '999', geofences)).toBeNull();
  });

  it('isSilentGeofence for warn 2', () => {
    expect(isSilentGeofence(geofences[1])).toBe(true);
    expect(isSilentGeofence(geofences[0])).toBe(false);
  });
});
