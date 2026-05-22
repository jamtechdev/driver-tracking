import { backgroundTrackingService } from '@/services/background-tracking.service';

describe('backgroundTrackingService', () => {
  it('singleton exposes state', () => {
    expect(backgroundTrackingService.isTracking()).toBe(false);
    expect(backgroundTrackingService.getCurrentData()).toBeNull();
  });
});
