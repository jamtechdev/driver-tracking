import { APP_CONSTANTS, BOTTOM_BAR_HEIGHT, FARE_TYPES } from '@/utils/constants';

describe('constants', () => {
  it('exports bottom bar height', () => {
    expect(BOTTOM_BAR_HEIGHT).toBeGreaterThan(0);
  });

  it('APP_CONSTANTS has storage keys', () => {
    expect(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN).toContain('driver_tracking');
    expect(APP_CONSTANTS.MESSAGE_POLL_INTERVAL).toBeGreaterThan(0);
  });

  it('FARE_TYPES is non-empty', () => {
    expect(FARE_TYPES.length).toBeGreaterThan(0);
    expect(FARE_TYPES[0]).toHaveProperty('amount');
  });
});
