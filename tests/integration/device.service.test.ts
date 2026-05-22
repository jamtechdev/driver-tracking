import { deviceService } from '@/services/device.service';

describe('device.service', () => {
  it('getBrightness maps 0–100', async () => {
    const b = await deviceService.getBrightness();
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThanOrEqual(100);
  });

  it('setBrightness returns boolean', async () => {
    await expect(deviceService.setBrightness(50)).resolves.toBe(true);
  });

  it('getVolume returns number', async () => {
    const v = await deviceService.getVolume();
    expect(typeof v).toBe('number');
  });

  it('battery and volume listeners return disposers', async () => {
    expect(await deviceService.isCharging()).toBe(false);
    const u1 = deviceService.addBatteryListener(jest.fn());
    const u2 = deviceService.addVolumeListener(jest.fn());
    u1();
    u2();
  });
});
