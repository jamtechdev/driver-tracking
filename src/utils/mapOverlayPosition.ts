import type React from 'react';

export type MapCoordinate = { latitude: number; longitude: number };

export type MapPoint = { x: number; y: number };

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapLayout = { width: number; height: number };

export const CALLOUT_EDGE_MARGIN = 8;

/** Responsive bubble width — scales down on narrow map hosts (phones, split view). */
export function resolveCalloutWidth(mapWidth: number): number {
  if (mapWidth <= 0) return 280;
  return Math.min(280, Math.max(148, Math.floor(mapWidth * 0.84)));
}

export type CalloutScreenPosition = {
  left: number;
  top: number;
  calloutWidth: number;
};

/** Keep the bubble on-screen while anchoring its pointer near the vehicle icon. */
export function computeCalloutScreenPosition(
  anchor: MapPoint,
  mapLayout: MapLayout,
  calloutWidth: number,
  calloutHeight: number,
  arrowSize: number,
  pointerGap: number,
): CalloutScreenPosition {
  const halfW = calloutWidth / 2;
  const arrowTop = anchor.y - arrowSize / 2;
  let top = arrowTop - pointerGap - calloutHeight;
  let left = anchor.x;

  if (mapLayout.width > 0) {
    const minLeft = halfW + CALLOUT_EDGE_MARGIN;
    const maxLeft = mapLayout.width - halfW - CALLOUT_EDGE_MARGIN;
    left = Math.min(Math.max(left, minLeft), maxLeft);
  }

  if (mapLayout.height > 0) {
    const minTop = CALLOUT_EDGE_MARGIN;
    const maxTop = Math.max(
      minTop,
      mapLayout.height - calloutHeight - CALLOUT_EDGE_MARGIN,
    );
    top = Math.min(Math.max(top, minTop), maxTop);
  }

  return { left, top, calloutWidth };
}

/** Screen point from visible map region — reliable fallback when pointForCoordinate is unavailable on iOS. */
export function estimateMapPoint(
  coordinate: MapCoordinate,
  region: MapRegion,
  layout: MapLayout,
): MapPoint {
  const x =
    ((coordinate.longitude - region.longitude) / region.longitudeDelta + 0.5) *
    layout.width;
  const y =
    ((region.latitude - coordinate.latitude) / region.latitudeDelta + 0.5) *
    layout.height;
  return { x, y };
}

type MapViewRef = {
  pointForCoordinate?: (
    coordinate: MapCoordinate,
  ) => Promise<MapPoint> | MapPoint;
} | null;

/** Native map screen point for a geographic coordinate. */
export async function fetchMapPointForCoordinate(
  mapRef: React.RefObject<MapViewRef>,
  coordinate: MapCoordinate,
): Promise<MapPoint | null> {
  const map = mapRef.current;
  if (!map?.pointForCoordinate) return null;

  try {
    const point = await Promise.resolve(map.pointForCoordinate(coordinate));
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      return { x: point.x, y: point.y };
    }
  } catch {
    // ignore
  }
  return null;
}
