import { Platform } from 'react-native';

/**
 * Marker keys for react-native-maps custom views.
 * Android: key changes each blink phase so the bitmap redraws.
 * iOS: stable key while blinking — tracksViewChanges + blinkPhase drives the animation.
 * While info popup is open: stable key so taps and overlay stay reliable.
 */
export function buildVehicleMarkerKey(
  vehicleId: string | number,
  blinks: boolean,
  blinkPhase: 0 | 1,
  infoOpen = false,
): string {
  const id = String(vehicleId);
  if (infoOpen) return `vehicle-${id}-info`;
  if (blinks && Platform.OS === 'android') {
    return `vehicle-${id}-blink-${blinkPhase}`;
  }
  return blinks ? `vehicle-${id}-blink` : `vehicle-${id}`;
}

export function buildTabletMarkerKey(
  blinks: boolean,
  blinkPhase: 0 | 1,
  infoOpen = false,
): string {
  if (infoOpen) return 'tablet-marker-info';
  if (blinks && Platform.OS === 'android') {
    return `tablet-blink-${blinkPhase}`;
  }
  return blinks ? 'tablet-blink' : 'tablet-marker';
}
