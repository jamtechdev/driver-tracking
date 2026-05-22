/**
 * Peak checklist “Vehicle Damage Image” serialization (matches legacy iOS).
 * Stored in item `value` as: `"x,y;x,y;"` — integer pixel coords in the diagram’s intrinsic image space.
 */

export interface DamagePixelPoint {
  x: number;
  y: number;
}

/** Parse legacy `split(';')` then `split(',')`; ignore empty trailing segments. */
export function parseChecklistDamageMarks(value: unknown): DamagePixelPoint[] {
  const s = String(value ?? '').trim();
  if (!s) return [];
  const out: DamagePixelPoint[] = [];
  for (const segment of s.split(';')) {
    const part = segment.trim();
    if (!part) continue;
    const comma = part.indexOf(',');
    if (comma < 0) continue;
    const x = Math.round(Number(part.slice(0, comma)));
    const y = Math.round(Number(part.slice(comma + 1)));
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
  }
  return out;
}

/** `[value appendFormat:@"%d,%d;", x, y];` — trailing semicolon after each pair. */
export function stringifyChecklistDamageMarks(points: DamagePixelPoint[]): string {
  if (points.length === 0) return '';
  return points.map((p) => `${Math.round(p.x)},${Math.round(p.y)};`).join('');
}

/**
 * Map a touch inside the layout box (W×H) to intrinsic image pixels (Iw×Ih)
 * when the image is drawn with `resizeMode="contain"` centered in that box.
 *
 * scale = min(W/Iw, H/Ih); drawn = (Iw*scale, Ih*scale); offset centers the drawn rect.
 * Local touch (tx,ty) → subtract offset → divide by scale → round to pixel indices.
 */
export function layoutPointToIntrinsicPixel(
  tx: number,
  ty: number,
  layoutW: number,
  layoutH: number,
  intrinsicW: number,
  intrinsicH: number,
): DamagePixelPoint | null {
  if (layoutW <= 0 || layoutH <= 0 || intrinsicW <= 0 || intrinsicH <= 0) return null;
  const scale = Math.min(layoutW / intrinsicW, layoutH / intrinsicH);
  const drawnW = intrinsicW * scale;
  const drawnH = intrinsicH * scale;
  const ox = (layoutW - drawnW) / 2;
  const oy = (layoutH - drawnH) / 2;
  const lx = tx - ox;
  const ly = ty - oy;
  if (lx < 0 || ly < 0 || lx > drawnW || ly > drawnH) return null;
  const px = Math.round(lx / scale);
  const py = Math.round(ly / scale);
  const x = Math.max(0, Math.min(intrinsicW - 1, px));
  const y = Math.max(0, Math.min(intrinsicH - 1, py));
  return { x, y };
}

/** Intrinsic pixel → layout coordinates (center of dot) for overlay rendering. */
export function intrinsicPixelToLayoutPoint(
  px: number,
  py: number,
  layoutW: number,
  layoutH: number,
  intrinsicW: number,
  intrinsicH: number,
): { x: number; y: number } | null {
  if (layoutW <= 0 || layoutH <= 0 || intrinsicW <= 0 || intrinsicH <= 0) return null;
  const scale = Math.min(layoutW / intrinsicW, layoutH / intrinsicH);
  const drawnW = intrinsicW * scale;
  const drawnH = intrinsicH * scale;
  const ox = (layoutW - drawnW) / 2;
  const oy = (layoutH - drawnH) / 2;
  const lx = ox + px * scale;
  const ly = oy + py * scale;
  return { x: lx, y: ly };
}
