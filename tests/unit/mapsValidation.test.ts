jest.mock('@/config/maps.config', () => ({
  MAPS_CONFIG: { androidApiKey: '', iosApiKey: '' },
  isMapsApiKeyValid: jest.fn(),
}));

import { isMapsApiKeyValid } from '@/config/maps.config';
import { validateMapsAvailability, getMapsAvailabilityMessage } from '@/utils/mapsValidation';

describe('mapsValidation', () => {
  const isValid = isMapsApiKeyValid as jest.MockedFunction<typeof isMapsApiKeyValid>;

  it('reports unavailable when API key is invalid', () => {
    isValid.mockReturnValue(false);
    const r = validateMapsAvailability();
    expect(r.available).toBe(false);
    expect(r.reason).toBeDefined();
    expect(getMapsAvailabilityMessage()).toContain('Maps');
  });

  it('reports available when API key is valid', () => {
    isValid.mockReturnValue(true);
    expect(validateMapsAvailability().available).toBe(true);
    expect(getMapsAvailabilityMessage()).toContain('available');
  });
});
