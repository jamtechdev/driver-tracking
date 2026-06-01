import { formatMapVehicleInfo } from '@/utils/mapVehicleInfo';

describe('formatMapVehicleInfo', () => {
  it('shows vehicle id and route short name', () => {
    const result = formatMapVehicleInfo({
      vehicleID: '1365',
      routeShortName: 'Route 12',
      routeID: '12',
    });
    expect(result.vehicleId).toBe('1365');
    expect(result.routeLabel).toBe('Route 12');
  });

  it('shows Out of Service when route is unassigned', () => {
    const result = formatMapVehicleInfo({
      vehicleID: '1365',
      routeID: '0',
    });
    expect(result.vehicleId).toBe('1365');
    expect(result.routeLabel).toBe('Out of Service');
  });
});
