/**
 * Marker keys for react-native-maps custom views.
 * Blinking: key changes each phase so Android redraws the arrow.
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
  return blinks ? `vehicle-${id}-blink-${blinkPhase}` : `vehicle-${id}`;
}

export function buildTabletMarkerKey(
  blinks: boolean,
  blinkPhase: 0 | 1,
): string {
  return blinks ? `tablet-blink-${blinkPhase}` : 'tablet-marker';
}
