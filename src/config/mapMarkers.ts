import type { ImageRequireSource } from 'react-native';

/**
 * Invisible 1×1 PNG passed as Marker `image` on Google Maps (Android).
 * Without it, the native SDK briefly draws `BitmapDescriptorFactory.defaultMarker` (red pin)
 * whenever the custom marker view is not ready yet or remounts.
 *
 * @see com.rnmaps.maps.MapMarker#getIcon — default branch uses defaultMarker(markerHue).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const TRANSPARENT_MAP_MARKER: ImageRequireSource = require('../assets/transparent-map-marker.png');
