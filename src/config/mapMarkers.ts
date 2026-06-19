import { Platform, type ImageRequireSource } from 'react-native';

/**
 * Invisible 1×1 PNG passed as Marker `image` on Google Maps (Android).
 * Without it, the native SDK briefly draws `BitmapDescriptorFactory.defaultMarker` (red pin)
 * whenever the custom marker view is not ready yet or remounts.
 *
 * Do NOT pass this on iOS — it prevents custom marker views from receiving taps on Apple Maps.
 *
 * @see com.rnmaps.maps.MapMarker#getIcon — default branch uses defaultMarker(markerHue).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TRANSPARENT_MAP_MARKER: ImageRequireSource = require('../assets/transparent-map-marker.png');

/** Android-only invisible bitmap; iOS uses custom marker children without `image`. */
export function vehicleMarkerImage(): ImageRequireSource | undefined {
  return Platform.OS === 'android' ? TRANSPARENT_MAP_MARKER : undefined;
}

/** iOS custom markers need tracksViewChanges to stay tappable; Android only when animating. */
export function vehicleMarkerTracksViewChanges(animatingOrInfoOpen: boolean): boolean {
  return Platform.OS === 'ios' || animatingOrInfoOpen;
}

const STOP_MARKER_ID_PREFIX = 'stop-';

export function buildStopMarkerId(
  stopId: string | number,
  routeId?: string | number,
): string {
  if (routeId != null && routeId !== '') {
    return `${STOP_MARKER_ID_PREFIX}${routeId}-${stopId}`;
  }
  return `${STOP_MARKER_ID_PREFIX}${stopId}`;
}

export function isStopMarkerId(id: string | null | undefined): boolean {
  return id != null && String(id).startsWith(STOP_MARKER_ID_PREFIX);
}
