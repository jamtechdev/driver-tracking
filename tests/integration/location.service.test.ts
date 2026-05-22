import { locationService } from '@/services/location.service';

describe('location.service', () => {
  it('isAvailable when geolocation module loads', () => {
    expect(locationService.isAvailable()).toBe(true);
  });

  it('getCurrentLocation resolves coordinates', async () => {
    const pos = await locationService.getCurrentLocation();
    expect(pos.latitude).toBeDefined();
    expect(pos.longitude).toBeDefined();
  });

  it('watchPosition returns id and clearWatch is safe', () => {
    const id = locationService.watchPosition(jest.fn(), jest.fn());
    expect(id).not.toBe(-1);
    locationService.clearWatch(id);
    locationService.clearWatch(-1);
  });
});
