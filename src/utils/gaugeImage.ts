/**
 * Schedule gauge images from vehicle update `minsLate` (Peak API).
 *
 * Convention (matches field name and live API responses):
 * - `0` → on time
 * - positive `1..20` → minutes late → `{n}_late.png`
 * - negative `-1..-10` → minutes early → `{n}_early.png`
 * - `-9999` or missing → no status
 */

import type { ImageSourcePropType } from 'react-native';
import { GAUGE_ASSETS } from '@/config/gaugeAssets';

export const GAUGE_MINS_LATE_NO_STATUS = -9999;

const EARLY_BY_LEVEL: Record<number, ImageSourcePropType> = {
  1: GAUGE_ASSETS.early1,
  2: GAUGE_ASSETS.early2,
  3: GAUGE_ASSETS.early3,
  4: GAUGE_ASSETS.early4,
  5: GAUGE_ASSETS.early5,
  6: GAUGE_ASSETS.early6,
  7: GAUGE_ASSETS.early7,
  8: GAUGE_ASSETS.early8,
  9: GAUGE_ASSETS.early9,
  10: GAUGE_ASSETS.early10,
};

const LATE_BY_LEVEL: Record<number, ImageSourcePropType> = {
  1: GAUGE_ASSETS.late1,
  2: GAUGE_ASSETS.late2,
  3: GAUGE_ASSETS.late3,
  4: GAUGE_ASSETS.late4,
  5: GAUGE_ASSETS.late5,
  6: GAUGE_ASSETS.late6,
  7: GAUGE_ASSETS.late7,
  8: GAUGE_ASSETS.late8,
  9: GAUGE_ASSETS.late9,
  10: GAUGE_ASSETS.late10,
  11: GAUGE_ASSETS.late11,
  12: GAUGE_ASSETS.late12,
  13: GAUGE_ASSETS.late13,
  14: GAUGE_ASSETS.late14,
  15: GAUGE_ASSETS.late15,
  16: GAUGE_ASSETS.late16,
  17: GAUGE_ASSETS.late17,
  18: GAUGE_ASSETS.late18,
  19: GAUGE_ASSETS.late19,
  20: GAUGE_ASSETS.late20,
};

export type GaugeVisualKind = 'no_status' | 'on_time' | 'early' | 'late';

export interface GaugeVisual {
  kind: GaugeVisualKind;
  /** 1–10 early or 1–20 late when applicable */
  level?: number;
}

/** Normalize vehicle update JSON (object or JSON string). */
export function normalizeVehicleUpdateResponse(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
    return null;
  }
  if (typeof data === 'object') return data as Record<string, unknown>;
  return null;
}

/** Parse `minsLate` from vehicle update JSON. */
export function parseVehicleUpdateMinsLate(resp: unknown): number | null {
  const o = normalizeVehicleUpdateResponse(resp);
  if (!o) return null;

  const raw = o.minsLate ?? o.minslate ?? o.MinsLate;
  if (raw !== undefined && raw !== null && raw !== '') {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }

  const vehicle = o.vehicle;
  if (Array.isArray(vehicle) && vehicle.length > 0) {
    return parseVehicleUpdateMinsLate(vehicle[0]);
  }
  if (vehicle && typeof vehicle === 'object') {
    return parseVehicleUpdateMinsLate(vehicle);
  }

  return null;
}

/** Stable key for React `key` on gauge `Image` — forces swap when tier changes. */
export function getGaugeRenderKey(mins: number | null | undefined, role?: string): string {
  if (role === 'supervisor' || role === 'unassigned') return 'gauge-no-status';
  const v = resolveGaugeVisual(mins);
  if (v.kind === 'early' || v.kind === 'late') {
    return `gauge-${v.kind}-${v.level ?? 1}`;
  }
  return `gauge-${v.kind}`;
}

/** Apply parsed minsLate only when value changed (avoids redundant context re-renders). */
export function shouldApplyMinsLateUpdate(
  current: number | null | undefined,
  parsed: number | null,
): parsed is number {
  return parsed !== null && parsed !== current;
}

/** Resolve gauge tier from API `minsLate` (before role overrides). */
export function resolveGaugeVisual(mins: number | null | undefined): GaugeVisual {
  if (mins === null || mins === undefined || !Number.isFinite(mins)) {
    return { kind: 'no_status' };
  }
  if (mins === GAUGE_MINS_LATE_NO_STATUS) {
    return { kind: 'no_status' };
  }
  if (mins === 0) {
    return { kind: 'on_time' };
  }
  if (mins < 0) {
    return { kind: 'early', level: Math.min(Math.abs(Math.round(mins)), 10) };
  }
  return { kind: 'late', level: Math.min(Math.max(1, Math.round(mins)), 20) };
}

/** PNG source for home gauge from `minsLate` and driver role. */
export function getGaugeImageSource(
  mins: number | null | undefined,
  role?: string,
): ImageSourcePropType {
  // if (role === 'supervisor' || role === 'unassigned') {
  //   return GAUGE_ASSETS.noStatus;
  // }
  const visual = resolveGaugeVisual(mins);
  switch (visual.kind) {
    case 'on_time':
      return GAUGE_ASSETS.onTime;
    case 'early': {
      const level = visual.level ?? 1;
      return EARLY_BY_LEVEL[level] ?? GAUGE_ASSETS.onTime;
    }
    case 'late': {
      const level = visual.level ?? 1;
      return LATE_BY_LEVEL[level] ?? GAUGE_ASSETS.onTime;
    }
    default:
      return GAUGE_ASSETS.noStatus;
  }
}
