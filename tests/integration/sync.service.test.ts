import { syncService } from '@/services/sync.service';

describe('sync.service', () => {
  it('exports callable stubs', async () => {
    await expect(syncService.syncAll()).resolves.toBeUndefined();
    await expect(syncService.syncPassengerData()).resolves.toBeUndefined();
    await expect(syncService.syncRouteData()).resolves.toBeUndefined();
    await expect(syncService.syncLocationData()).resolves.toBeUndefined();
  });
});
