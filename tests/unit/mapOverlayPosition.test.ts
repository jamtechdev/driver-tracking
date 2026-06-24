import {
  computeCalloutScreenPosition,
  estimateMapPoint,
  resolveCalloutWidth,
} from '@/utils/mapOverlayPosition';

describe('mapOverlayPosition', () => {
  const region = {
    latitude: 40,
    longitude: -74,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  };

  it('scales callout width for narrow map hosts', () => {
    expect(resolveCalloutWidth(320)).toBeLessThanOrEqual(280);
    expect(resolveCalloutWidth(320)).toBeGreaterThanOrEqual(148);
    expect(resolveCalloutWidth(1200)).toBe(280);
  });

  it('estimates screen point from region and layout', () => {
    const point = estimateMapPoint(
      { latitude: 40, longitude: -74 },
      region,
      { width: 400, height: 800 },
    );
    expect(point.x).toBe(200);
    expect(point.y).toBe(400);
  });

  it('clamps callout inside map bounds', () => {
    const position = computeCalloutScreenPosition(
      { x: 10, y: 20 },
      { width: 360, height: 640 },
      200,
      80,
      40,
      4,
    );

    expect(position.left).toBeGreaterThanOrEqual(100);
    expect(position.top).toBeGreaterThanOrEqual(8);
    expect(position.calloutWidth).toBe(200);
  });
});
