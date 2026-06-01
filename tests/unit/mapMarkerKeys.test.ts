import { buildTabletMarkerKey, buildVehicleMarkerKey } from '@/utils/mapMarkerKeys';

describe('mapMarkerKeys', () => {
  it('buildVehicleMarkerKey toggles with blink phase', () => {
    expect(buildVehicleMarkerKey(42, true, 0)).toBe('vehicle-42-blink-0');
    expect(buildVehicleMarkerKey(42, true, 1)).toBe('vehicle-42-blink-1');
    expect(buildVehicleMarkerKey(42, false, 1)).toBe('vehicle-42');
  });

  it('buildVehicleMarkerKey uses stable key while info popup is open', () => {
    expect(buildVehicleMarkerKey(42, true, 1, true)).toBe('vehicle-42-info');
  });

  it('buildTabletMarkerKey toggles with blink phase', () => {
    expect(buildTabletMarkerKey(true, 0)).toBe('tablet-blink-0');
    expect(buildTabletMarkerKey(true, 1)).toBe('tablet-blink-1');
    expect(buildTabletMarkerKey(false, 0)).toBe('tablet-marker');
  });
});
