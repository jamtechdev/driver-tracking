import {
  parseVehicleUpdateMinsLate,
  resolveGaugeVisual,
  getGaugeImageSource,
  getGaugeRenderKey,
  shouldApplyMinsLateUpdate,
  GAUGE_MINS_LATE_NO_STATUS,
} from '@/utils/gaugeImage';
import { GAUGE_ASSETS } from '@/config/gaugeAssets';

describe('gaugeImage', () => {
  it('parseVehicleUpdateMinsLate reads numeric minsLate from vehicle update', () => {
    expect(parseVehicleUpdateMinsLate({ minsLate: 5 })).toBe(5);
    expect(parseVehicleUpdateMinsLate({ minsLate: '3' })).toBe(3);
    expect(parseVehicleUpdateMinsLate({ minsLate: 0 })).toBe(0);
    expect(parseVehicleUpdateMinsLate({})).toBeNull();
    expect(parseVehicleUpdateMinsLate(JSON.stringify({ minsLate: 7 }))).toBe(7);
    expect(parseVehicleUpdateMinsLate({ vehicle: [{ minsLate: 2 }] })).toBe(2);
  });

  it('resolveGaugeVisual: positive minsLate = late minutes', () => {
    expect(resolveGaugeVisual(5)).toEqual({ kind: 'late', level: 5 });
    expect(resolveGaugeVisual(20)).toEqual({ kind: 'late', level: 20 });
    expect(resolveGaugeVisual(25)).toEqual({ kind: 'late', level: 20 });
  });

  it('resolveGaugeVisual: negative minsLate = early minutes', () => {
    expect(resolveGaugeVisual(-3)).toEqual({ kind: 'early', level: 3 });
    expect(resolveGaugeVisual(-12)).toEqual({ kind: 'early', level: 10 });
  });

  it('getGaugeRenderKey changes when tier changes', () => {
    expect(getGaugeRenderKey(5, 'driver')).toBe('gauge-late-5');
    expect(getGaugeRenderKey(6, 'driver')).toBe('gauge-late-6');
    expect(getGaugeRenderKey(0, 'driver')).toBe('gauge-on_time');
    expect(getGaugeRenderKey(-2, 'driver')).toBe('gauge-early-2');
  });

  it('shouldApplyMinsLateUpdate skips duplicate values', () => {
    expect(shouldApplyMinsLateUpdate(5, 5)).toBe(false);
    expect(shouldApplyMinsLateUpdate(5, 6)).toBe(true);
    expect(shouldApplyMinsLateUpdate(null, 0)).toBe(true);
  });

  it('getGaugeImageSource returns bundled asset for late minsLate', () => {
    expect(getGaugeImageSource(5, 'driver')).toBe(GAUGE_ASSETS.late5);
    expect(getGaugeImageSource(0, 'driver')).toBe(GAUGE_ASSETS.onTime);
    expect(getGaugeImageSource(null, 'driver')).toBe(GAUGE_ASSETS.noStatus);
  });

  it('resolveGaugeVisual: zero and sentinel', () => {
    expect(resolveGaugeVisual(0)).toEqual({ kind: 'on_time' });
    expect(resolveGaugeVisual(GAUGE_MINS_LATE_NO_STATUS)).toEqual({ kind: 'no_status' });
    expect(resolveGaugeVisual(null)).toEqual({ kind: 'no_status' });
  });
});
