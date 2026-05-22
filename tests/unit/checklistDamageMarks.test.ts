import {
  parseChecklistDamageMarks,
  stringifyChecklistDamageMarks,
  layoutPointToIntrinsicPixel,
  intrinsicPixelToLayoutPoint,
} from '@/utils/checklistDamageMarks';

describe('checklistDamageMarks', () => {
  it('parse/stringify round-trip with legacy trailing semicolons', () => {
    const s = '10,20;30,40;';
    expect(parseChecklistDamageMarks(s)).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(stringifyChecklistDamageMarks(parseChecklistDamageMarks(s))).toBe(s);
  });

  it('parse ignores empty segments', () => {
    expect(parseChecklistDamageMarks('1,2;;3,4;')).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ]);
  });

  it('stringify empty', () => {
    expect(stringifyChecklistDamageMarks([])).toBe('');
  });

  it('contain: center touch maps to center pixel', () => {
    const layoutW = 400;
    const layoutH = 200;
    const intrinsicW = 800;
    const intrinsicH = 400;
    const p = layoutPointToIntrinsicPixel(200, 100, layoutW, layoutH, intrinsicW, intrinsicH);
    expect(p).toEqual({ x: 400, y: 200 });
    const back = intrinsicPixelToLayoutPoint(p!.x, p!.y, layoutW, layoutH, intrinsicW, intrinsicH);
    expect(back!.x).toBeCloseTo(200, 5);
    expect(back!.y).toBeCloseTo(100, 5);
  });

  it('contain: tap outside letterboxed area returns null', () => {
    const layoutW = 300;
    const layoutH = 300;
    const intrinsicW = 200;
    const intrinsicH = 100;
    expect(layoutPointToIntrinsicPixel(5, 5, layoutW, layoutH, intrinsicW, intrinsicH)).toBeNull();
  });

  it('contain: rounds and clamps to image bounds', () => {
    const p = layoutPointToIntrinsicPixel(99.9, 49.9, 100, 50, 200, 100);
    expect(p).toEqual({ x: 199, y: 99 });
  });
});
