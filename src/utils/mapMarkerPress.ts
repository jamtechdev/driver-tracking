import { Platform } from 'react-native';

/** Marker press handler — avoid stopPropagation on iOS (breaks Apple Maps tap routing). */
export function handleVehicleMarkerPress(
  event: unknown,
  vehicle: Record<string, unknown>,
  onPress: (vehicle: Record<string, unknown>) => void,
): void {
  if (Platform.OS === 'android') {
    const nativeEvent = event as { stopPropagation?: () => void };
    nativeEvent?.stopPropagation?.();
  }
  onPress(vehicle);
}

/** Stop marker tap — dismiss vehicle bubble; native stop callout handles the rest. */
export function handleStopMarkerPress(
  event: unknown,
  onStopPress: () => void,
): void {
  const nativeEvent = event as { stopPropagation?: () => void };
  nativeEvent?.stopPropagation?.();
  onStopPress();
}
